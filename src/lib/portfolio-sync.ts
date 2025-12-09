import { prisma } from './db'
import { SmartsheetAPI } from './smartsheet'
import { ProjectStatus, ApprovalStatus } from '@prisma/client'
import { AuditEntry } from '@/types'

// Smartsheet Portfolio sheet configuration
const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')
const WBS_TEMPLATE_SHEET_ID = parseInt(process.env.SMARTSHEET_WBS_TEMPLATE_SHEET_ID || '2074433216794500')
const WBS_FOLDER_ID = parseInt(process.env.SMARTSHEET_WBS_FOLDER_ID || '4414766191011716')

// Column mapping for Portfolio sheet
const PORTFOLIO_COLUMNS = {
  CREATED_DATE: 'Created date',
  CREATED_BY: 'Created by',
  PROJECT_CODE: '###',
  PROJECT_NAME: 'Project Name',
  DESCRIPTION: 'Description',
  CATEGORY: 'Category',
  APPROVED_BY: 'Approved By',
  APPROVAL_STATUS: 'Approval Status',
  PRIORITY: 'Priority',
  ASSIGNED_TO: 'Assigned To',
  PROJECT_PLAN: 'Project Plan',
  STATUS: 'Status',
  START_DATE: 'Start Date',
  END_DATE: 'End Date',
  AT_RISK: 'At Risk',
  BUDGET: 'Budget',
  ACTUAL: 'Actual',
  VARIANCE: 'Variance',
  WORK_BREAKDOWN_NEEDED: 'Work Breakdown Needed?',
  WBS_APP_LINK: 'WBS App Link',
  LAST_UPDATE: 'Last Update'
}

export class PortfolioSyncService {
  /**
   * Process webhook payload from Smartsheet
   */
  static async processWebhook(payload: any): Promise<void> {
    try {
      const { events } = payload

      for (const event of events) {
        if (event.objectType === 'row' && event.eventType === 'updated') {
          await this.processRowUpdate(event.rowId)
        } else if (event.objectType === 'row' && event.eventType === 'created') {
          await this.processRowCreate(event.rowId)
        }
      }
    } catch (error) {
      console.error('Error processing webhook:', error)
      throw error
    }
  }

  /**
   * Process individual row creation
   */
  static async processRowCreate(rowId: number): Promise<void> {
    await this.processRowUpdate(rowId)
  }

  /**
   * Process individual row update
   */
  static async processRowUpdate(rowId: number): Promise<void> {
    try {
      // Get the sheet data
      const sheet = await SmartsheetAPI.getSheet(PORTFOLIO_SHEET_ID)
      const row = sheet.rows.find(r => r.id === rowId)

      if (!row) {
        console.warn(`Row ${rowId} not found in portfolio sheet`)
        return
      }

      // Extract project data from the row
      const projectData = this.extractProjectData(row, sheet.columns)

      if (!projectData.projectCode) {
        console.warn(`Row ${rowId} missing project code, skipping`)
        return
      }

      // Upsert project in database
      const project = await this.upsertProject(projectData, rowId)

      // Log the project creation/update with the P number as title
      console.log(`Project ${projectData.projectCode} processed - Title set to: ${project.title}`)

      // Check if WBS is needed and create if necessary
      if (projectData.requiresWbs && !project.wbsSheetId) {
        await this.createWbsForProject(project)
      }

      console.log(`Processed project update: ${projectData.projectCode}`)
    } catch (error) {
      console.error(`Error processing row ${rowId}:`, error)
      throw error
    }
  }

