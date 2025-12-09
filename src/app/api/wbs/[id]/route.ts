import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger, startTimer } from '@/lib/logger'
import { extractUserLastName, updateWbsTaskSchema, parseValidation, formatValidationErrors } from '@/lib/validation'

const apiLogger = logger.child('api:wbs')

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/wbs/[id] - Get a single WBS task by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  const getElapsed = startTimer()
  const { id } = await params

  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      apiLogger.warn('Unauthorized access attempt to WBS task', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required' 
        },
        { status: 401 }
      )
    }

    apiLogger.debug('Fetching WBS task', { taskId: id, userLastName })

    // Fetch the WBS task with project details
    const wbsTask = await prisma.wbsCache.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            status: true,
            category: true,
            wbsSheetId: true,
            wbsSheetUrl: true,
          }
        }
      }
    })

    if (!wbsTask) {
      apiLogger.warn('WBS task not found', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'WBS task not found',
          message: `No task found with ID: ${id}`
        },
        { status: 404 }
      )
    }

    // Check if user has access to this task
    const hasAccess = 
      wbsTask.ownerLastName === userLastName || 
      wbsTask.approverLastName === userLastName ||
      ['eo_engineer', 'manager'].includes(userLastName) // Admin roles see all

    // For now, allow access even if not directly assigned (enterprise requirement)
    // In stricter mode, you could restrict this
    
    apiLogger.info('WBS task fetched', { 
      taskId: id, 
      projectCode: wbsTask.project.projectCode,
      duration: getElapsed()
    })

    return NextResponse.json(wbsTask)

  } catch (error) {
    apiLogger.error('Failed to fetch WBS task', error as Error, { taskId: id })
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve WBS task'
      },
      { status: 500 }
    )
  }
}

// PUT /api/wbs/[id] - Update a WBS task
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const getElapsed = startTimer()
  const { id } = await params

  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      apiLogger.warn('Unauthorized update attempt', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required' 
        },
        { status: 401 }
      )
    }

    // Parse request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      )
    }

    // Validate input
    const validation = parseValidation(updateWbsTaskSchema, body)
    if (!validation.success) {
      apiLogger.warn('Validation failed for WBS task update', { 
        taskId: id, 
        errors: validation.errors 
      })
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation error',
          message: formatValidationErrors(validation.errors),
          details: validation.errors
        },
        { status: 400 }
      )
    }

    const updateData = validation.data

    apiLogger.debug('Updating WBS task', { taskId: id, userLastName, updates: Object.keys(updateData) })

    // Check if task exists
    const existingTask = await prisma.wbsCache.findUnique({
      where: { id },
      select: { 
        id: true, 
        ownerLastName: true, 
        approverLastName: true,
        projectId: true,
        name: true
      }
    })

    if (!existingTask) {
      apiLogger.warn('WBS task not found for update', { taskId: id })
      return NextResponse.json(
        { 
          success: false,
          error: 'WBS task not found',
          message: `No task found with ID: ${id}`
        },
        { status: 404 }
      )
    }

    // Update the task
    const updatedTask = await prisma.wbsCache.update({
      where: { id },
      data: {
        ...updateData,
        lastSyncedAt: new Date(), // Mark as needing sync
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            status: true,
            category: true,
          }
        }
      }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: `${userLastName}@ove.com`,
        action: 'UPDATE_WBS_TASK',
        targetType: 'WbsCache',
        targetId: id,
        payload: {
          previousName: existingTask.name,
          updates: updateData,
          timestamp: new Date().toISOString()
        }
      }
    })

    apiLogger.info('WBS task updated successfully', { 
      taskId: id, 
      projectCode: updatedTask.project.projectCode,
      updatedBy: userLastName,
      duration: getElapsed()
    })

    return NextResponse.json(updatedTask)

  } catch (error) {
    apiLogger.error('Failed to update WBS task', error as Error, { taskId: id })
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Failed to update WBS task'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/wbs/[id] - Delete a WBS task (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only EO Engineers can delete tasks
    const adminUsers = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette']
    if (!adminUsers.includes(userLastName)) {
      apiLogger.warn('Unauthorized delete attempt', { taskId: id, userLastName })
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden',
          message: 'Only EO Engineers can delete WBS tasks'
        },
        { status: 403 }
      )
    }

    // Get task before deletion for audit
    const taskToDelete = await prisma.wbsCache.findUnique({
      where: { id },
      select: { name: true, projectId: true }
    })

    if (!taskToDelete) {
      return NextResponse.json(
        { success: false, error: 'WBS task not found' },
        { status: 404 }
      )
    }

    // Delete the task
    await prisma.wbsCache.delete({
      where: { id }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: `${userLastName}@ove.com`,
        action: 'DELETE_WBS_TASK',
        targetType: 'WbsCache',
        targetId: id,
        payload: {
          deletedTaskName: taskToDelete.name,
          projectId: taskToDelete.projectId,
          timestamp: new Date().toISOString()
        }
      }
    })

    apiLogger.info('WBS task deleted', { taskId: id, deletedBy: userLastName })

    return NextResponse.json({ 
      success: true,
      message: 'WBS task deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Failed to delete WBS task', error as Error, { taskId: id })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
