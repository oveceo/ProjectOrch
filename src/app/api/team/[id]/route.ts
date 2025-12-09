import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { UserRole } from '@prisma/client'

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.nativeEnum(UserRole).optional()
})

// GET /api/team/[id] - Get specific team member
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only EO engineers and managers can view team member details
    const allowedRoles: UserRole[] = [UserRole.eo_engineer, UserRole.manager]
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdProjects: true,
            assignedProjects: true,
            approvedProjects: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('Error fetching team member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/team/[id] - Update team member
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only EO engineers can update team members
    if (session.user.role !== UserRole.eo_engineer) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = updateUserSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Prevent users from modifying their own role (unless they're EO engineer)
    if (params.id === session.user.id && updateData.role && updateData.role !== UserRole.eo_engineer) {
      return NextResponse.json(
        { error: 'Cannot modify your own role' },
        { status: 403 }
      )
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdProjects: true,
            assignedProjects: true,
            approvedProjects: true
          }
        }
      }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: session.user.email || 'unknown',
        action: 'UPDATE_USER',
        targetType: 'User',
        targetId: params.id,
        payload: {
          oldData: { name: existingUser.name, role: existingUser.role },
          newData: updateData
        }
      }
    })

    return NextResponse.json(user)

  } catch (error) {
    console.error('Error updating team member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/team/[id] - Remove team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only EO engineers can delete team members
    if (session.user.role !== UserRole.eo_engineer) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      )
    }

    // Prevent users from deleting themselves
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      )
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: params.id }
    })

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: session.user.email || 'unknown',
        action: 'DELETE_USER',
        targetType: 'User',
        targetId: params.id,
        payload: existingUser
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully'
    })

  } catch (error) {
    console.error('Error deleting team member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
