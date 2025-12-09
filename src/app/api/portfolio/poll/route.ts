import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PortfolioSyncService } from '@/lib/portfolio-sync'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permissions (only EO engineers and managers can trigger polling)
    const allowedRoles: UserRole[] = [UserRole.eo_engineer, UserRole.manager]
    if (!session.user.role || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Trigger portfolio polling
    await PortfolioSyncService.pollPortfolioUpdates()

    return NextResponse.json({
      success: true,
      message: 'Portfolio polling completed successfully'
    })

  } catch (error) {
    console.error('Portfolio polling error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
