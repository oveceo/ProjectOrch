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
  parentId?: number  // For hierarchy support
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
  skipWbs: 'Skip WBS', // Skip WBS checkbox - marks header rows
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
          const projectCode = projectData.projectCode || `P-${row.id}`
          const projectTitle = projectData.title || projectCode

          await prisma.project.create({
            data: {
              projectCode,
              title: projectTitle,
              description: projectData.description || null,
              category: projectData.category || null,
              approverEmail: projectData.approverEmail || null,
              assigneeEmail: projectData.assigneeEmail || null,
              approvalStatus: projectData.approvalStatus || 'Pending_Approval',
              status: projectData.status || 'Not_Started',
              budget: projectData.budget ? String(projectData.budget) : null,
              startDate: projectData.startDate || null,
              endDate: projectData.endDate || null,
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
    
    // Track all projects that were synced for metadata extraction
    const syncedProjects = new Map<string, { id: string; projectCode: string }>()

    // Build a map of rows for hierarchy lookup
    const rowMap: { [key: string]: any } = {}
    sheetData.rows.forEach(row => {
      rowMap[row.id] = row
    })

    for (let rowIndex = 0; rowIndex < sheetData.rows.length; rowIndex++) {
      const row = sheetData.rows[rowIndex]
      try {
        // Extract WBS data from Smartsheet row
        const wbsData = extractWbsDataFromRow(row, sheetData.columns)

        if (!wbsData.name) {
          console.log(`Skipping WBS row ${row.id} - missing task name`)
          continue
        }

        // Use project code from folder context first, then try to extract from task
        let projectCode: string | undefined = projectCodeFromFolder || wbsData.projectCode || undefined
        if (!projectCode) {
          // Build parent chain for hierarchy lookup
          const parentChain = []
          let currentRow = row
          while (currentRow.parentId && rowMap[currentRow.parentId]) {
            const parent = rowMap[currentRow.parentId]
            parentChain.push(parent)
            currentRow = parent
          }
          
          const extracted = extractProjectCodeFromName(wbsData.name, parentChain)
          projectCode = extracted || undefined
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
        
        // Track this project for metadata extraction after the loop
        if (!syncedProjects.has(project.projectCode)) {
          syncedProjects.set(project.projectCode, { id: project.id, projectCode: project.projectCode })
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
          const name = wbsData.name || `Task ${row.id}`
          const status = (wbsData.status as any) || 'Not_Started'
          const atRisk = wbsData.atRisk ?? false
          const skipWbs = wbsData.skipWbs ?? false
          // Use row index for proper ordering
          const orderIndex = rowIndex
          const parentRowId = row.parentId ? row.parentId.toString() : null

          await prisma.wbsCache.create({
            data: {
              ...wbsData,
              name,
              status,
              atRisk,
              skipWbs,
              orderIndex,
              parentRowId,
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

    // After syncing all WBS items, extract project metadata from special rows
    // Row structure in Smartsheet:
    //   Row 1: Project code (P-XXXX), Approver in "Assigned To" column
    //   Row 2: Project name (like "* Unit Zone Prediction ML Application *"), Owner in "Assigned To" column
    //   Row 3+: WBS items (phases, tasks, subtasks)
    
    // Process metadata for all synced projects
    const projectEntries = Array.from(syncedProjects.entries())
    for (const [projectCode, projectInfo] of projectEntries) {
      try {
        // Get all synced items for this project
        const syncedItems = await prisma.wbsCache.findMany({
          where: { projectId: projectInfo.id },
          orderBy: { orderIndex: 'asc' }
        })

        // Find Row 1 - the project code row (has P-XXXX pattern)
        const projectCodeRow = syncedItems.find(item => 
          item.name && 
          (item.name.startsWith('P-') || item.name === projectCode)
        )

        // Find Row 2 - the project name row (skipWbs=true, not a P-code, should be second row)
        const projectNameRow = syncedItems.find(item => 
          item.skipWbs && 
          item.name && 
          !item.name.startsWith('P-') && 
          item.name !== projectCode
        )

        // Build update data from the project rows
        const projectUpdateData: any = {}

        // Get APPROVER from Row 1's "Assigned To" field
        // The format is "Approver, Keith Clark" - stored in ownerLastName after extraction
        if (projectCodeRow?.ownerLastName) {
          projectUpdateData.approverLastName = projectCodeRow.ownerLastName
          console.log(`Extracted approver: ${projectCodeRow.ownerLastName} from project code row`)
        }

        // Get PROJECT OWNER from Row 2's "Assigned To" field
        if (projectNameRow) {
          // Clean up the title (remove asterisks and extra spaces)
          const cleanTitle = projectNameRow.name.replace(/^\*+\s*|\s*\*+$/g, '').trim()
          if (cleanTitle) {
            projectUpdateData.title = cleanTitle
            console.log(`Extracted project title: ${cleanTitle}`)
          }

          // The owner is in Row 2's "Assigned To"
          if (projectNameRow.ownerLastName) {
            projectUpdateData.ownerLastName = projectNameRow.ownerLastName
            console.log(`Extracted project owner: ${projectNameRow.ownerLastName}`)
          }

          // Copy over financial and timeline data from the project name row
          if (projectNameRow.budget) projectUpdateData.budget = projectNameRow.budget
          if (projectNameRow.actual) projectUpdateData.actual = projectNameRow.actual
          if (projectNameRow.variance) projectUpdateData.variance = projectNameRow.variance
          if (projectNameRow.startDate) projectUpdateData.startDate = projectNameRow.startDate
          if (projectNameRow.endDate) projectUpdateData.endDate = projectNameRow.endDate
          if (projectNameRow.status) projectUpdateData.status = projectNameRow.status
          if (projectNameRow.description) projectUpdateData.description = projectNameRow.description
        }

        // Update project if we have any new metadata
        if (Object.keys(projectUpdateData).length > 0) {
          await prisma.project.update({
            where: { id: projectInfo.id },
            data: projectUpdateData
          })
          console.log(`✅ Updated project ${projectCode} with metadata:`, Object.keys(projectUpdateData))
        }
      } catch (metadataError) {
        console.error(`Error extracting project metadata for ${projectCode}:`, metadataError)
        // Don't fail the sync if metadata extraction fails
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

  // Log available columns for the first row (skip rowNumber, not in type)

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
    if (columnTitle === WBS_COLUMN_MAPPING.skipWbs) {
      wbsData.skipWbs = cell.value === true || cell.value === 'true' || cell.displayValue?.toLowerCase() === 'yes'
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
