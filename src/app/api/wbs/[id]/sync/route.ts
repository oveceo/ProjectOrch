import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { logger, startTimer } from '@/lib/logger'
import { extractUserLastName } from '@/lib/validation'

const apiLogger = logger.child('api:wbs:sync')

interface RouteParams {
  params: Promise<{ id: string }>
}

// Status mapping from app to Smartsheet
const STATUS_TO_SMARTSHEET: Record<string, string> = {
  'Not_Started': 'Not Started',
  'In_Progress': 'In Progress',
  'Complete': 'Complete',
  'Approval_Pending': 'Approval Pending',
  'Approved': 'Approved',
  'On_Hold': 'On Hold',
  'Blocked': 'Blocked',
  'At_Risk': 'At Risk'
}

// POST /api/wbs/[id]/sync - Sync a WBS task to Smartsheet
export async function POST(request: NextRequest, { params }: RouteParams) {
  const getElapsed = startTimer()
  const { id } = await params

  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      apiLogger.warn('Unauthorized sync attempt', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required' 
        },
        { status: 401 }
      )
    }

    apiLogger.info('Starting Smartsheet sync', { taskId: id, userLastName })

    // Get the WBS task with project details
    const wbsTask = await prisma.wbsCache.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            wbsSheetId: true,
          }
        }
      }
    })

    if (!wbsTask) {
      apiLogger.warn('WBS task not found for sync', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'WBS task not found',
          message: `No task found with ID: ${id}`
        },
        { status: 404 }
      )
    }

    // Check if project has a WBS sheet
    if (!wbsTask.project.wbsSheetId) {
      apiLogger.warn('Project has no WBS sheet', { 
        taskId: id, 
        projectCode: wbsTask.project.projectCode 
      })
      return NextResponse.json(
        { 
          success: false,
          error: 'No Smartsheet configured',
          message: `Project ${wbsTask.project.projectCode} does not have a WBS sheet linked`
        },
        { status: 400 }
      )
    }

    // Check if task has a Smartsheet row ID
    if (!wbsTask.smartsheetRowId) {
      apiLogger.warn('WBS task has no Smartsheet row', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'Not linked to Smartsheet',
          message: 'This task is not linked to a Smartsheet row'
        },
        { status: 400 }
      )
    }

    const sheetId = parseInt(wbsTask.project.wbsSheetId)
    const rowId = parseInt(wbsTask.smartsheetRowId)

    // Get the sheet to find column IDs
    apiLogger.debug('Fetching Smartsheet columns', { sheetId })
    const sheet = await SmartsheetAPI.getSheet(sheetId)
    const columns = sheet.columns

    // Build update cells array
    const cells: any[] = []

    // Map fields to columns
    const fieldMappings: Record<string, string> = {
      'name': 'Name',
      'description': 'Description',
      'ownerLastName': 'Assigned To',
      'approverLastName': 'Approver',
      'status': 'Status',
      'startDate': 'Start Date',
      'endDate': 'End Date',
      'budget': 'Budget',
      'actual': 'Actual',
      'variance': 'Variance',
      'notes': 'Notes',
      'atRisk': 'At Risk'
    }

    for (const [field, columnTitle] of Object.entries(fieldMappings)) {
      const column = SmartsheetAPI.findColumnByTitle(columns, columnTitle)
      if (!column) continue

      let value: any = wbsTask[field as keyof typeof wbsTask]

      // Transform values as needed
      if (field === 'status' && value) {
        value = STATUS_TO_SMARTSHEET[value] || value
      }
      if (field === 'atRisk') {
        value = value ? 'Yes' : 'No'
      }
      if ((field === 'startDate' || field === 'endDate') && value) {
        value = new Date(value).toISOString().split('T')[0]
      }

      if (value !== null && value !== undefined) {
        cells.push(SmartsheetAPI.createCell(column.id, value))
      }
    }

    if (cells.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No fields to sync',
          message: 'No mappable fields found for Smartsheet sync'
        },
        { status: 400 }
      )
    }

    // Update the row in Smartsheet
    apiLogger.info('Updating Smartsheet row', { sheetId, rowId, cellCount: cells.length })
    
    await SmartsheetAPI.updateRows(sheetId, [{
      id: rowId,
      cells
    }])

    // Update lastSyncedAt
    await prisma.wbsCache.update({
      where: { id },
      data: { lastSyncedAt: new Date() }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: `${userLastName}@ove.com`,
        action: 'SYNC_WBS_TO_SMARTSHEET',
        targetType: 'WbsCache',
        targetId: id,
        payload: {
          sheetId,
          rowId,
          fieldsUpdated: Object.keys(fieldMappings).filter(f => 
            wbsTask[f as keyof typeof wbsTask] !== null && 
            wbsTask[f as keyof typeof wbsTask] !== undefined
          ),
          timestamp: new Date().toISOString()
        }
      }
    })

    apiLogger.info('Smartsheet sync completed successfully', { 
      taskId: id,
      sheetId,
      rowId,
      duration: getElapsed()
    })

    return NextResponse.json({ 
      success: true,
      message: 'Changes synced to Smartsheet successfully',
      data: {
        taskId: id,
        sheetId,
        rowId,
        syncedAt: new Date().toISOString(),
        fieldsUpdated: cells.length
      }
    })

  } catch (error) {
    apiLogger.error('Smartsheet sync failed', error as Error, { taskId: id })
    
    // Provide specific error messages for common issues
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let userMessage = 'Failed to sync to Smartsheet. Please try again later.'
    
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      userMessage = 'Smartsheet authentication failed. Please contact IT support.'
    } else if (errorMessage.includes('404')) {
      userMessage = 'Smartsheet row not found. The task may have been deleted from Smartsheet.'
    } else if (errorMessage.includes('429')) {
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Sync failed',
        message: userMessage
      },
      { status: 500 }
    )
  }
}
