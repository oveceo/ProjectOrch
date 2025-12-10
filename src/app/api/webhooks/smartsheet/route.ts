import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { logger } from '@/lib/logger'

const apiLogger = logger.child('api:webhooks:smartsheet')

// Smartsheet IDs
const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')
const WBS_TEMPLATE_FOLDER_ID = parseInt(process.env.SMARTSHEET_WBS_TEMPLATE_FOLDER_ID || '2374072609859460')
const WBS_PARENT_FOLDER_ID = parseInt(process.env.SMARTSHEET_WBS_PARENT_FOLDER_ID || '4414766191011716')

/**
 * POST /api/webhooks/smartsheet - Receive Smartsheet webhook notifications
 * 
 * Smartsheet webhooks send:
 * 1. A verification request (challenge) when setting up
 * 2. Event notifications when rows are UPDATED (approval status changes)
 * 
 * TRIGGER: Row updated + Approval Status = "Approved" → Create WBS folder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle Smartsheet webhook verification challenge
    // Smartsheet sends this when you first create the webhook
    if (body.challenge) {
      apiLogger.info('Webhook verification challenge received')
      return NextResponse.json({ smartsheetHookResponse: body.challenge })
    }

    // Handle actual webhook events
    if (body.events && Array.isArray(body.events)) {
      apiLogger.info('Webhook events received', { 
        eventCount: body.events.length,
        scopeObjectId: body.scopeObjectId,
        webhookId: body.webhookId
      })
      
      // Log full payload for debugging
      console.log('📥 WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2))

      for (const event of body.events) {
        console.log('📥 EVENT:', JSON.stringify(event, null, 2))
        
        // ONLY process row UPDATES (when approval status changes to Approved)
        // NOT row creation - projects start as pending and could get denied
        if (event.objectType === 'row' && event.eventType === 'updated') {
          apiLogger.info('Row updated event received', { 
            rowId: event.rowId,
            sheetId: body.scopeObjectId 
          })

          // Process asynchronously to respond quickly to Smartsheet
          processNewRow(event.rowId, body.scopeObjectId).catch(err => {
            apiLogger.error('Background processing failed', err)
          })
        } else {
          apiLogger.info('Ignoring non-update event', { 
            objectType: event.objectType, 
            eventType: event.eventType 
          })
        }
      }

      return NextResponse.json({ success: true, message: 'Events received' })
    }

    // Unknown payload
    apiLogger.warn('Unknown webhook payload', { body })
    return NextResponse.json({ success: true })

  } catch (error) {
    apiLogger.error('Webhook error', error as Error)
    // Always return 200 to Smartsheet to prevent retries
    return NextResponse.json({ success: false, error: 'Processing error' })
  }
}

/**
 * Process a newly created row - create WBS folder if needed
 */
async function processNewRow(rowId: number, sheetId: number) {
  try {
    // Only process if it's our portfolio sheet
    if (sheetId !== PORTFOLIO_SHEET_ID) {
      apiLogger.info('Ignoring event from different sheet', { sheetId })
      return
    }

    apiLogger.info('Processing new portfolio row', { rowId })

    // Get the sheet data
    const sheet = await SmartsheetAPI.getSheet(PORTFOLIO_SHEET_ID)
    const row = sheet.rows.find(r => r.id === rowId)

    if (!row) {
      apiLogger.warn('Row not found', { rowId })
      return
    }

    // Get project code
    const projectCode = SmartsheetAPI.getCellValue(row, sheet.columns, '###')
    if (!projectCode) {
      apiLogger.info('Row has no project code yet', { rowId })
      return
    }

    // THE ONLY TRIGGER: Approval Status = "Approved"
    const approvalStatus = SmartsheetAPI.getCellValue(row, sheet.columns, 'Approval Status')
    if (approvalStatus !== 'Approved') {
      apiLogger.info('Project not approved yet', { projectCode, approvalStatus })
      return
    }

    // Check if WBS folder already exists in Smartsheet (prevent duplicates)
    const existingFolders = await SmartsheetAPI.getFolder(WBS_PARENT_FOLDER_ID)
    const existingFolderNames = new Set(
      (existingFolders.folders || []).map((f: any) => f.name.toLowerCase())
    )
    const expectedFolderName = `WBS (#${projectCode})`.toLowerCase()
    
    if (existingFolderNames.has(expectedFolderName)) {
      apiLogger.info('WBS folder already exists in Smartsheet, skipping', { projectCode })
      return
    }

    // Get project name
    const projectName = SmartsheetAPI.getCellValue(row, sheet.columns, 'Project Name') || projectCode

    apiLogger.info('Creating WBS for approved project', { projectCode, projectName })

    // Create or get project in database
    let project = await prisma.project.findUnique({ where: { projectCode } })
    
    if (!project) {
      project = await prisma.project.create({
        data: {
          projectCode,
          title: projectName,
          status: 'Not_Started',
          requiresWbs: true,
          portfolioRowId: rowId.toString()
        }
      })
      apiLogger.info('Created project in database', { projectCode, projectId: project.id })
    }

    // Skip if already has WBS
    if (project.wbsSheetId) {
      apiLogger.info('Project already has WBS in database', { projectCode })
      return
    }

    // Create WBS folder structure
    await createWbsForProject(project, row.id, sheet)

    apiLogger.info('✅ WBS automation completed for new project', { projectCode })

  } catch (error) {
    apiLogger.error('Error processing new row', error as Error, { rowId })
  }
}

