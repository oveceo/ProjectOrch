import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { PortfolioSyncService } from '@/lib/portfolio-sync'
import { logger } from '@/lib/logger'

const apiLogger = logger.child('api:portfolio:new-projects')

// Smartsheet IDs
const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')

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

    // Find column IDs
    const projectCodeCol = SmartsheetAPI.findColumnByTitle(sheet.columns, '###')
    const projectNameCol = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Project Name')
    const wbsNeededCol = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Work Breakdown Needed?')
    const projectPlanCol = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Project Plan')

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
      errors: [] as string[]
    }

    // Process each row
    for (const row of sheet.rows) {
      results.checked++

      // Get project code from ### column
      const projectCode = SmartsheetAPI.getCellValue(row, sheet.columns, '###')
      if (!projectCode) {
        continue // Skip rows without project code
      }

      // Check if WBS is needed (if column exists)
      let wbsNeeded = true
      if (wbsNeededCol) {
        const wbsValue = SmartsheetAPI.getCellValue(row, sheet.columns, 'Work Breakdown Needed?')
        wbsNeeded = wbsValue === true || wbsValue === 'Yes' || wbsValue === 'TRUE'
      }

      // Check if already has a project plan link (WBS already exists)
      const projectPlanValue = projectPlanCol 
        ? SmartsheetAPI.getCellValue(row, sheet.columns, 'Project Plan')
        : null
      
      const alreadyHasWbs = !!projectPlanValue

      // Skip if doesn't need WBS or already has one
      if (!wbsNeeded || alreadyHasWbs) {
        results.skipped++
        continue
      }

      // Check if project exists in our database
      let project = await prisma.project.findUnique({
        where: { projectCode }
      })

      // If project doesn't exist, create it
      if (!project) {
        const projectName = projectNameCol 
          ? SmartsheetAPI.getCellValue(row, sheet.columns, 'Project Name') || projectCode
          : projectCode

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

      // Check if project already has WBS folder
      if (project.wbsSheetId) {
        apiLogger.info('Project already has WBS', { projectCode })
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
      message: `Checked ${results.checked} rows, created ${results.created} WBS folders, skipped ${results.skipped}`,
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

