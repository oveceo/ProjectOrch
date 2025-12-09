import { SmartsheetAPI } from '@/lib/smartsheet'

// Create the Smartsheet client directly for workspace operations
const smartsheet = require('smartsheet')
const client = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN || '',
  logLevel: 'info'
})

export interface WorkspaceSheet {
  id: number
  name: string
  permalink: string
  accessLevel: string
  createdAt: string
  modifiedAt: string
  parentFolder?: string // Track the parent folder name for project code extraction
}

export interface WorkspaceFolder {
  id: number
  name: string
  sheets: WorkspaceSheet[]
  folders: WorkspaceFolder[]
}

export interface SmartsheetWorkspace {
  id: number
  name: string
  sheets: WorkspaceSheet[]
  folders: WorkspaceFolder[]
}

/**
 * Discover all WBS sheets in a workspace
 * This will find sheets with names like "WBS (#P-0010)", "WBS (P-0011)", etc.
 */
export async function discoverWbsSheets(workspaceId: string): Promise<WorkspaceSheet[]> {
  try {
    console.log(`Discovering WBS sheets in workspace: ${workspaceId}`)
    console.log('SMARTSHEET_ACCESS_TOKEN exists:', !!process.env.SMARTSHEET_ACCESS_TOKEN)
    console.log('SMARTSHEET_ACCESS_TOKEN length:', process.env.SMARTSHEET_ACCESS_TOKEN?.length || 0)
    
    if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
      throw new Error('Smartsheet access token not configured')
    }

    // Get workspace details including all folders and sheets
    const response = await client.workspaces.getWorkspace({ 
      id: parseInt(workspaceId),
      include: 'sheets,folders'
    })

    // The Smartsheet SDK might wrap the response
    const workspace = response.data || response

    console.log('Response type:', typeof response)
    console.log('Response keys:', Object.keys(response))
    console.log('Has data property:', 'data' in response)
    
    // Don't log the full JSON as it gets truncated - just key info
    console.log(`Found workspace: "${workspace.name}" (ID: ${workspace.id})`)
    console.log(`Workspace has ${workspace.sheets?.length || 0} direct sheets`)
    console.log(`Workspace has ${workspace.folders?.length || 0} folders`)
    
    if (workspace.folders) {
      console.log('Folders found:')
      (workspace.folders as WorkspaceFolder[]).forEach((folder: WorkspaceFolder) => {
        console.log(`  - "${folder.name}" (ID: ${folder.id})`)
      })
    }
    
    const wbsSheets: WorkspaceSheet[] = []

    // Check sheets directly in workspace
    if (workspace.sheets && workspace.sheets.length > 0) {
      console.log('Checking direct workspace sheets...')
      for (const sheet of workspace.sheets) {
        console.log(`- Sheet: "${sheet.name}" (ID: ${sheet.id})`)
        if (isWbsSheet(sheet.name)) {
          wbsSheets.push(sheet)
          console.log(`  ✅ Found WBS sheet: ${sheet.name} (ID: ${sheet.id})`)
        }
      }
    }

    // Check sheets in folders (like "Work Breakdown Schedules" folder)
    if (workspace.folders && workspace.folders.length > 0) {
      console.log('Checking workspace folders...')
      for (const folder of workspace.folders) {
        console.log(`Checking folder: "${folder.name}" (ID: ${folder.id})`)
        try {
          const folderSheets = await findWbsSheetsInFolder(folder.id)
          console.log(`Found ${folderSheets.length} WBS sheets in folder "${folder.name}"`)
          wbsSheets.push(...folderSheets)
        } catch (error) {
          console.error(`Error processing folder "${folder.name}":`, error)
        }
      }
    }

    console.log(`Total WBS sheets found: ${wbsSheets.length}`)
    return wbsSheets

  } catch (error) {
    console.error('Error discovering WBS sheets:', error)
    throw error
  }
}

/**
 * Recursively find WBS sheets in a folder
 */
