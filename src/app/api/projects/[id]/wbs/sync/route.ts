import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { logger, startTimer } from '@/lib/logger'
import { extractUserLastName } from '@/lib/validation'
import { ProjectStatus } from '@prisma/client'

const apiLogger = logger.child('api:project-wbs-sync')

interface RouteParams {
  params: Promise<{ id: string }>
}

// Status mapping from Smartsheet to app (only 4 valid statuses)
const STATUS_FROM_SMARTSHEET: Record<string, ProjectStatus> = {
  'Not Started': ProjectStatus.Not_Started,
  'In Progress': ProjectStatus.In_Progress,
  'Blocked': ProjectStatus.Blocked,
  'Complete': ProjectStatus.Complete,
  // Map any other values to closest valid status
  'On Hold': ProjectStatus.Not_Started,
  'At Risk': ProjectStatus.Blocked,
  'Approval Pending': ProjectStatus.In_Progress,
  'Approved': ProjectStatus.Complete
}

// POST /api/projects/[id]/wbs/sync - Full sync with Smartsheet
export async function POST(request: NextRequest, { params }: RouteParams) {
  const getElapsed = startTimer()
  const { id: projectId } = await params

  try {
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    apiLogger.info('Starting full WBS sync', { projectId, userLastName })

    // Get project with WBS sheet info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        title: true,
        wbsSheetId: true,
        wbsSheetUrl: true
      }
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    if (!project.wbsSheetId) {
      return NextResponse.json({ 
        success: false, 
        error: 'No Smartsheet configured',
        message: `Project ${project.projectCode} does not have a WBS sheet linked`
      }, { status: 400 })
    }

    const sheetId = parseInt(project.wbsSheetId)
    
    // Fetch full sheet from Smartsheet
    apiLogger.info('Fetching sheet from Smartsheet', { sheetId })
    const sheet = await SmartsheetAPI.getSheet(sheetId)
    const columns = sheet.columns
    const rows = sheet.rows

    apiLogger.info('Sheet fetched', { 
      sheetName: sheet.name, 
      columnCount: columns.length, 
      rowCount: rows.length 
    })

    // Clear existing WBS cache for this project
    await prisma.wbsCache.deleteMany({
      where: { projectId }
    })

    // Process all rows and insert
    const getValue = (row: any, columnTitle: string) => {
      return SmartsheetAPI.getCellValue(row, columns, columnTitle)
    }

    const wbsItems = []
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      
      // Get all possible column values
      const name = getValue(row, 'Name') || getValue(row, 'Task Name') || getValue(row, 'Task') || `Row ${index + 1}`
      const wbsNumber = getValue(row, 'WBS') || ''
      const description = getValue(row, 'Description') || null
      const assignedTo = getValue(row, 'Assigned To') || null
      const approver = getValue(row, 'Approver') || null
      const statusValue = getValue(row, 'Status') || 'Not Started'
      const startDate = getValue(row, 'Start Date')
      const endDate = getValue(row, 'End Date')
      const atRiskValue = getValue(row, 'At Risk')
      const budget = getValue(row, 'Budget')
      const actual = getValue(row, 'Actual')
      const variance = getValue(row, 'Variance')
      const notes = getValue(row, 'Notes')
      const skipWbsValue = getValue(row, 'Skip WBS')

      // Map status
      const status = STATUS_FROM_SMARTSHEET[statusValue] || ProjectStatus.Not_Started

      // Extract last names
      const ownerLastName = extractLastName(assignedTo)
      const approverLastName = extractLastName(approver)

      // Parse dates
      const parsedStartDate = parseDate(startDate)
      const parsedEndDate = parseDate(endDate)

      // Parse boolean values
      const atRisk = atRiskValue === true || atRiskValue === 'Yes' || atRiskValue === 'true'
      const skipWbs = skipWbsValue === true || skipWbsValue === 'Yes' || skipWbsValue === 'true'

      // Create WBS item
      const wbsItem = await prisma.wbsCache.create({
        data: {
          projectId,
          smartsheetRowId: String(row.id),
          parentRowId: row.parentId ? String(row.parentId) : null,
          name,
          description,
          ownerLastName,
          approverLastName,
          status,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          atRisk,
          budget: budget ? String(budget) : null,
          actual: actual ? String(actual) : null,
          variance: variance ? String(variance) : null,
          notes,
          skipWbs,
          orderIndex: index,
          lastSyncedAt: new Date()
        }
      })

      wbsItems.push({
        ...wbsItem,
        wbsNumber
      })
    }

    // Smartsheet structure:
    // Row 1: Project code (P-XXXX), Approver in "Assigned To" column
    // Row 2: Project name (like "* Unit Zone Prediction ML Application *"), Owner in "Assigned To" column
    // Row 3+: WBS items (phases, tasks, subtasks)
    
    // Find Row 1 - the project code row (has P-XXXX pattern)
    const projectCodeRow = wbsItems.find(item => 
      item.name && 
      (item.name.startsWith('P-') || item.name === project.projectCode)
    )
    
    // Find Row 2 - the project name row (skipWbs, not a P-code, root level)
    const projectNameRow = wbsItems.find(item => 
      item.skipWbs && 
      item.name && 
      !item.name.startsWith('P-') && 
      item.name !== project.projectCode
    )

    // Build update data from the project rows
    const projectUpdateData: any = {}

    // Get APPROVER from Row 1's "Assigned To" field
    // The format is "Approver, Keith Clark" - extract "Clark"
    if (projectCodeRow?.ownerLastName) {
      // The "Assigned To" on row 1 contains the approver
      projectUpdateData.approverLastName = projectCodeRow.ownerLastName
    }

    // Get PROJECT OWNER from Row 2's "Assigned To" field
    if (projectNameRow) {
      // Clean up the title (remove asterisks and extra spaces)
      const cleanTitle = projectNameRow.name.replace(/^\*+\s*|\s*\*+$/g, '').trim()
      if (cleanTitle && cleanTitle !== project.title) {
        projectUpdateData.title = cleanTitle
      }

      // The owner is in Row 2's "Assigned To"
      if (projectNameRow.ownerLastName) {
        projectUpdateData.ownerLastName = projectNameRow.ownerLastName
      }

      // Copy over financial and timeline data from the project name row
      if (projectNameRow.budget) {
        projectUpdateData.budget = projectNameRow.budget
      }
      if (projectNameRow.actual) {
        projectUpdateData.actual = projectNameRow.actual
      }
      if (projectNameRow.variance) {
        projectUpdateData.variance = projectNameRow.variance
      }
      if (projectNameRow.startDate) {
        projectUpdateData.startDate = projectNameRow.startDate
      }
      if (projectNameRow.endDate) {
        projectUpdateData.endDate = projectNameRow.endDate
      }
      if (projectNameRow.status) {
        projectUpdateData.status = projectNameRow.status
      }
      if (projectNameRow.description) {
        projectUpdateData.description = projectNameRow.description
      }
    }
    
    apiLogger.info('Extracted project data', {
      projectCode: project.projectCode,
      approverLastName: projectUpdateData.approverLastName,
      ownerLastName: projectUpdateData.ownerLastName,
      title: projectUpdateData.title
    })

    // Update project if we have any new data
    if (Object.keys(projectUpdateData).length > 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: projectUpdateData
      })
      apiLogger.info('Updated project data from WBS', { 
        projectId, 
        updatedFields: Object.keys(projectUpdateData)
      })
    }

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: `${userLastName}@ove.com`,
        action: 'SYNC_PROJECT_WBS_FROM_SMARTSHEET',
        targetType: 'Project',
        targetId: projectId,
        payload: JSON.stringify({
          sheetId,
          sheetName: sheet.name,
          itemCount: wbsItems.length,
          timestamp: new Date().toISOString()
        })
      }
    })

    apiLogger.info('WBS sync completed', {
      projectCode: project.projectCode,
      itemCount: wbsItems.length,
      duration: getElapsed()
    })

    return NextResponse.json({
      success: true,
      data: wbsItems,
      message: `Imported ${wbsItems.length} items from Smartsheet`,
      meta: {
        sheetName: sheet.name,
        sheetId,
        itemCount: wbsItems.length,
        syncedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    apiLogger.error('WBS sync failed', error as Error, { projectId })
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let userMessage = 'Failed to sync with Smartsheet'
    
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      userMessage = 'Smartsheet authentication failed. Check your API token.'
    } else if (errorMessage.includes('404')) {
      userMessage = 'Smartsheet sheet not found. The sheet may have been deleted.'
    } else if (errorMessage.includes('429')) {
      userMessage = 'Rate limit exceeded. Please wait and try again.'
    }

    return NextResponse.json({
      success: false,
      error: 'Sync failed',
      message: userMessage
    }, { status: 500 })
  }
}

