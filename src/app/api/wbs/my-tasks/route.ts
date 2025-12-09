import { NextRequest, NextResponse } from 'next/server'
import { ProjectStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger, startTimer } from '@/lib/logger'
import { extractUserLastName } from '@/lib/validation'

const apiLogger = logger.child('api:wbs:my-tasks')

// GET /api/wbs/my-tasks - Get WBS tasks assigned to current user
export async function GET(request: NextRequest) {
  const getElapsed = startTimer()
  
  try {
    // Get user from Authorization header (set by client)
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)
    
    if (!userLastName) {
      apiLogger.warn('Unauthorized access attempt - no valid auth header')
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authorization header'
        },
        { status: 401 }
      )
    }

    apiLogger.debug('Fetching WBS tasks', { userLastName })

    // Query WBS tasks from database for this user based on their last name
    // User can see tasks they're assigned to OR tasks they approve
    // Filter out items with skipWbs=true (project headers) and items without parentRowId (phase-level)
    // We only want actual Tasks and Subtasks
    const userTasks = await prisma.wbsCache.findMany({
      where: {
        AND: [
          // Must have a parent (not a phase or project header)
          { parentRowId: { not: null } },
          // Must not be a skip WBS item
          { skipWbs: false },
          // Must be assigned to or approved by user
          {
            OR: [
              { ownerLastName: { equals: userLastName, mode: 'insensitive' } },
              { approverLastName: { equals: userLastName, mode: 'insensitive' } }
            ]
          }
        ]
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
      },
      orderBy: [
        { project: { projectCode: 'asc' } },
        { orderIndex: 'asc' }
      ]
    })

    apiLogger.info('WBS tasks fetched successfully', {
      userLastName,
      taskCount: userTasks.length,
      duration: getElapsed()
    })

    return NextResponse.json({
      success: true,
      data: userTasks,
      meta: {
        count: userTasks.length,
        user: userLastName,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    apiLogger.error('Failed to fetch WBS tasks', error as Error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve WBS tasks. Please try again later.'
      },
      { status: 500 }
    )
  }
}
