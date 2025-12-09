import { NextRequest, NextResponse } from 'next/server'
import { findWbsSheetsInFolder } from '@/lib/smartsheet-discovery'

// Direct folder sync for testing - use the "Work Breakdown Schedules" folder ID
export async function POST(request: NextRequest) {
  try {
    const { folderId } = await request.json()
    
    if (!folderId) {
      return NextResponse.json(
        { error: 'Missing folderId parameter' },
        { status: 400 }
      )
    }

    console.log(`Direct folder sync - Folder: ${folderId}`)
    
    // Import the function dynamically to avoid circular imports
    const { findWbsSheetsInFolder } = await import('@/lib/smartsheet-discovery')
    const sheets = await findWbsSheetsInFolder(parseInt(folderId))
    
    return NextResponse.json({
      success: true,
      message: `Found ${sheets.length} WBS sheets in folder`,
      sheets: sheets.map(sheet => ({
        id: sheet.id,
        name: sheet.name
      }))
    })

  } catch (error) {
    console.error('Error in folder sync:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