export async function findWbsSheetsInFolder(folderId: number): Promise<WorkspaceSheet[]> {
  try {
    console.log(`  Getting folder details for ID: ${folderId}`)
    const response = await client.folders.getFolder({ 
      id: folderId,
      include: 'sheets,folders'
    })
    
    // The Smartsheet SDK might wrap the response, but handle string responses too
    let folder
    if (typeof response === 'string') {
      folder = JSON.parse(response)
    } else {
      folder = response.data || response
    }

    console.log(`  Folder "${folder.name}" has ${folder.sheets?.length || 0} sheets and ${folder.folders?.length || 0} subfolders`)
    
    // If folder name is still undefined, log the raw response (truncated)
    if (!folder.name) {
      console.log('  Raw folder response sample:', JSON.stringify(response).substring(0, 500) + '...')
    }
    const wbsSheets: WorkspaceSheet[] = []

    // Check sheets in this folder
    if (folder.sheets && folder.sheets.length > 0) {
      console.log(`  Checking ${folder.sheets.length} sheets in folder "${folder.name}"`)
      for (const sheet of folder.sheets) {
        console.log(`    Sheet: "${sheet.name}" (ID: ${sheet.id})`)
        
        // If we're inside a WBS project folder (like "WBS (#P-0010)"), 
        // then any sheet inside is a WBS sheet regardless of its name
        const isInWbsFolder = isWbsSheet(folder.name)
        
        if (isWbsSheet(sheet.name) || isInWbsFolder) {
          // Add parent folder context for project code extraction
          const sheetWithContext = { ...sheet, parentFolder: folder.name }
          wbsSheets.push(sheetWithContext)
          if (isInWbsFolder) {
            console.log(`    ✅ Added WBS sheet (inside WBS folder): ${sheet.name} [parent: ${folder.name}]`)
          } else {
            console.log(`    ✅ Added WBS sheet (name match): ${sheet.name}`)
          }
        } else {
          console.log(`    ❌ Skipping non-WBS sheet: ${sheet.name}`)
        }
      }
    }

    // Check subfolders - these might be WBS project folders like "WBS (#P-0010)"
    if (folder.folders && folder.folders.length > 0) {
      console.log(`  Checking ${folder.folders.length} subfolders in "${folder.name}"`)
      for (const subfolder of folder.folders) {
        console.log(`    Subfolder: "${subfolder.name}" (ID: ${subfolder.id})`)
        
        // Check if the subfolder itself is a WBS folder (like "WBS (#P-0010)")
        if (isWbsSheet(subfolder.name)) {
          console.log(`    ✅ Found WBS subfolder: ${subfolder.name}`)
          // This subfolder contains the actual WBS sheets - recurse into it
          const subfolderSheets = await findWbsSheetsInFolder(subfolder.id)
          wbsSheets.push(...subfolderSheets)
        } else {
          console.log(`    ❌ Skipping non-WBS subfolder: ${subfolder.name}`)
        }
      }
    }

    console.log(`  Folder "${folder.name}" total WBS sheets: ${wbsSheets.length}`)
    return wbsSheets

  } catch (error) {
    console.error(`Error checking folder ${folderId}:`, error)
    return []
  }
}

/**
 * Determine if a sheet name indicates it's a WBS sheet
 * Based on your screenshot, matches patterns like:
 * - "WBS (#P-0010)" ✅
 * - "WBS (#P-0013)" ✅  
 * - "Work Breakdown Schedule (Save As...)" ❌ (template, skip)
 */
function isWbsSheet(sheetName: string): boolean {
  console.log(`Checking if "${sheetName}" is a WBS sheet...`)
  
  // Skip templates and save-as sheets
  if (sheetName.toLowerCase().includes('save as') || 
      sheetName.toLowerCase().includes('template')) {
    console.log(`  ❌ Skipping template/save-as sheet: ${sheetName}`)
    return false
  }
  
  const wbsPatterns = [
    /WBS\s*\(#?P-\d+\)/i,                // WBS (#P-0010) or WBS (P-0010) - your exact format
    /^P-\d+.*WBS/i,                      // P-0010 WBS
    /Work\s*Breakdown\s*Schedule.*P-\d+/i,  // Work Breakdown Schedule - P-0010
  ]

  for (const pattern of wbsPatterns) {
    if (pattern.test(sheetName)) {
      console.log(`  ✅ Matches pattern: ${pattern} - "${sheetName}"`)
      return true
    }
  }
  
  console.log(`  ❌ No pattern match for: "${sheetName}"`)
  return false
}

/**
 * Extract project code from sheet name
 */
export function extractProjectCodeFromSheetName(sheetName: string): string | null {
  // Based on your format: "WBS (#P-0010)", "WBS (#P-0013)"
  const patterns = [
    /\(#?(P-\d+)\)/,          // (#P-0010) or (P-0010) - your exact format
    /^(P-\d+)/,               // P-0010 at start
    /(P-\d+)$/,               // P-0010 at end
    /\b(P-\d+)\b/,            // Any P-0010 pattern
  ]

  for (const pattern of patterns) {
    const match = sheetName.match(pattern)
    if (match) {
      console.log(`Extracted project code "${match[1]}" from sheet "${sheetName}"`)
      return match[1]
    }
  }

  console.log(`Could not extract project code from sheet: "${sheetName}"`)
  return null
}

/**
 * Sync all discovered WBS sheets in a workspace
 */
export async function syncAllWbsSheetsInWorkspace(workspaceId: string) {
  const wbsSheets = await discoverWbsSheets(workspaceId)
  
  if (wbsSheets.length === 0) {
    return {
      success: true,
      message: 'No WBS sheets found in workspace',
      syncedCount: 0
    }
  }

  let totalSynced = 0
  let totalErrors = 0
  const results = []

  for (const sheet of wbsSheets) {
    try {
      console.log(`Syncing WBS sheet: ${sheet.name} (ID: ${sheet.id})`)
      
      // Import the sync function here to avoid circular imports
      const { syncWbsFromSmartsheet } = await import('@/lib/smartsheet-sync')
      const result = await syncWbsFromSmartsheet(sheet.id.toString())
      
      if (result.success) {
        totalSynced += result.syncedCount || 0
      } else {
        totalErrors++
      }
      
      results.push({
        sheetName: sheet.name,
        sheetId: sheet.id,
        result
      })

    } catch (error) {
      console.error(`Error syncing sheet ${sheet.name}:`, error)
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

  return {
    success: totalErrors === 0,
    message: `Synced ${totalSynced} tasks from ${wbsSheets.length} WBS sheets with ${totalErrors} errors`,
    totalSheets: wbsSheets.length,
    totalSynced,
    totalErrors,
    results
  }
}
