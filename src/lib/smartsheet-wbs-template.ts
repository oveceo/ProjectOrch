import { SmartsheetAPI } from '@/lib/smartsheet'

const smartsheet = require('smartsheet')
const client = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN || '',
  logLevel: 'info'
})

/**
 * Create a WBS sheet by copying from an existing template
 * This is simpler and more reliable than creating from scratch
 */
export async function createWbsSheetFromTemplate(
  projectCode: string, 
  projectTitle: string, 
  targetFolderId: number,
  templateSheetId?: number
) {
  try {
    if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
      throw new Error('Smartsheet access token not configured')
    }

    // If we have a template sheet ID, copy from it
    if (templateSheetId) {
      console.log(`Copying WBS template sheet ${templateSheetId} for project ${projectCode}`)
      
      const copyResponse = await client.sheets.copySheet({
        sheetId: templateSheetId,
        body: {
          destinationType: 'folder',
          destinationId: targetFolderId,
          newName: 'Work Breakdown Schedule'
        }
      })

      const newSheetId = copyResponse.result.id
      console.log(`✅ Created WBS sheet from template: ${newSheetId}`)

      // Update the project code in the new sheet
      await updateProjectCodeInWbsSheet(newSheetId, projectCode, projectTitle)

      return {
        success: true,
        sheetId: newSheetId,
        sheetName: 'Work Breakdown Schedule'
      }
    } else {
      // Create a basic sheet with minimal structure
      return await createBasicWbsSheet(projectCode, projectTitle, targetFolderId)
    }

  } catch (error) {
    console.error('Error creating WBS sheet from template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Create a basic WBS sheet with essential columns
 */
async function createBasicWbsSheet(projectCode: string, projectTitle: string, targetFolderId: number) {
  try {
    // Create sheet with basic columns that match your existing structure
    const basicColumns = [
      { title: 'Name', type: 'TEXT_NUMBER', primary: true },
      { title: 'Description', type: 'TEXT_NUMBER' },
      { title: 'Assigned To', type: 'CONTACT_LIST' },
      { title: 'Status', type: 'PICKLIST', options: ['Not Started', 'In Progress', 'Complete'] },
      { title: 'Start Date', type: 'DATE' },
      { title: 'End Date', type: 'DATE' },
      { title: 'Budget', type: 'TEXT_NUMBER' },
      { title: 'Actual', type: 'TEXT_NUMBER' },
      { title: 'Notes', type: 'TEXT_NUMBER' }
    ]

    const sheetResponse = await client.sheets.createSheet({
      body: {
        name: 'Work Breakdown Schedule',
        columns: basicColumns,
        folderId: targetFolderId
      }
    })

    const sheetId = sheetResponse.result.id
    console.log(`Created basic WBS sheet: ${sheetId}`)

    // Add initial project row
    const columns = sheetResponse.result.columns
    const nameColumnId = columns.find((col: any) => col.title === 'Name')?.id
    const descColumnId = columns.find((col: any) => col.title === 'Description')?.id
    const statusColumnId = columns.find((col: any) => col.title === 'Status')?.id

    if (nameColumnId && descColumnId && statusColumnId) {
      await client.sheets.addRows({
        sheetId,
        body: [{
          toTop: true,
          cells: [
            { columnId: nameColumnId, value: `* ${projectTitle} *` },
            { columnId: descColumnId, value: `${projectCode} - ${projectTitle}` },
            { columnId: statusColumnId, value: 'Not Started' }
          ]
        }]
      })
      console.log(`✅ Added initial project row to WBS sheet`)
    }

    return {
      success: true,
      sheetId,
      sheetName: 'Work Breakdown Schedule'
    }

  } catch (error) {
    console.error('Error creating basic WBS sheet:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Update project code references in a copied WBS sheet
 */
async function updateProjectCodeInWbsSheet(sheetId: number, projectCode: string, projectTitle: string) {
  try {
    // This would involve finding and updating cells that contain project references
    // For now, we'll just log that this step would happen
    console.log(`Would update project references in sheet ${sheetId} to use ${projectCode}`)
    
    // In a full implementation, you'd:
    // 1. Get all rows from the sheet
    // 2. Find rows that need project code updates
    // 3. Update those cells with the new project code
    
    return true
  } catch (error) {
    console.error('Error updating project code in WBS sheet:', error)
    return false
  }
}

/**
 * Get available WBS template sheets
 * This would scan for sheets marked as templates
 */
export async function getWbsTemplates() {
  try {
    // This would return a list of available template sheets
    // For now, return empty array - users can specify template ID manually
    return []
  } catch (error) {
    console.error('Error getting WBS templates:', error)
    return []
  }
}
