import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ProjectStatus } from '@prisma/client'

// GET /api/wbs?projectId=xxx - Get WBS tasks for a project
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // All authenticated users can view WBS tasks
    console.log(`WBS tasks requested by: ${userLastName}`)

    // Fetch WBS tasks for the project
    const wbsTasks = await prisma.wbsCache.findMany({
      where: { projectId },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            status: true,
            category: true
          }
        },
        children: {
          include: {
            project: {
              select: {
                id: true,
                projectCode: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: [
        { orderIndex: 'asc' },
        // createdAt is not present in the WbsCache model; order by id to keep deterministic ordering
        { id: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: wbsTasks
    })

  } catch (error) {
    console.error('Error fetching WBS tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/wbs - Create new WBS task
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
    const { projectId, name, description, parentId } = body

    // Validate required fields
    if (!projectId || !name?.trim()) {
      return NextResponse.json(
        { error: 'Project ID and task name are required' },
        { status: 400 }
      )
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // All authenticated users can create WBS tasks
    console.log(`WBS task creation requested by: ${userLastName}`)

    // Get the next order index for this project
    const lastTask = await prisma.wbsCache.findFirst({
      where: { projectId },
      orderBy: { orderIndex: 'desc' }
    })

    const nextOrderIndex = (lastTask?.orderIndex || 0) + 1

    // Create the new WBS task
    const newTask = await prisma.wbsCache.create({
      data: {
        projectId,
        name: name.trim(),
        description: description?.trim() || null,
        status: 'Not_Started',
        orderIndex: nextOrderIndex,
        parentId: parentId || null,
        ownerLastName: null,
        approverLastName: null,
        lastSyncedAt: new Date()
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

    console.log(`✅ WBS task created by ${userLastName}: ${newTask.name}`)

    return NextResponse.json(newTask, { status: 201 })

  } catch (error) {
    console.error('Error creating WBS task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
