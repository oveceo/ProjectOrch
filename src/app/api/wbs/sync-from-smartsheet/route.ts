import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'

// POST /api/wbs/sync-from-smartsheet - Sync WBS data from Smartsheet with hierarchy support
export async function POST(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    const userLastName = authHeader.replace('Bearer ', '')
    if (!userLastName || userLastName === 'undefined') {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sheetId, projectId } = body

    if (!sheetId || !projectId) {
      return NextResponse.json(
        { error: 'Sheet ID and Project ID are required' },
        { status: 400 }
      )
    }

    // Check user permissions
    const isAdmin = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette', 'Adams', 'Allen'].includes(userLastName)

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied to sync WBS data' },
        { status: 403 }
      )
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    console.log(`Starting WBS sync from Smartsheet ${sheetId} to project ${project.projectCode}`)

    // Get sheet data from Smartsheet
    const sheet = await SmartsheetAPI.getSheet(parseInt(sheetId))
    
    if (!sheet.rows || sheet.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No rows found in Smartsheet',
        syncedCount: 0
      })
    }

    // Clear existing WBS cache for this project
    await prisma.wbsCache.deleteMany({
      where: { projectId }
    })

    const syncedTasks = await syncWbsHierarchy(sheet, projectId, project.projectCode)

    console.log(`✅ WBS sync completed: ${syncedTasks.length} tasks synced`)

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedTasks.length} WBS tasks`,
      syncedCount: syncedTasks.length,
      tasks: syncedTasks
    })

  } catch (error) {
    console.error('Error syncing WBS from Smartsheet:', error)
    return NextResponse.json(
      { error: 'Internal server error during sync' },
      { status: 500 }
    )
  }
}

/**
 * Sync WBS hierarchy from Smartsheet to database
 */
async function syncWbsHierarchy(sheet: any, projectId: string, projectCode: string) {
  const rows = sheet.rows
  const columns = sheet.columns
  const syncedTasks = []

  // First pass: Create all tasks without parent relationships
  const taskMap = new Map() // Maps Smartsheet row ID to database task ID
  const wbsCodeMap = new Map() // Maps WBS codes to database task IDs

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    // Extract task data
    const taskData = extractWbsTaskData(row, columns, projectId, i)
    
    if (!taskData.name || !taskData.name.trim()) {
      console.log(`Skipping row ${row.id} - no task name`)
      continue
    }

    // Skip the header row that contains project code
    if (taskData.wbsCode === projectCode) {
      console.log(`Skipping project header row: ${taskData.name}`)
      continue
    }

    try {
      // Create task in database
      const createdTask = await prisma.wbsCache.create({
        data: {
          projectId,
          smartsheetRowId: row.id.toString(),
          name: taskData.name,
          description: taskData.description || null,
          ownerLastName: taskData.ownerLastName || null,
          approverLastName: taskData.approverLastName || null,
          status: taskData.status || 'Not_Started',
          startDate: taskData.startDate || null,
          endDate: taskData.endDate || null,
          budget: taskData.budget || null,
          actual: taskData.actual || null,
          variance: taskData.variance || null,
          notes: taskData.notes || null,
          atRisk: taskData.atRisk || false,
          orderIndex: i,
          parentId: null, // Will be set in second pass
          lastSyncedAt: new Date()
        }
      })

      taskMap.set(row.id, createdTask.id)
      if (taskData.wbsCode) {
        wbsCodeMap.set(taskData.wbsCode, createdTask.id)
      }
      syncedTasks.push(createdTask)

      console.log(`Created task: ${taskData.wbsCode} - ${taskData.name}`)

    } catch (error) {
      console.error(`Error creating task for row ${row.id}:`, error)
    }
  }

  // Second pass: Set parent relationships based on Smartsheet hierarchy
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const taskId = taskMap.get(row.id)
    
    if (!taskId) continue

    let parentTaskId = null

    // Use Smartsheet's built-in parent relationship
    if (row.parentId && taskMap.has(row.parentId)) {
      parentTaskId = taskMap.get(row.parentId)
    } else {
      // Fallback: Parse WBS code for hierarchy (1.1 -> parent is 1)
      const taskData = extractWbsTaskData(row, columns, projectId, i)
      if (taskData.wbsCode && taskData.wbsCode.includes('.')) {
        const parentWbsCode = getParentWbsCode(taskData.wbsCode)
        if (parentWbsCode && wbsCodeMap.has(parentWbsCode)) {
          parentTaskId = wbsCodeMap.get(parentWbsCode)
        }
      }
    }

    // Update parent relationship
    if (parentTaskId) {
      await prisma.wbsCache.update({
        where: { id: taskId },
        data: { parentId: parentTaskId }
      })
      console.log(`Set parent relationship: ${taskId} -> ${parentTaskId}`)
    }
  }

  return syncedTasks
}

/**
 * Extract WBS task data from Smartsheet row
 */
function extractWbsTaskData(row: any, columns: any[], projectId: string, orderIndex: number) {
  const taskData: any = {}

  // Get WBS code
  const wbsValue = SmartsheetAPI.getCellValue(row, columns, 'WBS')
  taskData.wbsCode = wbsValue

  // Get task name
  taskData.name = SmartsheetAPI.getCellValue(row, columns, 'Name')
  
  // Get other fields
  taskData.description = SmartsheetAPI.getCellValue(row, columns, 'Description')
  taskData.ownerLastName = SmartsheetAPI.getCellValue(row, columns, 'Assigned To')
  taskData.approverLastName = SmartsheetAPI.getCellValue(row, columns, 'Approver')
  
  // Map status
  const statusValue = SmartsheetAPI.getCellValue(row, columns, 'Status')
  taskData.status = mapSmartsheetStatus(statusValue)
  
  // Get dates
  const startDate = SmartsheetAPI.getCellValue(row, columns, 'Start Date')
  const endDate = SmartsheetAPI.getCellValue(row, columns, 'End Date')
  
  if (startDate) {
    taskData.startDate = new Date(startDate)
  }
  if (endDate) {
    taskData.endDate = new Date(endDate)
  }
  
  // Get financial data
  taskData.budget = SmartsheetAPI.getCellValue(row, columns, 'Budget')
  taskData.actual = SmartsheetAPI.getCellValue(row, columns, 'Actual')
  taskData.variance = SmartsheetAPI.getCellValue(row, columns, 'Variance')
  
  // Get other fields
  taskData.notes = SmartsheetAPI.getCellValue(row, columns, 'Notes')
  taskData.atRisk = SmartsheetAPI.getCellValue(row, columns, 'At Risk') === true

  return taskData
}

/**
 * Map Smartsheet status to our enum
 */
function mapSmartsheetStatus(status: string): string {
  if (!status) return 'Not_Started'
  
  const normalizedStatus = status.toLowerCase().trim()
  
  switch (normalizedStatus) {
    case 'not started':
    case 'not_started':
      return 'Not_Started'
    case 'in progress':
    case 'in_progress':
      return 'In_Progress'
    case 'complete':
    case 'completed':
      return 'Complete'
    case 'approval pending':
    case 'approval_pending':
      return 'Approval_Pending'
    case 'approved':
      return 'Approved'
    case 'on hold':
    case 'on_hold':
      return 'On_Hold'
    default:
      return 'Not_Started'
  }
}

/**
 * Get parent WBS code from a hierarchical WBS code
 * E.g., "1.1.1" -> "1.1", "1.1" -> "1"
 */
function getParentWbsCode(wbsCode: string): string | null {
  if (!wbsCode || !wbsCode.includes('.')) {
    return null
  }
  
  const parts = wbsCode.split('.')
  if (parts.length <= 1) {
    return null
  }
  
  // Remove the last part to get parent
  parts.pop()
  return parts.join('.')
}