/**
 * Create WBS folder structure for a project
 * 
 * Uses "Save as New" approach - copy the entire template folder
 * This copies everything (sheets, reports, dashboards) with proper references
 */
async function createWbsForProject(project: any, rowId: number, sheet: any) {
  const folderName = `WBS (#${project.projectCode})`
  
  apiLogger.info('Creating WBS folder structure (folder copy)', { 
    projectCode: project.projectCode,
    folderName,
    templateFolderId: WBS_TEMPLATE_FOLDER_ID,
    parentFolderId: WBS_PARENT_FOLDER_ID
  })

  // Copy the ENTIRE template folder (like "Save as New" in UI)
  // This should copy sheets, reports, AND dashboards with proper references
  console.log(`📁 Copying template folder ${WBS_TEMPLATE_FOLDER_ID} as: ${folderName}`)
  
  const copyResult = await SmartsheetAPI.copyFolder(
    WBS_TEMPLATE_FOLDER_ID,
    WBS_PARENT_FOLDER_ID,
    folderName
  )
  
  const projectFolderId = copyResult.result?.id || copyResult.id
  console.log(`✅ Copied template folder as: ${folderName} (ID: ${projectFolderId})`)
  apiLogger.info('Copied template folder', { folderName, folderId: projectFolderId })

  // Get the new folder to find the WBS sheet and verify contents
  const newFolder = await SmartsheetAPI.getFolder(projectFolderId)
  console.log(`📁 New folder contents:`)
  console.log(`   - Sheets: ${newFolder.sheets?.length || 0}`)
  console.log(`   - Reports: ${newFolder.reports?.length || 0}`)
  console.log(`   - Dashboards: ${newFolder.sights?.length || 0}`)
  
  apiLogger.info('New folder contents', { 
    sheets: newFolder.sheets?.length || 0,
    reports: newFolder.reports?.length || 0,
    dashboards: newFolder.sights?.length || 0
  })

  // Find the WBS sheet in the copied folder
  let wbsSheetId: number | null = null
  let wbsSheetPermalink: string | null = null
  
  for (const copiedSheet of (newFolder.sheets || [])) {
    if (copiedSheet.name === 'Work Breakdown Schedule' || 
        copiedSheet.name.toLowerCase().includes('work breakdown')) {
      wbsSheetId = copiedSheet.id
      wbsSheetPermalink = copiedSheet.permalink
      console.log(`Found WBS sheet: ${wbsSheetId}`)
      apiLogger.info('Found WBS sheet in copied folder', { sheetId: wbsSheetId })
      break
    }
  }

  if (!wbsSheetId) {
    throw new Error('WBS sheet not found in copied folder')
  }

  // Update row 1 Name cell with project code
  const wbsSheetData = await SmartsheetAPI.getSheet(wbsSheetId)
  const firstRow = wbsSheetData.rows[0]

  if (firstRow) {
    const nameColumn = SmartsheetAPI.findColumnByTitle(wbsSheetData.columns, 'Name')
    if (nameColumn) {
      await SmartsheetAPI.updateRows(wbsSheetId, [{
        id: firstRow.id,
        cells: [{ columnId: nameColumn.id, value: project.projectCode }]
      }])
      apiLogger.info('Updated WBS sheet row 1 with project code', { projectCode: project.projectCode })
    }
  }

  // Step 5: Update portfolio row with links
  const projectPlanColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Project Plan')
  const wbsAppLinkColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, 'WBS App Link')

  const cells = []
  if (projectPlanColumn && wbsSheetPermalink) {
    cells.push({
      columnId: projectPlanColumn.id,
      value: 'Work Breakdown Schedule',
      hyperlink: { url: wbsSheetPermalink }
    })
  }
  if (wbsAppLinkColumn) {
    cells.push({
      columnId: wbsAppLinkColumn.id,
      value: `${process.env.APP_BASE_URL}/projects/${project.id}/wbs`
    })
  }

  if (cells.length > 0) {
    await SmartsheetAPI.updateRows(PORTFOLIO_SHEET_ID, [{ id: rowId, cells }])
    apiLogger.info('Updated portfolio row with WBS links')
  }

  // Step 6: Update database
  await prisma.project.update({
    where: { id: project.id },
    data: {
      wbsFolderId: projectFolderId.toString(),
      wbsSheetId: wbsSheetId.toString(),
      wbsSheetUrl: wbsSheetPermalink,
      wbsAppUrl: `${process.env.APP_BASE_URL}/projects/${project.id}/wbs`
    }
  })

  apiLogger.info('✅ WBS structure created successfully', { 
    projectCode: project.projectCode,
    folderId: projectFolderId,
    sheetId: wbsSheetId
  })
}

