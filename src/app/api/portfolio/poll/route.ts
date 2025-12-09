import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { PortfolioSyncService } from '@/lib/portfolio-sync'

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

    // All authenticated users can trigger portfolio polling
    console.log(`Portfolio polling triggered by: ${session.user.email || session.user.name}`)

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
