import { NextRequest, NextResponse } from 'next/server'
import { syncAllFromSmartsheet } from '@/lib/smartsheet-sync'
import { syncAllWbsSheetsInWorkspace, extractProjectCodeFromSheetName } from '@/lib/smartsheet-discovery'

export async function POST(request: NextRequest) {
  try {
    // Get user from Authorization header (set by client)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    // Extract user last name from header
    const userLastName = authHeader.replace('Bearer ', '')
    if (!userLastName) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      )
    }

    // All authenticated users can trigger syncs
    console.log(`Sync triggered by: ${userLastName}`)

    // Parse body (may be empty)
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine
    }
    const { workspaceId, projectsSheetId, wbsSheetId } = body

    // Direct sync approach - use known folder ID for "Work Breakdown Schedules"
    const WORK_BREAKDOWN_SCHEDULES_FOLDER_ID = "4414766191011716"
    
    console.log(`Starting direct WBS folder sync - Folder: ${WORK_BREAKDOWN_SCHEDULES_FOLDER_ID}`)
    
    try {
      // Import the sync functions
      const { findWbsSheetsInFolder } = await import('@/lib/smartsheet-discovery')
      const { syncWbsFromSmartsheet } = await import('@/lib/smartsheet-sync')
      
      // Find all WBS sheets in the folder
      const wbsSheets = await findWbsSheetsInFolder(parseInt(WORK_BREAKDOWN_SCHEDULES_FOLDER_ID))
      console.log(`Found ${wbsSheets.length} WBS sheets`)
      
      if (wbsSheets.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No WBS sheets found in Work Breakdown Schedules folder',
          syncedCount: 0
        })
      }
      
      // Sync each WBS sheet
      let totalSynced = 0
      let totalErrors = 0
      const results = []
      
      for (const sheet of wbsSheets) {
        try {
          console.log(`Syncing WBS sheet: ${sheet.name} (ID: ${sheet.id})`)
          
          // Extract project code from the parent folder name (e.g., "WBS (#P-0010)" → "P-0010")
          const projectCode = extractProjectCodeFromSheetName(sheet.parentFolder || '')
          console.log(`Extracted project code: ${projectCode} from folder context`)
          
          const result = await syncWbsFromSmartsheet(sheet.id.toString(), projectCode || undefined)
          
          if (result.success) {
            totalSynced += result.syncedCount || 0
            console.log(`✅ Synced ${result.syncedCount || 0} tasks from ${sheet.name}`)
          } else {
            totalErrors++
            console.error(`❌ Failed to sync ${sheet.name}: ${result.message}`)
          }
          
          results.push({
            sheetName: sheet.name,
            sheetId: sheet.id,
            result
          })
          
        } catch (error) {
          console.error(`❌ Error syncing sheet ${sheet.name}:`, error)
          totalErrors++
          results.push({
            sheetName: sheet.name,
            sheetId: sheet.id,
            result: {
              success: false,
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      }
      
      const syncResult = {
        success: totalErrors === 0,
        message: `Synced ${totalSynced} tasks from ${wbsSheets.length} WBS sheets with ${totalErrors} errors`,
        totalSheets: wbsSheets.length,
        totalSynced,
        totalErrors,
        results
      }
      
      console.log(`🎯 Sync complete: ${syncResult.message}`)
      
      if (syncResult.success) {
        return NextResponse.json({
          success: true,
          message: syncResult.message,
          totalSheets: syncResult.totalSheets,
          totalSynced: syncResult.totalSynced,
          totalErrors: syncResult.totalErrors,
          results: syncResult.results
        })
      } else {
        return NextResponse.json(
          { error: syncResult.message },
          { status: 500 }
        )
      }
      
    } catch (error) {
      console.error('❌ Error in direct folder sync:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in Smartsheet sync:', error)
    return NextResponse.json(
      { error: 'Internal server error during sync' },
      { status: 500 }
    )
  }
}

// GET endpoint to check sync status or get sync history
export async function GET(request: NextRequest) {
  try {
    // Get user from Authorization header (set by client)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    // Extract user last name from header
    const userLastName = authHeader.replace('Bearer ', '')
    if (!userLastName) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      )
    }

    // All authenticated users can check sync status
    console.log(`Sync status check by: ${userLastName}`)

    // For now, return a simple status
    // In a real implementation, you'd track sync jobs and their status
    return NextResponse.json({
      success: true,
      status: 'idle',
      message: 'No sync currently running',
      lastSync: null // Would be populated from database
    })

  } catch (error) {
    console.error('Error checking sync status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
