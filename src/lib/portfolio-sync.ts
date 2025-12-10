import { prisma } from './db'
import { SmartsheetAPI } from './smartsheet'
import { ProjectStatus, ApprovalStatus } from '@prisma/client'
import { AuditEntry } from '@/types'

// Smartsheet Portfolio sheet configuration
const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')
const WBS_TEMPLATE_FOLDER_ID = parseInt(process.env.SMARTSHEET_WBS_TEMPLATE_FOLDER_ID || '2374072609859460')  // "Work Breakdown Schedule (Save As New)" folder
const WBS_PARENT_FOLDER_ID = parseInt(process.env.SMARTSHEET_WBS_PARENT_FOLDER_ID || '4414766191011716')      // "Work Breakdown Schedules" parent folder

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

      // ONLY TRIGGER: Approval Status = "Approved" AND no WBS exists yet
      if (projectData.approvalStatus === ApprovalStatus.Approved && !project.wbsSheetId) {
        await this.createWbsForProject(project)
      }

      console.log(`Processed project update: ${projectData.projectCode}`)
    } catch (error) {
      console.error(`Error processing row ${rowId}:`, error)
      throw error
    }
  }

  /**
   * Safely convert any value to string or null
   */
  private static toStringOrNull(value: any): string | null {
    if (value === null || value === undefined) return null
    return String(value)
  }

  /**
   * Extract project data from Smartsheet row
   * All string fields are explicitly converted to ensure type safety
   */
  private static extractProjectData(row: any, columns: any[]): any {
    const projectCode = this.toStringOrNull(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.PROJECT_CODE))
    return {
      projectCode: projectCode,
      title: projectCode, // Use project code as title for WBS management
      description: this.toStringOrNull(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.PROJECT_NAME)),
      category: this.toStringOrNull(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.CATEGORY)),
      approverEmail: this.toStringOrNull(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.APPROVED_BY)),
      assigneeEmail: this.toStringOrNull(SmartsheetAPI.getCellValue(row, columns, PORTFOLIO_COLUMNS.ASSIGNED_TO)),
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
   * 
   * Steps:
   * 1. Create new empty folder named "WBS (#P-XXXX)"
   * 2. Get template folder contents
   * 3. Copy each sheet from template to new folder
   * 4. Update row 1 Name cell with project code in the WBS sheet
   */
  private static async createWbsForProject(project: any): Promise<void> {
    try {
      console.log(`Creating WBS structure for project ${project.projectCode}`)

      // Step 1: Create new empty folder
      const folderName = `WBS (#${project.projectCode})`
      console.log(`Creating folder: ${folderName}`)
      
      const createFolderResponse = await SmartsheetAPI.createFolder(folderName, WBS_PARENT_FOLDER_ID)
      const projectFolderId = createFolderResponse.result.id
      console.log(`✅ Created folder: ${folderName} (ID: ${projectFolderId})`)

      // Step 2: Get template folder contents
      const templateFolder = await SmartsheetAPI.getFolder(WBS_TEMPLATE_FOLDER_ID)
      console.log(`📁 Template folder ID: ${WBS_TEMPLATE_FOLDER_ID}`)
      console.log(`📁 Template folder contents:`)
      console.log(`   - Sheets: ${templateFolder.sheets?.length || 0}`)
      console.log(`   - Reports: ${templateFolder.reports?.length || 0}`)
      console.log(`   - Dashboards (sights): ${templateFolder.sights?.length || 0}`)
      console.log(`📁 Full template folder response:`, JSON.stringify(templateFolder, null, 2))

      // Step 3: Copy ALL items from template to new folder (sheets, reports, dashboards)
      let wbsSheetId: number | null = null
      let wbsSheetPermalink: string | null = null
      
      // Copy sheets
      for (const templateSheet of (templateFolder.sheets || [])) {
        console.log(`Copying sheet: ${templateSheet.name}`)
        
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
          console.log(`Found and copied WBS sheet: ${wbsSheetId}`)
        }
      }

      // Copy reports - need to figure out the correct API approach
      for (const templateReport of (templateFolder.reports || [])) {
        try {
          console.log(`Copying report: ${templateReport.name} (ID: ${templateReport.id})`)
          console.log(`Report data:`, JSON.stringify(templateReport, null, 2))
          
          // Try to get the report first to verify the ID is valid
          const reportDetails = await SmartsheetAPI.getReport(templateReport.id)
          console.log(`Report details fetched successfully:`, reportDetails.name)
          
          // Now try to copy it
          await SmartsheetAPI.copyReport(templateReport.id, templateReport.name, projectFolderId)
          console.log(`✅ Copied report: ${templateReport.name}`)
        } catch (err: any) {
          console.error(`❌ Failed to copy report "${templateReport.name}":`, err.message)
          console.error(`Full error:`, err)
        }
      }

      // Copy dashboards (optional - don't fail if dashboards can't be copied)
      for (const templateDashboard of (templateFolder.sights || [])) {
        try {
          console.log(`Copying dashboard: ${templateDashboard.name}`)
          await SmartsheetAPI.copyDashboard(templateDashboard.id, templateDashboard.name, projectFolderId)
          console.log(`✅ Copied dashboard: ${templateDashboard.name}`)
        } catch (err) {
          console.warn(`⚠️ Could not copy dashboard "${templateDashboard.name}" - dashboards may need manual setup`)
        }
      }

      if (!wbsSheetId) {
        throw new Error('WBS sheet not found in template folder')
      }

      // Step 4: Update the first row's Name cell with project code
      const sheet = await SmartsheetAPI.getSheet(wbsSheetId)
      const firstRow = sheet.rows[0]

      if (firstRow) {
        const nameColumn = SmartsheetAPI.findColumnByTitle(sheet.columns, 'Name')

        if (nameColumn) {
          await SmartsheetAPI.updateRows(wbsSheetId, [{
            id: firstRow.id,
            cells: [
              SmartsheetAPI.createCell(nameColumn.id, project.projectCode)
            ]
          }])
          console.log(`✅ Updated WBS sheet row 1 Name cell with: ${project.projectCode}`)
        }
      }

      // Step 5: Create hyperlinks in Portfolio sheet
      await this.updatePortfolioLinks(project, wbsSheetId, wbsSheetPermalink || '')

      // Step 6: Update project record with folder and sheet info
      await prisma.project.update({
        where: { id: project.id },
        data: {
          wbsFolderId: projectFolderId.toString(),
          wbsSheetId: wbsSheetId.toString(),
          wbsSheetUrl: wbsSheetPermalink,
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
