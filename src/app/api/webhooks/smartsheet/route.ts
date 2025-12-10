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
      apiLogger.info('Webhook events received', { eventCount: body.events.length })

      for (const event of body.events) {
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
 * Steps:
 * 1. Create new empty folder named "WBS (#P-XXXX)"
 * 2. Get template folder contents
 * 3. Copy each sheet from template to new folder
 * 4. Update row 1 Name cell with project code in the WBS sheet
 */
async function createWbsForProject(project: any, rowId: number, sheet: any) {
  const folderName = `WBS (#${project.projectCode})`
  
  apiLogger.info('Creating WBS folder structure', { 
    projectCode: project.projectCode,
    folderName 
  })

  // Step 1: Create new empty folder
  const createFolderResponse = await SmartsheetAPI.createFolder(folderName, WBS_PARENT_FOLDER_ID)
  const projectFolderId = createFolderResponse.result.id
  apiLogger.info('Created empty folder', { folderName, folderId: projectFolderId })

  // Step 2: Get template folder contents
  const templateFolder = await SmartsheetAPI.getFolder(WBS_TEMPLATE_FOLDER_ID)
  apiLogger.info('Template folder contents', { 
    sheets: templateFolder.sheets?.length || 0,
    reports: templateFolder.reports?.length || 0,
    dashboards: templateFolder.sights?.length || 0
  })

  // Step 3: Copy each sheet from template to new folder
  let wbsSheetId: number | null = null
  let wbsSheetPermalink: string | null = null
  
  for (const templateSheet of (templateFolder.sheets || [])) {
    apiLogger.info('Copying sheet', { sheetName: templateSheet.name, sheetId: templateSheet.id })
    
    const copyResult = await SmartsheetAPI.copySheet(
      templateSheet.id,
      templateSheet.name, // Keep same name
      projectFolderId
    )
    
    // Track the WBS sheet for updating
    if (templateSheet.name === 'Work Breakdown Schedule' || 
        templateSheet.name.toLowerCase().includes('work breakdown')) {
      wbsSheetId = copyResult.result.id
      wbsSheetPermalink = copyResult.result.permalink
      apiLogger.info('Found and copied WBS sheet', { newSheetId: wbsSheetId })
    }
  }

  if (!wbsSheetId) {
    throw new Error('WBS sheet not found in template folder')
  }

  // Step 4: Update row 1 Name cell with project code
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