  /**
   * Extract project data from Smartsheet row
   */
  private static extractProjectData(row: any, columns: any[]): any {
    const projectCode = SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.PROJECT_CODE)
    return {
      projectCode: projectCode,
      title: projectCode, // Use project code as title for WBS management
      description: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.PROJECT_NAME), // Move project name to description
      category: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.CATEGORY),
      approverEmail: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.APPROVED_BY),
      assigneeEmail: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.ASSIGNED_TO),
      approvalStatus: this.mapApprovalStatus(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.APPROVAL_STATUS)),
      status: this.mapProjectStatus(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.STATUS)),
      requiresWbs: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.WORK_BREAKDOWN_NEEDED) === true,
      budget: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.BUDGET),
      actual: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.ACTUAL),
      variance: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.VARIANCE),
      startDate: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.START_DATE),
      endDate: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.END_DATE),
      atRisk: SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.AT_RISK) === true
    }
  }

  /**
   * Map Smartsheet approval status to enum
   */
  private static mapApprovalStatus(status: string): ApprovalStatus {
    switch (status?.toLowerCase()) {
      case 'approved':
        return ApprovalStatus.Approved
      case 'rejected':
        return ApprovalStatus.Rejected
      default:
        return ApprovalStatus.Pending_Approval
    }
  }

  /**
   * Map Smartsheet project status to enum
   */
  private static mapProjectStatus(status: string): ProjectStatus {
    switch (status?.toLowerCase()) {
      case 'not started':
        return ProjectStatus.Not_Started
      case 'in progress':
        return ProjectStatus.In_Progress
      case 'blocked':
        return ProjectStatus.Blocked
      case 'at risk':
        return ProjectStatus.At_Risk
      case 'complete':
        return ProjectStatus.Complete
      default:
        return ProjectStatus.Not_Started
    }
  }

  /**
   * Upsert project in database
   */
  private static async upsertProject(projectData: any, portfolioRowId: number): Promise<any> {
    const project = await prisma.project.upsert({
      where: { projectCode: projectData.projectCode },
      update: {
        portfolioRowId: portfolioRowId.toString(),
        title: projectData.title,
        description: projectData.description,
        category: projectData.category,
        approverEmail: projectData.approverEmail,
        assigneeEmail: projectData.assigneeEmail,
        approvalStatus: projectData.approvalStatus,
        status: projectData.status,
        requiresWbs: projectData.requiresWbs,
        lastUpdateAt: new Date()
      },
      create: {
        portfolioRowId: portfolioRowId.toString(),
        projectCode: projectData.projectCode,
        title: projectData.title,
        description: projectData.description,
        category: projectData.category,
        approverEmail: projectData.approverEmail,
        assigneeEmail: projectData.assigneeEmail,
        approvalStatus: projectData.approvalStatus,
        status: projectData.status,
        requiresWbs: projectData.requiresWbs
      }
    })

    return project
  }

  /**
   * Create WBS sheet for project with proper folder structure
   */
  private static async createWbsForProject(project: any): Promise<void> {
    try {
      console.log(`Creating WBS structure for project ${project.projectCode}`)

      // Step 1: Create project-specific folder
      const folderName = `WBS (#${project.projectCode})`
      const folderResponse = await SmartsheetAPI.createFolder(folderName, WBS_FOLDER_ID)
      const projectFolderId = folderResponse.result.id

      console.log(`Created folder: ${folderName} (ID: ${projectFolderId})`)

      // Step 2: Copy template to create new WBS sheet in the project folder
      const newSheet = await SmartsheetAPI.copySheet(
        WBS_TEMPLATE_SHEET_ID,
        `Work Breakdown Schedule`,
        projectFolderId
      )

      console.log(`Created WBS sheet: Work Breakdown Schedule (ID: ${newSheet.result.id})`)

      // Step 3: Update the first row with project code
      const sheet = await SmartsheetAPI.getSheet(newSheet.result.id)
      const firstRow = sheet.rows[0]

      if (firstRow) {
        const wbsColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, 'WBS')
        const nameColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Name')

        if (wbsColumn && nameColumn) {
          await SmartsheetAPI.updateRows(newSheet.result.id, [{
            id: firstRow.id,
            cells: [
              SmartsheetAPI.createCell(wbsColumn.id, project.projectCode),
              SmartsheetAPI.createCell(nameColumn.id, 'Work Breakdown Schedule')
            ]
          }])
          console.log(`Updated WBS sheet header with project code: ${project.projectCode}`)
        }
      }

      // Step 4: Create hyperlinks in Portfolio sheet
      await this.updatePortfolioLinks(project, newSheet.result.id, newSheet.result.permalink)

      // Step 5: Update project record with folder and sheet info
      await prisma.project.update({
        where: { id: project.id },
        data: {
          wbsFolderId: projectFolderId.toString(),
          wbsSheetId: newSheet.result.id.toString(),
          wbsSheetUrl: newSheet.result.permalink,
          wbsAppUrl: `${process.env.APP_BASE_URL}/projects/${project.id}/wbs`
        }
      })

      console.log(`✅ Completed WBS structure creation for project ${project.projectCode}`)
    } catch (error) {
      console.error(`Error creating WBS structure for project ${project.projectCode}:`, error)
      throw error
    }
  }

  /**
   * Update Portfolio sheet with hyperlinks
   */
  private static async updatePortfolioLinks(project: any, wbsSheetId: number, wbsUrl: string): Promise<void> {
    const sheet = await SmartsheetAPI.getSheet(PORTFOLIO_SHEET_ID)
    const row = sheet.rows.find(r => r.id === parseInt(project.portfolioRowId))

    if (!row) return

    const projectPlanColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, PORTFOLIO_COLUMNS.PROJECT_PLAN)
    const wbsAppLinkColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, PORTFOLIO_COLUMNS.WBS_APP_LINK)

    const cells = []

    if (projectPlanColumn) {
      cells.push(SmartsheetAPI.createHyperlinkCell(
        projectPlanColumn.id,
        wbsUrl,
        'Work Breakdown Schedule'
      ))
    }

    if (wbsAppLinkColumn) {
      cells.push(SmartsheetAPI.createCell(
        wbsAppLinkColumn.id,
        `${process.env.APP_BASE_URL}/projects/${project.id}/wbs`
      ))
    }

    if (cells.length > 0) {
      await SmartsheetAPI.updateRows(PORTFOLIO_SHEET_ID, [{
        id: row.id,
        cells
      }])
    }
  }

  /**
   * Polling fallback for when webhooks are not available
   */
  static async pollPortfolioUpdates(): Promise<void> {
    try {
      console.log('Starting portfolio polling...')

      const sheet = await SmartsheetAPI.getSheet(PORTFOLIO_SHEET_ID)

      for (const row of sheet.rows) {
        const projectCode = SmartsheetAPI.getCellValue(row, sheet.columns, PORTFOLIO_COLUMNS.PROJECT_CODE)
        if (!projectCode) continue

        // Check if we need to process this row
        const existingProject = await prisma.project.findUnique({
          where: { projectCode }
        })

        if (!existingProject) {
          // New project
          await this.processRowUpdate(row.id)
        } else {
          // Check if last update is older than our record
          const lastUpdate = SmartsheetAPI.getCellValue(row, sheet.columns, PORTFOLIO_COLUMNS.LAST_UPDATE)
          if (!lastUpdate || !existingProject.lastUpdateAt || new Date(lastUpdate) > existingProject.lastUpdateAt) {
            await this.processRowUpdate(row.id)
          }
        }
      }

      console.log('Portfolio polling completed')
    } catch (error) {
      console.error('Error during portfolio polling:', error)
      throw error
    }
  }

  /**
   * Create audit entry for changes
   */
  private static async createAuditEntry(entry: AuditEntry): Promise<void> {
    await prisma.audit.create({
      data: {
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        payload: entry.payload
      }
    })
  }
}
