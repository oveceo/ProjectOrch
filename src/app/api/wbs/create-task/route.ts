import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'

// POST /api/wbs/create-task - Create new WBS task and sync to Smartsheet
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
    const { 
      projectId, 
      name, 
      description, 
      parentId,
      ownerLastName,
      approverLastName,
      status = 'Not_Started',
      startDate,
      endDate,
      budget,
      taskType = 'task' // 'phase', 'task', 'subtask'
    } = body

    // Validate required fields
    if (!projectId || !name?.trim()) {
      return NextResponse.json(
        { error: 'Project ID and task name are required' },
        { status: 400 }
      )
    }

    // Check user permissions
    const isAdmin = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette', 'Adams', 'Allen'].includes(userLastName)

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied to create WBS tasks' },
        { status: 403 }
      )
    }

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        title: true,
        wbsSheetId: true
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Generate WBS code based on hierarchy
    const wbsCode = await generateWbsCode(projectId, parentId, taskType)

    // Get the next order index
    const lastTask = await prisma.wbsCache.findFirst({
      where: { projectId },
      orderBy: { orderIndex: 'desc' }
    })

    const nextOrderIndex = (lastTask?.orderIndex || 0) + 1

    // Create task in database first
    const newTask = await prisma.wbsCache.create({
      data: {
        projectId,
        name: name.trim(),
        description: description?.trim() || null,
        parentId: parentId || null,
        ownerLastName: ownerLastName || null,
        approverLastName: approverLastName || null,
        status,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget: budget || null,
        orderIndex: nextOrderIndex,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            status: true,
            category: true
          }
        }
      }
    })

    console.log(`✅ WBS task created by ${userLastName}: ${wbsCode} - ${newTask.name}`)

    // If project has a Smartsheet WBS, sync the new task
    if (project.wbsSheetId) {
      try {
        const smartsheetRowId = await createTaskInSmartsheet(
          parseInt(project.wbsSheetId),
          {
            wbsCode,
            name: newTask.name,
            description: newTask.description,
            ownerLastName: newTask.ownerLastName,
            approverLastName: newTask.approverLastName,
            status: newTask.status,
            startDate: newTask.startDate,
            endDate: newTask.endDate,
            budget: newTask.budget,
            parentId
          },
          projectId
        )

        // Update task with Smartsheet row ID
        await prisma.wbsCache.update({
          where: { id: newTask.id },
          data: { 
            smartsheetRowId: smartsheetRowId.toString(),
            lastSyncedAt: new Date()
          }
        })

        console.log(`✅ Task synced to Smartsheet: Row ID ${smartsheetRowId}`)

      } catch (error) {
        console.error('Error syncing task to Smartsheet:', error)
        // Don't fail the whole operation if Smartsheet sync fails
      }
    }

    return NextResponse.json({
      ...newTask,
      wbsCode
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating WBS task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate WBS code based on hierarchy and existing tasks
 */
async function generateWbsCode(projectId: string, parentId: string | null, taskType: string): Promise<string> {
  if (!parentId) {
    // Top-level task (Phase): Find next phase number
    const existingPhases = await prisma.wbsCache.findMany({
      where: { 
        projectId,
        parentId: null
      },
      orderBy: { orderIndex: 'asc' }
    })

    const nextPhaseNumber = existingPhases.length + 1
    return nextPhaseNumber.toString()
  } else {
    // Child task: Get parent's WBS code and append
    const parent = await prisma.wbsCache.findUnique({
      where: { id: parentId }
    })

    if (!parent) {
      throw new Error('Parent task not found')
    }

    // Count existing children of this parent
    const siblings = await prisma.wbsCache.findMany({
      where: { 
        projectId,
        parentId: parentId
      },
      orderBy: { orderIndex: 'asc' }
    })

    const nextChildNumber = siblings.length + 1

    // If parent is a phase (e.g., "1"), child becomes "1.1"
    // If parent is already a task (e.g., "1.1"), child becomes "1.1.1"
    const parentWbsCode = await getTaskWbsCode(parentId)
    return `${parentWbsCode}.${nextChildNumber}`
  }
}

/**
 * Get WBS code for a task (either from database or generate)
 */
async function getTaskWbsCode(taskId: string): Promise<string> {
  const task = await prisma.wbsCache.findUnique({
    where: { id: taskId }
  })

  if (!task) {
    throw new Error('Task not found')
  }

  // If task doesn't have a parent, it's a phase
  if (!task.parentId) {
    return task.orderIndex?.toString() || '1'
  }

  // Build WBS code from hierarchy
  const parentWbsCode = await getTaskWbsCode(task.parentId)
  const siblings = await prisma.wbsCache.findMany({
    where: { 
      projectId: task.projectId,
      parentId: task.parentId
    },
    orderBy: { orderIndex: 'asc' }
  })

  const taskPosition = siblings.findIndex(s => s.id === taskId) + 1
  return `${parentWbsCode}.${taskPosition}`
}

/**
 * Create task in Smartsheet
 */
async function createTaskInSmartsheet(
  sheetId: number,
  taskData: any,
  projectId: string
): Promise<number> {
  try {
    // Get sheet structure
    const sheet = await SmartsheetAPI.getSheet(sheetId)
    
    // Find column IDs
    const columnIds = {
      wbs: SmartsheetAPI.findColumnByTitle(sheet.columns, 'WBS')?.id,
      name: SmartsheetAPI.findColumnByTitle(sheet.columns, 'Name')?.id,
      description: SmartsheetAPI.findColumnByTitle(sheet.columns, 'Description')?.id,
      assignedTo: SmartsheetAPI.findColumnByTitle(sheet.columns, 'Assigned To')?.id,
      status: SmartsheetAPI.findColumnByTitle(sheet.columns, 'Status')?.id,
      startDate: SmartsheetAPI.findColumnByTitle(sheet.columns, 'Start Date')?.id,
      endDate: SmartsheetAPI.findColumnByTitle(sheet.columns, 'End Date')?.id,
      budget: SmartsheetAPI.findColumnByTitle(sheet.columns, 'Budget')?.id
    }

    // Build cells array
    const cells = []
    
    if (columnIds.wbs) {
      cells.push({ columnId: columnIds.wbs, value: taskData.wbsCode })
    }
    if (columnIds.name) {
      cells.push({ columnId: columnIds.name, value: taskData.name })
    }
    if (columnIds.description && taskData.description) {
      cells.push({ columnId: columnIds.description, value: taskData.description })
    }
    if (columnIds.assignedTo && taskData.ownerLastName) {
      cells.push({ columnId: columnIds.assignedTo, value: taskData.ownerLastName })
    }
    if (columnIds.status) {
      cells.push({ columnId: columnIds.status, value: mapStatusToSmartsheet(taskData.status) })
    }
    if (columnIds.startDate && taskData.startDate) {
      cells.push({ columnId: columnIds.startDate, value: taskData.startDate.toISOString().split('T')[0] })
    }
    if (columnIds.endDate && taskData.endDate) {
      cells.push({ columnId: columnIds.endDate, value: taskData.endDate.toISOString().split('T')[0] })
    }
    if (columnIds.budget && taskData.budget) {
      cells.push({ columnId: columnIds.budget, value: taskData.budget })
    }

    // Determine parent row ID if this is a child task
    let parentRowId = null
    if (taskData.parentId) {
      const parentTask = await prisma.wbsCache.findUnique({
        where: { id: taskData.parentId }
      })
      if (parentTask?.smartsheetRowId) {
        parentRowId = parseInt(parentTask.smartsheetRowId)
      }
    }

    // Create row in Smartsheet
    const rowData: any = {
      cells,
      toTop: true
    }

    if (parentRowId) {
      rowData.parentId = parentRowId
    }

    const result = await SmartsheetAPI.addRows(sheetId, [rowData])
    
    if (result.result && result.result.length > 0) {
      return result.result[0].id
    } else {
      throw new Error('Failed to create row in Smartsheet')
    }

  } catch (error) {
    console.error('Error creating task in Smartsheet:', error)
    throw error
  }
}

/**
 * Map our status enum to Smartsheet status values
 */
function mapStatusToSmartsheet(status: string): string {
  switch (status) {
    case 'Not_Started':
      return 'Not Started'
    case 'In_Progress':
      return 'In Progress'
    case 'Complete':
      return 'Complete'
    case 'Approval_Pending':
      return 'Approval Pending'
    case 'Approved':
      return 'Approved'
    case 'On_Hold':
      return 'On Hold'
    default:
      return 'Not Started'
  }
}
