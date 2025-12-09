import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ProjectStatus, ApprovalStatus, UserRole } from '@prisma/client'
import { extractUserLastName } from '@/lib/validation'
import { logger } from '@/lib/logger'

const apiLogger = logger.child('api:project')

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  approverEmail: z.string().email().optional(),
  assigneeEmail: z.string().email().optional(),
  approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  requiresWbs: z.boolean().optional(),
  budget: z.string().optional(),
  actual: z.string().optional(),
  variance: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  atRisk: z.boolean().optional()
})

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id] - Get specific project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    
    // Try simple auth first (Authorization header)
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    // If no simple auth, try NextAuth session
    let user: any = null
    if (userLastName) {
      // Simple auth - create pseudo-user
      const adminUsers = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette']
      user = {
        id: userLastName.toLowerCase(),
        email: `${userLastName.toLowerCase()}@ove.com`,
        name: userLastName,
        role: adminUsers.includes(userLastName) ? UserRole.eo_engineer : UserRole.assignee
      }
    } else {
      const session = await getServerSession(authOptions)
      user = session?.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, name: true, role: true }
        },
        assignee: {
          select: { id: true, email: true, name: true, role: true }
        },
        approver: {
          select: { id: true, email: true, name: true, role: true }
        },
        _count: {
          select: { wbsCache: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)

  } catch (error) {
    apiLogger.error('Error fetching project:', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    
    // Auth check
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    let user: any = null
    if (userLastName) {
      const adminUsers = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette']
      user = {
        id: userLastName.toLowerCase(),
        email: `${userLastName.toLowerCase()}@ove.com`,
        name: userLastName,
        role: adminUsers.includes(userLastName) ? UserRole.eo_engineer : UserRole.assignee
      }
    } else {
      const session = await getServerSession(authOptions)
      user = session?.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = updateProjectSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Get existing project
    const existingProject = await prisma.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Update project
    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
        approver: { select: { id: true, email: true, name: true } }
      }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: user.email || 'unknown',
        action: 'UPDATE_PROJECT',
        targetType: 'Project',
        targetId: id,
        payload: JSON.stringify({ oldData: existingProject, newData: updateData })
      }
    })

    return NextResponse.json(project)

  } catch (error) {
    apiLogger.error('Error updating project:', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    
    // Auth check
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    let user: any = null
    if (userLastName) {
      const adminUsers = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette']
      user = {
        id: userLastName.toLowerCase(),
        email: `${userLastName.toLowerCase()}@ove.com`,
        name: userLastName,
        role: adminUsers.includes(userLastName) ? UserRole.eo_engineer : UserRole.assignee
      }
    } else {
      const session = await getServerSession(authOptions)
      user = session?.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only EO engineers can delete
    if (user.role !== UserRole.eo_engineer) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get existing project for audit
    const existingProject = await prisma.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete project (cascade will handle WBS cache)
    await prisma.project.delete({
      where: { id }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: user.email || 'unknown',
        action: 'DELETE_PROJECT',
        targetType: 'Project',
        targetId: id,
        payload: JSON.stringify(existingProject)
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    apiLogger.error('Error deleting project:', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
