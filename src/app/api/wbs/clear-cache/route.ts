import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

    // All authenticated users can clear cache for fresh sync
    console.log(`Clearing WBS cache requested by: ${userLastName}`)

    // Clear all WBS cache entries
    const deleteResult = await prisma.wbsCache.deleteMany({})
    
    console.log(`✅ Cleared ${deleteResult.count} WBS cache entries`)

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleteResult.count} WBS cache entries. You can now sync fresh data from Smartsheet.`,
      deletedCount: deleteResult.count
    })

  } catch (error) {
    console.error('Error clearing WBS cache:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