// Helper: Extract last name from full name or email
function extractLastName(value: any): string | null {
  if (!value) return null
  const str = String(value).trim()
  
  // Handle "Approver, Keith Clark" format
  if (str.includes(',')) {
    const parts = str.split(',').map(p => p.trim())
    if (parts.length >= 2) {
      const namePart = parts[1] // "Keith Clark"
      const nameWords = namePart.split(/\s+/)
      const lastName = nameWords[nameWords.length - 1]
      return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
    }
  }
  
  // If it's an email (e.g., jforster@ovec.com), extract last name
  if (str.includes('@')) {
    const namePart = str.split('@')[0] // "jforster"
    // Check if it has dots (e.g., james.forster@)
    if (namePart.includes('.')) {
      const parts = namePart.split('.')
      const lastName = parts[parts.length - 1]
      return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
    }
    // Otherwise assume first letter is initial: jforster -> forster -> Forster
    const lastName = namePart.length > 1 ? namePart.slice(1) : namePart
    return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
  }
  
  // If it's a full name, get last word
  const parts = str.split(/\s+/)
  if (parts.length > 1) {
    const lastName = parts[parts.length - 1]
    return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
  }
  
  // Single word - just capitalize properly
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Helper: Parse date value
function parseDate(value: any): Date | null {
  if (!value) return null
  try {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}
