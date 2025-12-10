import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { PortfolioSyncService } from '@/lib/portfolio-sync'
import { logger } from '@/lib/logger'

const apiLogger = logger.child('api:portfolio:new-projects')

// Smartsheet IDs
const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')
const WBS_PARENT_FOLDER_ID = parseInt(process.env.SMARTSHEET_WBS_PARENT_FOLDER_ID || '4414766191011716')

/**
 * POST /api/portfolio/new-projects - Check for new projects and create WBS folders
 * 
 * This endpoint:
 * 1. Reads the portfolio sheet
 * 2. Finds rows that don't have a WBS folder yet
 * 3. Creates WBS folders by copying the template folder
 * 4. Updates the portfolio row with links
 * 
 * Can be triggered:
 * - Manually from the app
 * - Via webhook from Smartsheet
 * - Via scheduled job/cron
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify authorization
    const authHeader = request.headers.get('authorization')
    const userLastName = authHeader?.replace('Bearer ', '')
    
    apiLogger.info('Checking for new projects', { triggeredBy: userLastName || 'webhook' })

    // Get portfolio sheet data
    const sheet = await SmartsheetAPI.getSheet(PORTFOLIO_SHEET_ID)
    apiLogger.info('Portfolio sheet loaded', { rowCount: sheet.rows.length })

    // Get existing WBS folders to prevent duplicates
    const existingFolders = await SmartsheetAPI.getFolder(WBS_PARENT_FOLDER_ID)
    const existingFolderNames = new Set(
      (existingFolders.folders || []).map((f: any) => f.name.toLowerCase())
    )
    apiLogger.info('Existing WBS folders loaded', { count: existingFolderNames.size })

    // Find column IDs
    const projectCodeCol = SmartsheetAPI.findColumnByTitle(sheet.columns, '###')
    const projectNameCol = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Project Name')

    if (!projectCodeCol) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project code column (###) not found in portfolio sheet' 
      }, { status: 400 })
    }

    const results = {
      checked: 0,
      created: 0,
      skipped: 0,
      pendingApproval: 0,
      removed: 0,
      errors: [] as string[]
    }

    // CLEANUP: Get all project codes from portfolio and remove any that are no longer there
    const portfolioProjectCodes = new Set<string>()
    for (const row of sheet.rows) {
      const code = SmartsheetAPI.getCellValue(row, sheet.columns, '###')
      if (code) portfolioProjectCodes.add(code)
    }
    
    // Find and remove projects no longer in portfolio
    const allDbProjects = await prisma.project.findMany({ select: { id: true, projectCode: true } })
    for (const dbProject of allDbProjects) {
      if (!portfolioProjectCodes.has(dbProject.projectCode)) {
        apiLogger.info('Removing project not in portfolio', { projectCode: dbProject.projectCode })
        // Delete related WBS cache entries first
        await prisma.wbsCache.deleteMany({ where: { projectId: dbProject.id } })
        // Delete the project
        await prisma.project.delete({ where: { id: dbProject.id } })
        results.removed++
      }
    }

    // Process each row
    for (const row of sheet.rows) {
      results.checked++

      // Get project code from ### column
      const projectCode = SmartsheetAPI.getCellValue(row, sheet.columns, '###')
      if (!projectCode) {
        continue // Skip rows without project code
      }

      // THE ONLY TRIGGER: Approval Status = "Approved"
      const approvalStatus = SmartsheetAPI.getCellValue(row, sheet.columns, 'Approval Status')
      if (approvalStatus !== 'Approved') {
        results.pendingApproval++
        continue
      }
      
      apiLogger.info('Approved project found', { projectCode })

      // Check if project exists in our database
      let project = await prisma.project.findUnique({
        where: { projectCode }
      })

      // If project doesn't exist, create it
      if (!project) {
        const rawProjectName = projectNameCol 
          ? SmartsheetAPI.getCellValue(row, sheet.columns, 'Project Name') || projectCode
          : projectCode
        // Ensure project name is always a string
        const projectName = String(rawProjectName)

        apiLogger.info('Creating new project in database', { projectCode, projectName })
        
        project = await prisma.project.create({
          data: {
            projectCode,
            title: projectName,
            status: 'Not_Started',
            requiresWbs: true,
            portfolioRowId: row.id.toString()
          }
        })
      }

      // Check if project already has WBS folder in database
      if (project.wbsSheetId) {
        // Verify the sheet still exists in Smartsheet (user may have deleted it)
        try {
          await SmartsheetAPI.getSheet(parseInt(project.wbsSheetId))
          apiLogger.info('Project already has WBS in database (verified exists)', { projectCode })
          results.skipped++
          continue
        } catch (err) {
          // Sheet no longer exists - clear the database and recreate
          apiLogger.warn('WBS sheet no longer exists in Smartsheet, clearing database', { projectCode, oldSheetId: project.wbsSheetId })
          await prisma.project.update({
            where: { id: project.id },
            data: { wbsSheetId: null, wbsSheetUrl: null, wbsAppUrl: null, wbsFolderId: null }
          })
          // Continue to create new WBS
        }
      }

      // Check if WBS folder already exists in Smartsheet (prevent duplicates)
      const expectedFolderName = `WBS (#${projectCode})`.toLowerCase()
      if (existingFolderNames.has(expectedFolderName)) {
        apiLogger.info('WBS folder already exists in Smartsheet', { projectCode, folderName: `WBS (#${projectCode})` })
        results.skipped++
        continue
      }

      // Create WBS folder for this project
      try {
        apiLogger.info('Creating WBS folder for project', { projectCode })
        
        // Trigger the row processing which creates the WBS
        await PortfolioSyncService.processRowCreate(row.id)
        
        results.created++
        apiLogger.info('WBS folder created successfully', { projectCode })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        apiLogger.error(`Failed to create WBS folder for ${projectCode}: ${errorMsg}`)
        results.errors.push(`${projectCode}: ${errorMsg}`)
      }
    }

    apiLogger.info('New project check completed', results)

    return NextResponse.json({
      success: true,
      message: `Checked ${results.checked} rows: created ${results.created} WBS folders, ${results.pendingApproval} pending approval, ${results.skipped} skipped, ${results.removed} removed from DB`,
      results
    })

  } catch (error) {
    apiLogger.error('Error checking for new projects', error as Error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check for new projects',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/portfolio/new-projects - Get status of projects without WBS
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    // Get portfolio sheet data
    const sheet = await SmartsheetAPI.getSheet(PORTFOLIO_SHEET_ID)

    const projectsWithoutWbs = []

    for (const row of sheet.rows) {
      const projectCode = SmartsheetAPI.getCellValue(row, sheet.columns, '###')
      if (!projectCode) continue

      const projectPlan = SmartsheetAPI.getCellValue(row, sheet.columns, 'Project Plan')
      
      if (!projectPlan) {
        projectsWithoutWbs.push({
          rowId: row.id,
          projectCode,
          projectName: SmartsheetAPI.getCellValue(row, sheet.columns, 'Project Name'),
          createdDate: SmartsheetAPI.getCellValue(row, sheet.columns, 'Created date'),
          wbsNeeded: SmartsheetAPI.getCellValue(row, sheet.columns, 'Work Breakdown Needed?')
        })
      }
    }

    return NextResponse.json({
      success: true,
      projectsWithoutWbs,
      count: projectsWithoutWbs.length
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get project status'
    }, { status: 500 })
  }
}

