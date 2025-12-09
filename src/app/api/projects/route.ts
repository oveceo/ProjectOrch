import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger, startTimer } from '@/lib/logger'
import { extractUserLastName, createProjectSchema, parseValidation, formatValidationErrors } from '@/lib/validation'
import { ProjectStatus, ApprovalStatus } from '@prisma/client'

const apiLogger = logger.child('api:projects')

// GET /api/projects - Get all projects
export async function GET(request: NextRequest) {
  const getElapsed = startTimer()

  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      apiLogger.warn('Unauthorized access attempt to projects list')
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    apiLogger.debug('Fetching projects', { userLastName, status, category, search })

    // Build query filters - show projects where user appears in "Assigned To" column
    const showAll = searchParams.get('all') === 'true'
    
    let where: any = {}
    
    if (!showAll) {
      // Only show projects where user appears in ANY "Assigned To" field in the WBS
      // This includes the project owner row, approver row, or any task assignment
      where.wbsCache = {
        some: {
          ownerLastName: { equals: userLastName, mode: 'insensitive' as const }
        }
      }
    }

    if (status && status !== 'all') {
      where.AND = where.AND || []
      where.AND.push({ status: status as ProjectStatus })
    }

    if (category && category !== 'all') {
      where.AND = where.AND || []
      where.AND.push({ category })
    }

    if (search) {
      where.AND = where.AND || []
      where.AND.push({
        OR: [
          { projectCode: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    // Fetch projects with WBS count
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: { wbsCache: true }
          }
        },
        orderBy: { projectCode: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.project.count({ where }),
    ])

    apiLogger.info('Projects fetched successfully', {
      count: projects.length,
      total,
      duration: getElapsed()
    })

    return NextResponse.json({
      success: true,
      data: projects,
      meta: {
        count: projects.length,
        total,
        limit,
        offset,
        hasMore: offset + projects.length < total,
      }
    })

  } catch (error) {
    apiLogger.error('Failed to fetch projects', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  const getElapsed = startTimer()

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

    // Only EO Engineers and creators can create projects
    const adminUsers = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette']
    // For now, allow all authenticated users to create projects
    
    // Parse request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Validate input
    const validation = parseValidation(createProjectSchema, body)
    if (!validation.success) {
      apiLogger.warn('Validation failed for project creation', { errors: validation.errors })
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

    const projectData = validation.data

    // Check if project code already exists
    const existingProject = await prisma.project.findUnique({
      where: { projectCode: projectData.projectCode }
    })

    if (existingProject) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Project code already exists',
          message: `A project with code "${projectData.projectCode}" already exists`
        },
        { status: 409 }
      )
    }

    apiLogger.info('Creating new project', { 
      projectCode: projectData.projectCode,
      createdBy: userLastName
    })

    // Create the project
    const project = await prisma.project.create({
      data: {
        ...projectData,
        status: projectData.status || ProjectStatus.Not_Started,
        approvalStatus: projectData.approvalStatus || ApprovalStatus.Pending_Approval,
      }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: `${userLastName}@ove.com`,
        action: 'CREATE_PROJECT',
        targetType: 'Project',
        targetId: project.id,
        payload: {
          projectCode: project.projectCode,
          title: project.title,
          timestamp: new Date().toISOString()
        }
      }
    })

    apiLogger.info('Project created successfully', {
      projectId: project.id,
      projectCode: project.projectCode,
      duration: getElapsed()
    })

    return NextResponse.json({
      success: true,
      data: project,
      message: 'Project created successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Failed to create project', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
