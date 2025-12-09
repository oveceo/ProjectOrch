import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'

/**
 * Extract last name from various formats:
 * - "jforster@ovec.com" → "Forster"
 * - "Jforster" → "Forster" 
 * - "Approver, Keith Clark" → "Clark"
 * - "Keith Clark" → "Clark"
 */
function extractLastName(input: string): string {
  console.log(`Extracting last name from: "${input}"`)
  
  // Handle email format: jforster@ovec.com → "Forster" (remove first character)
  if (input.includes('@')) {
    const namePart = input.split('@')[0] // "jforster"
    const nameParts = namePart.split(/[._]/) // Split on . or _
    let lastName = nameParts[nameParts.length - 1] // "jforster"
    
    // Remove first character (first name initial) if it looks like firstname+lastname
    if (lastName.length > 1) {
      lastName = lastName.slice(1) // Remove first character: "jforster" → "forster"
    }
    
    const result = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
    console.log(`  Email format → "${result}"`)
    return result
  }
  
  // Handle "Approver, Keith Clark" format
  if (input.includes(',')) {
    const parts = input.split(',').map(p => p.trim())
    if (parts.length >= 2) {
      const namePart = parts[1] // "Keith Clark"
      const nameWords = namePart.trim().split(/\s+/)
      const result = nameWords[nameWords.length - 1] // "Clark"
      console.log(`  Comma format → "${result}"`)
      return result
    }
  }
  
  // Handle "Keith Clark" or "Jforster" format
  const nameWords = input.trim().split(/\s+/)
  if (nameWords.length > 1) {
    // Multiple words - take last one
    const result = nameWords[nameWords.length - 1]
    console.log(`  Multiple words → "${result}"`)
    return result
  } else {
    // Single word - capitalize properly
    const result = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase()
    console.log(`  Single word → "${result}"`)
    return result
  }
}

// Interface for Smartsheet project data
interface SmartsheetProjectRow {
  id: number
  cells: {
    columnId: number
    value?: string
    displayValue?: string
  }[]
}

// Interface for Smartsheet WBS data
interface SmartsheetWbsRow {
  id: number
  cells: {
    columnId: number
    value?: string
    displayValue?: string
  }[]
}

// Column mapping configuration - this would need to be configured based on their actual Smartsheet
// For now using column titles, but in production these would be column IDs for better performance
const PROJECT_COLUMN_MAPPING = {
  projectCode: 'Project Code',
  title: 'Project Name',
  description: 'Description',
  category: 'Category',
  approverEmail: 'Approver Email',
  assigneeEmail: 'Assignee Email',
  status: 'Status',
  budget: 'Budget',
  startDate: 'Start Date',
  endDate: 'End Date'
}

const WBS_COLUMN_MAPPING = {
  name: 'Name', // Based on your actual columns - it's "Name", not "Task Name"
  description: 'Description',
  ownerLastName: 'Assigned To', // Person assigned to work on this task
  approverLastName: 'Approver', // Person who approves this (like Privette in your example)
  status: 'Status',
  startDate: 'Start Date',
  endDate: 'End Date',
  budget: 'Budget',
  actual: 'Actual',
  variance: 'Variance',
  notes: 'Notes',
  atRisk: 'At Risk',
  orderIndex: 'Row ID', // Using "Row ID" from your actual columns
  projectCode: 'Project Code' // Will be extracted from row hierarchy or separate column
}

// Alternative column names to try if primary mapping fails
const ALTERNATIVE_COLUMN_NAMES = {
  name: ['Name', 'Task Name', 'Task', 'Item'], // "Name" is primary based on actual columns
  ownerLastName: ['Assigned To', 'Owner', 'Assignee', 'Responsible'],
  approverLastName: ['Approver', 'Approved By', 'Review By'],
  status: ['Status', 'State', 'Progress'],
  startDate: ['Start Date', 'Start', 'Begin Date'],
  endDate: ['End Date', 'End', 'Finish Date', 'Due Date'],
  orderIndex: ['Row ID', 'Row #', 'Order', 'Index', 'Sequence'] // "Row ID" is primary
}

/**
 * Sync projects from Smartsheet to the database
 * This function would be called periodically or on-demand to import project data
 */
export async function syncProjectsFromSmartsheet(sheetId: string) {
  try {
    console.log(`Starting project sync from Smartsheet sheet: ${sheetId}`)

    // Check if Smartsheet access token is configured
    if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
      throw new Error('Smartsheet access token not configured')
    }

    // Get all rows from the projects sheet
    const sheetData = await SmartsheetAPI.getSheet(parseInt(sheetId))

    if (!sheetData.rows) {
      console.log('No rows found in Smartsheet')
      return { success: true, message: 'No rows to sync' }
    }

    let syncedCount = 0
    let errorCount = 0

    for (const row of sheetData.rows) {
      try {
        // Extract project data from Smartsheet row
        const projectData = extractProjectDataFromRow(row, sheetData.columns)

        if (!projectData.projectCode) {
          console.log(`Skipping row ${row.id} - no project code found`)
          continue
        }

        // Check if project already exists
        const existingProject = await prisma.project.findUnique({
          where: { projectCode: projectData.projectCode }
        })

        if (existingProject) {
          // Update existing project
          await prisma.project.update({
            where: { projectCode: projectData.projectCode },
            data: {
              ...projectData,
              portfolioRowId: row.id.toString(),
              lastUpdateAt: new Date()
            }
          })
        } else {
          // Create new project
          await prisma.project.create({
            data: {
              ...projectData,
              portfolioRowId: row.id.toString(),
              createdById: null // Will be set when a user claims it
            }
          })
        }

        syncedCount++
      } catch (error) {
        console.error(`Error syncing row ${row.id}:`, error)
        errorCount++
      }
    }

    console.log(`Project sync completed: ${syncedCount} synced, ${errorCount} errors`)
    return {
      success: true,
      message: `Synced ${syncedCount} projects with ${errorCount} errors`,
      syncedCount,
      errorCount
    }

  } catch (error) {
    console.error('Error syncing projects from Smartsheet:', error)
    return {
      success: false,
      message: 'Failed to sync projects from Smartsheet',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Extract project code from task name or hierarchy
 * Handles formats like "P-0010", "WBS (#P-0010)", etc.
 */
function extractProjectCodeFromName(name: string, parentRows: any[] = []): string | null {
  // Direct project code patterns
  const projectCodePatterns = [
    /^([A-Z]+-\d+)/,           // P-0010 at start
    /\(#([A-Z]+-\d+)\)/,       // (#P-0010) in parentheses
    /WBS\s*\(#([A-Z]+-\d+)\)/, // WBS (#P-0010)
    /\b([A-Z]+-\d+)\b/         // Any P-0010 pattern
  ]

  for (const pattern of projectCodePatterns) {
    const match = name.match(pattern)
    if (match) {
      return match[1]
    }
  }

  // If no direct match, check parent rows for project code
  for (const parent of parentRows) {
    const parentCode = extractProjectCodeFromName(parent.name || '')
    if (parentCode) {
      return parentCode
    }
  }

  return null
}

/**
 * Sync WBS tasks from Smartsheet to the database
 */
export async function syncWbsFromSmartsheet(sheetId: string, projectCodeFromFolder?: string) {
  try {
    console.log(`Starting WBS sync from Smartsheet sheet: ${sheetId}`)
    if (projectCodeFromFolder) {
      console.log(`Using project code from folder: ${projectCodeFromFolder}`)
    }

    // Check if Smartsheet access token is configured
    if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
      throw new Error('Smartsheet access token not configured')
    }

    // Get all rows from the WBS sheet
    const sheetData = await SmartsheetAPI.getSheet(parseInt(sheetId))
    const wbsSheetUrl = `https://app.smartsheet.com/sheets/${sheetId}`

    if (!sheetData.rows) {
      console.log('No WBS rows found in Smartsheet')
      return { success: true, message: 'No WBS rows to sync' }
    }

    let syncedCount = 0
    let errorCount = 0

    // Build a map of rows for hierarchy lookup
    const rowMap: { [key: string]: any } = {}
    sheetData.rows.forEach(row => {
      rowMap[row.id] = row
    })

    for (const row of sheetData.rows) {
      try {
        // Extract WBS data from Smartsheet row
        const wbsData = extractWbsDataFromRow(row, sheetData.columns)

        if (!wbsData.name) {
          console.log(`Skipping WBS row ${row.id} - missing task name`)
          continue
        }

        // Use project code from folder context first, then try to extract from task
        let projectCode = projectCodeFromFolder
        if (!projectCode) {
          projectCode = wbsData.projectCode
          if (!projectCode) {
            // Build parent chain for hierarchy lookup
            const parentChain = []
            let currentRow = row
            while (currentRow.parentId && rowMap[currentRow.parentId]) {
              const parent = rowMap[currentRow.parentId]
              parentChain.push(parent)
              currentRow = parent
            }
            
            projectCode = extractProjectCodeFromName(wbsData.name, parentChain)
          }
        }

        if (!projectCode) {
          console.log(`Skipping WBS row ${row.id} - could not determine project code from "${wbsData.name}"`)
          continue
        }

        wbsData.projectCode = projectCode

        // Find the project by project code
        let project = await prisma.project.findUnique({
          where: { projectCode: wbsData.projectCode }
        })

        if (!project) {
          console.log(`Creating project ${wbsData.projectCode} for WBS tasks`)
          project = await prisma.project.create({
            data: {
              projectCode: wbsData.projectCode,
              title: `Project ${wbsData.projectCode}`,
              description: `Auto-created from WBS sync`,
              status: 'Not_Started',
              category: 'General',
              wbsSheetId: sheetId,
              wbsSheetUrl: wbsSheetUrl,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
          console.log(`✅ Created project: ${wbsData.projectCode}`)
        } else if (!project.wbsSheetId) {
          // Update existing project with WBS sheet info if not already set
          project = await prisma.project.update({
            where: { id: project.id },
            data: {
              wbsSheetId: sheetId,
              wbsSheetUrl: wbsSheetUrl,
              updatedAt: new Date()
            }
          })
          console.log(`✅ Linked WBS sheet to project: ${wbsData.projectCode}`)
        }

        // Remove projectCode from wbsData since it's not a column in our database
        delete wbsData.projectCode

        // Convert data types to match database schema
        if (wbsData.budget !== undefined && wbsData.budget !== null) {
          wbsData.budget = wbsData.budget.toString()
        }
        if (wbsData.actual !== undefined && wbsData.actual !== null) {
          wbsData.actual = wbsData.actual.toString()
        }
        if (wbsData.variance !== undefined && wbsData.variance !== null) {
          wbsData.variance = wbsData.variance.toString()
        }

        // Extract last name from various formats
        if (wbsData.ownerLastName && typeof wbsData.ownerLastName === 'string') {
          wbsData.ownerLastName = extractLastName(wbsData.ownerLastName)
        }

        if (wbsData.approverLastName && typeof wbsData.approverLastName === 'string') {
          wbsData.approverLastName = extractLastName(wbsData.approverLastName)
        }

        // Check if WBS task already exists
        const existingWbs = await prisma.wbsCache.findFirst({
          where: {
            projectId: project.id,
            smartsheetRowId: row.id.toString()
          }
        })

        if (existingWbs) {
          // Update existing WBS task
          await prisma.wbsCache.update({
            where: { id: existingWbs.id },
            data: {
              ...wbsData,
              lastSyncedAt: new Date()
            }
          })
        } else {
          // Create new WBS task
          await prisma.wbsCache.create({
            data: {
              ...wbsData,
              projectId: project.id,
              smartsheetRowId: row.id.toString()
            }
          })
        }

        syncedCount++
      } catch (error) {
        console.error(`Error syncing WBS row ${row.id}:`, error)
        errorCount++
      }
    }

    console.log(`WBS sync completed: ${syncedCount} synced, ${errorCount} errors`)
    return {
      success: true,
      message: `Synced ${syncedCount} WBS tasks with ${errorCount} errors`,
      syncedCount,
      errorCount
    }

  } catch (error) {
    console.error('Error syncing WBS from Smartsheet:', error)
    return {
      success: false,
      message: 'Failed to sync WBS from Smartsheet',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Extract project data from a Smartsheet row
 */
function extractProjectDataFromRow(row: SmartsheetProjectRow, columns: any[]): Partial<any> {
  const projectData: any = {}

  // Create a map of column titles to their IDs
  const columnMap: { [key: string]: number } = {}
  columns.forEach(col => {
    columnMap[col.title] = col.id
  })

  // Extract values from cells using the mapping
  row.cells.forEach(cell => {
    const columnTitle = Object.keys(columnMap).find(title => columnMap[title] === cell.columnId)

    if (columnTitle === PROJECT_COLUMN_MAPPING.projectCode) {
      projectData.projectCode = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.title) {
      projectData.title = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.description) {
      projectData.description = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.category) {
      projectData.category = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.approverEmail) {
      projectData.approverEmail = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.assigneeEmail) {
      projectData.assigneeEmail = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.status) {
      const statusValue = cell.value || cell.displayValue
      projectData.status = mapSmartsheetStatusToEnum(statusValue)
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.budget) {
      projectData.budget = cell.value || cell.displayValue
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.startDate) {
      const dateValue = cell.value || cell.displayValue
      if (dateValue) projectData.startDate = new Date(dateValue)
    }
    if (columnTitle === PROJECT_COLUMN_MAPPING.endDate) {
      const dateValue = cell.value || cell.displayValue
      if (dateValue) projectData.endDate = new Date(dateValue)
    }
  })

  return projectData
}

/**
 * Extract WBS data from a Smartsheet row
 */
function extractWbsDataFromRow(row: SmartsheetWbsRow, columns: any[]): Partial<any> {
  const wbsData: any = {}

  // Log available columns for the first row
  if (row.rowNumber === 1) {
    console.log('📋 Available columns in WBS sheet:')
    columns.forEach(col => console.log(`  - "${col.title}" (ID: ${col.id})`))
  }

  // Create a map of column titles to their IDs
  const columnMap: { [key: string]: number } = {}
  columns.forEach(col => {
    columnMap[col.title] = col.id
  })

  // Extract values from cells using the mapping
  row.cells.forEach(cell => {
    const columnTitle = Object.keys(columnMap).find(title => columnMap[title] === cell.columnId)

    if (columnTitle === WBS_COLUMN_MAPPING.name) {
      wbsData.name = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.description) {
      wbsData.description = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.ownerLastName) {
      wbsData.ownerLastName = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.approverLastName) {
      wbsData.approverLastName = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.status) {
      const statusValue = cell.value || cell.displayValue
      wbsData.status = mapSmartsheetStatusToEnum(statusValue)
    }
    if (columnTitle === WBS_COLUMN_MAPPING.startDate) {
      const dateValue = cell.value || cell.displayValue
      if (dateValue) wbsData.startDate = new Date(dateValue)
    }
    if (columnTitle === WBS_COLUMN_MAPPING.endDate) {
      const dateValue = cell.value || cell.displayValue
      if (dateValue) wbsData.endDate = new Date(dateValue)
    }
    if (columnTitle === WBS_COLUMN_MAPPING.budget) {
      wbsData.budget = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.actual) {
      wbsData.actual = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.variance) {
      wbsData.variance = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.notes) {
      wbsData.notes = cell.value || cell.displayValue
    }
    if (columnTitle === WBS_COLUMN_MAPPING.atRisk) {
      wbsData.atRisk = cell.value === 'true' || cell.displayValue?.toLowerCase() === 'yes'
    }
    if (columnTitle === WBS_COLUMN_MAPPING.projectCode) {
      wbsData.projectCode = cell.value || cell.displayValue
    }
  })

  return wbsData
}

/**
 * Map Smartsheet status values to our ProjectStatus enum
 */
function mapSmartsheetStatusToEnum(statusValue?: string): string {
  if (!statusValue) return 'Not_Started'

  const status = statusValue.toLowerCase()
  if (status.includes('complete') || status.includes('done')) return 'Complete'
  if (status.includes('progress') || status.includes('in progress')) return 'In_Progress'
  if (status.includes('blocked') || status.includes('stuck')) return 'Blocked'
  if (status.includes('risk') || status.includes('at risk')) return 'At_Risk'
  if (status.includes('not started') || status.includes('pending')) return 'Not_Started'

  return 'Not_Started' // default
}

/**
 * Sync all data from Smartsheet
 * This is a convenience function that syncs both projects and WBS data
 */
export async function syncAllFromSmartsheet(projectsSheetId: string, wbsSheetId: string) {
  console.log('Starting full sync from Smartsheet...')

  // Sync projects first
  const projectResult = await syncProjectsFromSmartsheet(projectsSheetId)

  if (!projectResult.success) {
    return projectResult
  }

  // Sync WBS tasks from the WBS sheet
  const wbsResult = await syncWbsFromSmartsheet(wbsSheetId)

  return {
    success: true,
    message: `Full sync completed: ${projectResult.syncedCount} projects, ${wbsResult.syncedCount || 0} WBS tasks`,
    projectResult,
    wbsResult
  }
}
