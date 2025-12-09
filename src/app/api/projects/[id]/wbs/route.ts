import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { logger, startTimer } from '@/lib/logger'
import { extractUserLastName } from '@/lib/validation'
import { ProjectStatus } from '@prisma/client'

const apiLogger = logger.child('api:project-wbs')

interface RouteParams {
  params: Promise<{ id: string }>
}

// Status mapping from Smartsheet to app
// Valid ProjectStatus values: Not_Started, In_Progress, Complete, Approval_Pending, Approved, Blocked, At_Risk
const STATUS_FROM_SMARTSHEET: Record<string, string> = {
  'Not Started': 'Not_Started',
  'In Progress': 'In_Progress',
  'Complete': 'Complete',
  'On Hold': 'Not_Started',     // Map to closest valid status
  'Blocked': 'Blocked',
  'At Risk': 'At_Risk',
  'Approval Pending': 'Approval_Pending',
  'Approved': 'Approved'
}

// Status mapping from app to Smartsheet (only 4 valid statuses)
const STATUS_TO_SMARTSHEET: Record<string, string> = {
  'Not_Started': 'Not Started',
  'In_Progress': 'In Progress',
  'Blocked': 'Blocked',
  'Complete': 'Complete',
}

// GET /api/projects/[id]/wbs - Get WBS items for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  const getElapsed = startTimer()
  const { id: projectId } = await params

  try {
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const shouldSync = searchParams.get('sync') === 'true'

    apiLogger.debug('Fetching WBS for project', { projectId, shouldSync, userLastName })

    // Get the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        title: true,
        wbsSheetId: true,
        wbsSheetUrl: true
      }
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    // If sync requested and project has a Smartsheet WBS, fetch from there
    if (shouldSync && project.wbsSheetId) {
      try {
        const sheetId = parseInt(project.wbsSheetId)
        apiLogger.info('Syncing WBS from Smartsheet', { sheetId, projectCode: project.projectCode })
        
        const sheet = await SmartsheetAPI.getSheet(sheetId)
        const columns = sheet.columns
        const rows = sheet.rows

    // Map Smartsheet data to our format (note: wbsNumber is NOT stored in DB, only computed for display)
    const wbsItems = rows.map((row, index) => {
      const getValue = (columnTitle: string) => SmartsheetAPI.getCellValue(row, columns, columnTitle)
      
      const statusValue = getValue('Status') || 'Not Started'
      const mappedStatus = (STATUS_FROM_SMARTSHEET[statusValue] || 'Not_Started') as ProjectStatus

      return {
        smartsheetRowId: String(row.id),
        parentRowId: row.parentId ? String(row.parentId) : null,
        name: getValue('Name') || getValue('Task Name') || `Row ${index + 1}`,
        description: getValue('Description') || null,
        ownerLastName: extractLastName(getValue('Assigned To')),
        approverLastName: extractLastName(getValue('Approver')),
        status: mappedStatus,
        startDate: parseDate(getValue('Start Date')),
        endDate: parseDate(getValue('End Date')),
        atRisk: getValue('At Risk') === true || getValue('At Risk') === 'Yes',
        budget: getValue('Budget') ? String(getValue('Budget')) : null,
        actual: getValue('Actual') ? String(getValue('Actual')) : null,
        variance: getValue('Variance') ? String(getValue('Variance')) : null,
        notes: getValue('Notes') || null,
        skipWbs: getValue('Skip WBS') === true || getValue('Skip WBS') === 'Yes',
        orderIndex: index
      }
    })

        // Upsert to database
        for (const item of wbsItems) {
          await prisma.wbsCache.upsert({
            where: { smartsheetRowId: item.smartsheetRowId },
            update: {
              ...item,
              projectId,
              lastSyncedAt: new Date()
            },
            create: {
              ...item,
              projectId,
              lastSyncedAt: new Date()
            }
          })
        }

        apiLogger.info('WBS synced from Smartsheet', { 
          projectCode: project.projectCode, 
          itemCount: wbsItems.length,
          duration: getElapsed()
        })
      } catch (syncError) {
        apiLogger.error('Failed to sync from Smartsheet', syncError as Error)
        // Continue with cached data
      }
    }

    // Fetch from database
    const wbsItems = await prisma.wbsCache.findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: wbsItems,
      meta: {
        count: wbsItems.length,
        projectCode: project.projectCode,
        hasSmartsheet: !!project.wbsSheetId
      }
    })

  } catch (error) {
    apiLogger.error('Failed to fetch WBS', error as Error, { projectId })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/wbs - Save WBS items (bulk upsert)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const getElapsed = startTimer()
  const { id: projectId } = await params

  try {
    const authHeader = request.headers.get('authorization')
    const userLastName = extractUserLastName(authHeader)

    if (!userLastName) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Items must be an array' }, { status: 400 })
    }

    apiLogger.info('Saving WBS items', { projectId, itemCount: items.length, userLastName })
    
    // Debug: Log structure of items being saved
    const rootItems = items.filter(i => !i.parentId && !i.parentRowId)
    const childItems = items.filter(i => i.parentId || i.parentRowId)
    const newItems = items.filter(i => !i.id || i.id.startsWith?.('temp_'))
    apiLogger.info('Item structure', { 
      rootCount: rootItems.length,
      rootNames: rootItems.map(i => i.name),
      childCount: childItems.length,
      newItemCount: newItems.length,
      newItemNames: newItems.map(i => i.name),
      skipWbsItems: items.filter(i => i.skipWbs).map(i => i.name)
    })

    // Get project info for Smartsheet sync
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectCode: true, wbsSheetId: true }
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    // Get existing items for comparison
    const existingItems = await prisma.wbsCache.findMany({
      where: { projectId },
      select: { id: true, smartsheetRowId: true }
    })
    const existingIds = new Set(existingItems.map(i => i.id))

    // Track which items to keep
    const itemsToKeep = new Set<string>()

    // Valid statuses from the enum (only 4 valid in Smartsheet)
    const validStatuses = ['Not_Started', 'In_Progress', 'Blocked', 'Complete']
    
    // First pass: Create/update all items and build ID mapping
    const savedItems: any[] = []
    const tempIdToRealId = new Map<string, string>()
    
    // Process items in order (parents before children due to flat structure from frontend)
    for (const item of items) {
      // Map status to valid enum value
      let status = item.status || 'Not_Started'
      if (!validStatuses.includes(status)) {
        if (status === 'On_Hold' || status === 'Pending') status = 'Not_Started'
        else if (status === 'Done' || status === 'Completed') status = 'Complete'
        else status = 'Not_Started'
      }

      // Resolve parent ID - prefer parentRowId (Smartsheet row ID) if available
      // Frontend now sends both parentId (database ID) and parentRowId (Smartsheet row ID)
      let resolvedParentId = item.parentRowId || item.parentId
      
      // If it's a temp ID, try to resolve to the real ID we created earlier
      if (resolvedParentId && tempIdToRealId.has(resolvedParentId)) {
        resolvedParentId = tempIdToRealId.get(resolvedParentId)
      }
      // If parent ID is still a temp ID that we haven't processed, set to null
      if (resolvedParentId && resolvedParentId.startsWith('temp_') && !tempIdToRealId.has(resolvedParentId)) {
        resolvedParentId = null
      }

      const data = {
        projectId,
        name: item.name,
        description: item.description || null,
        ownerLastName: item.ownerLastName || null,
        approverLastName: item.approverLastName || null,
        status: status as ProjectStatus,
        startDate: item.startDate ? new Date(item.startDate) : null,
        endDate: item.endDate ? new Date(item.endDate) : null,
        atRisk: item.atRisk || false,
        budget: item.budget ? String(item.budget) : null,
        actual: item.actual ? String(item.actual) : null,
        variance: item.variance ? String(item.variance) : null,
        notes: item.notes || null,
        skipWbs: item.skipWbs || false,
        orderIndex: item.orderIndex ?? 0,
        parentRowId: resolvedParentId,
        lastSyncedAt: new Date()
      }

      let savedItem
      const isExisting = item.id && !item.id.startsWith('temp_') && existingIds.has(item.id)
      
      if (isExisting) {
        // Update existing
        savedItem = await prisma.wbsCache.update({
          where: { id: item.id },
          data
        })
        itemsToKeep.add(item.id)
      } else {
        // Create new
        savedItem = await prisma.wbsCache.create({
          data: {
            ...data,
            smartsheetRowId: item.smartsheetRowId || null
          }
        })
        // Map temp ID to real ID for child items
        // Check BOTH item.id (if it's a temp ID) AND item.tempId (frontend might send this way)
        const tempId = (item.id && item.id.startsWith('temp_')) ? item.id : item.tempId
        if (tempId) {
          tempIdToRealId.set(tempId, savedItem.id)
          apiLogger.debug('Mapped temp ID to real ID', { tempId, realId: savedItem.id })
        }
        itemsToKeep.add(savedItem.id)
      }
      savedItems.push(savedItem)
    }
    
    // Second pass: Update parent references for items that referenced temp IDs
    for (const savedItem of savedItems) {
      if (savedItem.parentRowId && tempIdToRealId.has(savedItem.parentRowId)) {
        await prisma.wbsCache.update({
          where: { id: savedItem.id },
          data: { parentRowId: tempIdToRealId.get(savedItem.parentRowId) }
        })
      }
    }

    // Delete items that were removed
    const itemsToDelete = existingItems.filter(i => !itemsToKeep.has(i.id))
    if (itemsToDelete.length > 0) {
      await prisma.wbsCache.deleteMany({
        where: {
          id: { in: itemsToDelete.map(i => i.id) }
        }
      })
    }

    // Sync to Smartsheet if available
    let smartsheetSyncResult = { updated: 0, created: 0, errors: [] as string[] }
    if (project.wbsSheetId) {
      smartsheetSyncResult = await syncToSmartsheet(project.wbsSheetId, savedItems)
    }

    // Create audit entry
    await prisma.audit.create({
      data: {
        actorEmail: `${userLastName}@ove.com`,
        action: 'UPDATE_PROJECT_WBS',
        targetType: 'Project',
        targetId: projectId,
        payload: JSON.stringify({
          itemCount: savedItems.length,
          deletedCount: itemsToDelete.length,
          timestamp: new Date().toISOString()
        })
      }
    })

    apiLogger.info('WBS items saved', { 
      projectId, 
      savedCount: savedItems.length,
      deletedCount: itemsToDelete.length,
      duration: getElapsed()
    })

    const syncMsg = []
    if (smartsheetSyncResult.updated > 0) syncMsg.push(`updated ${smartsheetSyncResult.updated}`)
    if (smartsheetSyncResult.created > 0) syncMsg.push(`created ${smartsheetSyncResult.created}`)
    
    return NextResponse.json({
      success: true,
      data: savedItems,
      message: `Saved ${savedItems.length} items${syncMsg.length > 0 ? ` (Smartsheet: ${syncMsg.join(', ')})` : ''}`,
      smartsheetSync: smartsheetSyncResult
    })

  } catch (error) {
    apiLogger.error('Failed to save WBS', error as Error, { projectId })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Extract last name from full name or email
function extractLastName(value: any): string | null {
  if (!value) return null
  const str = String(value).trim()
  
  // Handle "Approver, Keith Clark" format
  if (str.includes(',')) {
    const parts = str.split(',').map(p => p.trim())
    if (parts.length >= 2) {
      const namePart = parts[1] // "Keith Clark"
      const nameWords = namePart.split(/\s+/)
      const lastName = nameWords[nameWords.length - 1]
      return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
    }
  }
  
  // If it's an email (e.g., jforster@ovec.com), extract last name
  if (str.includes('@')) {
    const namePart = str.split('@')[0] // "jforster"
    // Check if it has dots (e.g., james.forster@)
    if (namePart.includes('.')) {
      const parts = namePart.split('.')
      const lastName = parts[parts.length - 1]
      return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
    }
    // Otherwise assume first letter is initial: jforster -> forster -> Forster
    const lastName = namePart.length > 1 ? namePart.slice(1) : namePart
    return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
  }
  
  // If it's a full name, get last word
  const parts = str.split(/\s+/)
  if (parts.length > 1) {
    const lastName = parts[parts.length - 1]
    return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
  }
  
  // Single word - just capitalize properly
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Helper: Parse date value
function parseDate(value: any): Date | null {
  if (!value) return null
  try {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

// Helper: Parse currency/number string to number
function parseCurrency(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  // Remove $ signs, commas, and spaces
  const cleaned = str.replace(/[$,\s]/g, '')
  if (!cleaned || cleaned === '') return null
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// Helper: Build contact map from Smartsheet data
// Extracts all "Assigned To" values and maps last names to EMAIL addresses
// Smartsheet CONTACT columns require emails, not display names
function buildContactMapFromSheet(rows: any[], columns: any[]): Map<string, string> {
  const contactMap = new Map<string, string>()
  
  try {
    const assignedToCol = columns.find((col: any) => 
      col.title?.toLowerCase() === 'assigned to'
    )
    if (!assignedToCol) return contactMap

    for (const row of rows || []) {
      try {
        const cell = row.cells?.find((c: any) => c.columnId === assignedToCol.id)
        if (!cell) continue
        
        // For CONTACT columns, Smartsheet stores the email in cell.value
        // and the display name in cell.displayValue
        let email = ''
        let displayValue = ''
        
        // Debug: log the raw cell data including objectValue
        apiLogger.debug('Contact cell data', { 
          rowId: row.id,
          value: cell.value, 
          displayValue: cell.displayValue,
          objectValue: cell.objectValue,
          valueType: typeof cell.value
        })
        
        // Get email - Smartsheet stores emails in objectValue.email for contact columns
        // Try objectValue first (Smartsheet API v2 format)
        if (cell.objectValue?.email) {
          email = cell.objectValue.email.trim()
        }
        // Then try value (could be string email or object with email property)
        else if (cell.value) {
          if (typeof cell.value === 'string' && cell.value.includes('@')) {
            email = cell.value.trim()
          } else if (typeof cell.value === 'object' && cell.value.email) {
            email = cell.value.email.trim()
          }
        }
        
        // Get display value for extracting last name
        if (cell.displayValue) {
          displayValue = String(cell.displayValue).trim()
        } else if (email) {
          displayValue = email
        }
        
        if (!displayValue) continue
        
        // Extract last name from the display value or email
        let lastName = ''
        
        if (displayValue.includes('@')) {
          // Email format: forster@ovec.com or james.forster@ovec.com
          const localPart = displayValue.split('@')[0]
          const parts = localPart.split('.')
          lastName = parts[parts.length - 1]
        } else if (displayValue.includes(',')) {
          // "Forster, James" format
          lastName = displayValue.split(',')[0].trim()
        } else {
          // "James Forster" format - last word is last name
          const parts = displayValue.split(/\s+/)
          lastName = parts[parts.length - 1]
        }
        
        if (!lastName) continue
        
        // Normalize last name for lookup
        const normalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
        
        // Store the mapping: lastName -> EMAIL (not display name!)
        // Only store if we have an actual email
        if (!contactMap.has(normalizedLastName) && email) {
          contactMap.set(normalizedLastName, email)
          apiLogger.debug('Contact map entry', { lastName: normalizedLastName, email })
        }
      } catch (rowError) {
        // Skip problematic rows
        continue
      }
    }
  } catch (error) {
    apiLogger.warn('Error building contact map', { error })
  }
  
  return contactMap
}

// OVEC Contact Directory - maps last names to full contact objects
// Smartsheet CONTACT columns require objectValue with objectType, email, and name
// Email formats from smartsheet_contacts CSV - some are truncated (e.g., cgallowa, dthompso)
const OVEC_CONTACTS: Record<string, { email: string; name: string }> = {
  'Adams': { email: 'iadams@ovec.com', name: 'Isaac Adams' },
  'Allen': { email: 'mallen@ovec.com', name: 'Mathew Allen' },
  'Barringer': { email: 'gbarringer@ovec.com', name: 'Garrett Barringer' },
  'Campbell': { email: 'jcampbel@ovec.com', name: 'Joshua Campbell' },
  'Clark': { email: 'kclark@ovec.com', name: 'Keith Clark' },
  'Donahue': { email: 'jdonahue@ovec.com', name: 'Jim Donahue' },
  'Egbert': { email: 'eegbert@ovec.com', name: 'Elliott Egbert' },
  'Elswick': { email: 'eelswick@ovec.com', name: 'Eron Elswick' },
  'Fields': { email: 'tfields@ovec.com', name: 'Terry Fields' },
  'Forster': { email: 'jforster@ovec.com', name: 'James Forster' },
  'Galloway': { email: 'cgallowa@ovec.com', name: 'Craig Galloway' }, // Craig, not Jeremy
  'Green': { email: 'jgreen@ovec.com', name: 'Joshua Green' },
  'Hicks': { email: 'bhicks@ovec.com', name: 'Brian Hicks' },
  'Holskey': { email: 'mholskey@ovec.com', name: 'Michael Holskey' },
  'Huff': { email: 'ahuff@ovec.com', name: 'Ann Huff' },
  'McCord': { email: 'pmccord@ovec.com', name: 'Phillip McCord' },
  'Merritt': { email: 'jmerritt@ovec.com', name: 'Jason Merritt' },
  'Privette': { email: 'nprivette@ovec.com', name: 'Nick Privette' },
  'Roberts': { email: 'nroberts@ovec.com', name: 'Nate Roberts' },
  'Southall': { email: 'tsouthal@ovec.com', name: 'Timothy Southall' },
  'Thomas': { email: 'mthomas@ovec.com', name: 'Mike Thomas' },
  'Thompson': { email: 'dthompso@ovec.com', name: 'Darrell Thompson' },
  'Waugh': { email: 'rwaugh@ovec.com', name: 'Bob Waugh' },
  'Woodworth': { email: 'jwoodworth@ovec.com', name: 'Josh Woodworth' },
}

// Helper: Build Smartsheet Contact object from last name
// Returns the proper objectValue structure that Smartsheet expects for CONTACT cells
function buildContactObject(lastName: string | null, contactMap: Map<string, string>): object | null {
  if (!lastName) return null
  
  // Normalize the last name for lookup
  const normalizedName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
  
  // Look up in our contact directory
  const contact = OVEC_CONTACTS[normalizedName]
  if (contact) {
    apiLogger.debug('Building contact object', { lastName: normalizedName, email: contact.email })
    return {
      objectType: 'CONTACT',
      email: contact.email,
      name: contact.name
    }
  }
  
  // Check if we extracted an email from Smartsheet data
  const extractedEmail = contactMap.get(normalizedName)
  if (extractedEmail && extractedEmail.includes('@')) {
    return {
      objectType: 'CONTACT',
      email: extractedEmail,
      name: normalizedName
    }
  }
  
  // If we don't have contact info, skip updating this field
  apiLogger.info('No contact found, skipping Assigned To update', { lastName })
  return null
}

// Helper: Sync items to Smartsheet
async function syncToSmartsheet(sheetId: string, items: any[]): Promise<{ updated: number; created: number; errors: string[] }> {
  const result = { updated: 0, created: 0, errors: [] as string[] }
  
  try {
    const sheetIdNum = parseInt(sheetId)
    apiLogger.info('Starting Smartsheet sync', { sheetId: sheetIdNum, itemCount: items.length })
    
    const sheet = await SmartsheetAPI.getSheet(sheetIdNum)
    const columns = sheet.columns
    const existingRows = sheet.rows

    // Find column IDs
    const getColumnId = (title: string) => {
      const col = SmartsheetAPI.findColumnByTitle(columns, title)
      return col?.id
    }

    // Note: Some columns are FORMULAS in Smartsheet and cannot be edited:
    // - Variance (typically = Budget - Actual)
    // - WBS (typically auto-calculated from hierarchy)
    // - Skip WBS (may be locked)
    const columnMap = {
      name: getColumnId('Name') || getColumnId('Task Name'),
      description: getColumnId('Description'),
      assignedTo: getColumnId('Assigned To'),
      approver: getColumnId('Approver'),
      status: getColumnId('Status'),
      startDate: getColumnId('Start Date'),
      endDate: getColumnId('End Date'),
      atRisk: getColumnId('At Risk'),
      budget: getColumnId('Budget'),
      actual: getColumnId('Actual'),
      notes: getColumnId('Notes')
      // Excluded formula columns: variance, wbs, skipWbs
    }

    apiLogger.debug('Column mapping', { columnMap })

    // Build contact map from existing Smartsheet data
    // This maps last names to full contact values (e.g., "Forster" -> "James Forster")
    const contactMap = buildContactMapFromSheet(existingRows, columns)
    apiLogger.debug('Contact map built', { contacts: Array.from(contactMap.entries()) })

    // Build cells for an item
    const buildCells = (item: any, includeWbs: boolean = false) => {
      const cells: any[] = []
      
      if (columnMap.name) {
        cells.push({ columnId: columnMap.name, value: item.name || '' })
      }
      if (columnMap.description) {
        cells.push({ columnId: columnMap.description, value: item.description || '' })
      }
      if (columnMap.assignedTo && item.ownerLastName) {
        // Smartsheet CONTACT columns require objectValue with objectType, email, name
        const contactObj = buildContactObject(item.ownerLastName, contactMap)
        if (contactObj) {
          cells.push({ columnId: columnMap.assignedTo, objectValue: contactObj })
        }
      }
      if (columnMap.approver && item.approverLastName) {
        // Approver is also a CONTACT column
        const approverContactObj = buildContactObject(item.approverLastName, contactMap)
        if (approverContactObj) {
          cells.push({ columnId: columnMap.approver, objectValue: approverContactObj })
        }
      }
      if (columnMap.status) {
        const mappedStatus = STATUS_TO_SMARTSHEET[item.status]
        if (mappedStatus) {
          cells.push({ columnId: columnMap.status, value: mappedStatus })
        }
      }
      if (columnMap.startDate && item.startDate) {
        try {
          const dateStr = new Date(item.startDate).toISOString().split('T')[0]
          cells.push({ columnId: columnMap.startDate, value: dateStr })
        } catch {
          // Skip invalid dates
        }
      }
      if (columnMap.endDate && item.endDate) {
        try {
          const dateStr = new Date(item.endDate).toISOString().split('T')[0]
          cells.push({ columnId: columnMap.endDate, value: dateStr })
        } catch {
          // Skip invalid dates
        }
      }
      if (columnMap.budget) {
        const budgetNum = parseCurrency(item.budget)
        cells.push({ columnId: columnMap.budget, value: budgetNum ?? '' })
      }
      if (columnMap.actual) {
        const actualNum = parseCurrency(item.actual)
        cells.push({ columnId: columnMap.actual, value: actualNum ?? '' })
      }
      // NOTE: Variance is a FORMULA column in Smartsheet (Budget - Actual) - DO NOT update it
      // Smartsheet will calculate it automatically when Budget or Actual changes
      
      if (columnMap.notes) {
        cells.push({ columnId: columnMap.notes, value: item.notes || '' })
      }
      if (columnMap.atRisk) {
        cells.push({ columnId: columnMap.atRisk, value: item.atRisk || false })
      }
      // NOTE: Formula columns (Variance, WBS, Skip WBS) are not included in updates

      return cells
    }

    // items parameter already has real database IDs from savedItems
    // IMPORTANT: Skip header rows (skipWbs=true) - they are locked in Smartsheet
    const headerRows = items.filter(item => item.skipWbs)
    const nonHeaderRows = items.filter(item => !item.skipWbs)
    
    apiLogger.info('Filtering items for Smartsheet sync', { 
      total: items.length, 
      headerRowsSkipped: headerRows.length,
      nonHeaderRows: nonHeaderRows.length,
      headerNames: headerRows.map(h => h.name)
    })
    
    const itemsToUpdate = nonHeaderRows.filter(item => 
      item.smartsheetRowId && 
      !item.smartsheetRowId.startsWith('temp_')
    )
    const itemsToCreate = nonHeaderRows.filter(item => 
      !item.smartsheetRowId || item.smartsheetRowId.startsWith('temp_')
    )
    
    apiLogger.info('Items categorized', { 
      toUpdate: itemsToUpdate.length, 
      toCreate: itemsToCreate.length,
      createNames: itemsToCreate.map(i => i.name),
      createIds: itemsToCreate.map(i => i.id)
    })

    // Update existing rows
    if (itemsToUpdate.length > 0) {
      const rowsToUpdate = itemsToUpdate.map(item => ({
        id: parseInt(item.smartsheetRowId),
        cells: buildCells(item)
      }))

      apiLogger.info('Updating Smartsheet rows', { rowCount: rowsToUpdate.length })
      await SmartsheetAPI.updateRows(sheetIdNum, rowsToUpdate)
      result.updated = rowsToUpdate.length
    }

    // Create new rows in Smartsheet
    if (itemsToCreate.length > 0) {
      // Build mapping from database IDs to Smartsheet row IDs
      const dbIdToSmartsheetId = new Map<string, string>()
      
      // Map all items that have Smartsheet IDs (including just-saved items)
      for (const item of items) {
        if (item.smartsheetRowId && !item.smartsheetRowId.startsWith('temp_')) {
          dbIdToSmartsheetId.set(item.id, item.smartsheetRowId)
        }
      }
      
      apiLogger.debug('Parent mapping for Smartsheet', { 
        mappingCount: dbIdToSmartsheetId.size,
        mappings: Array.from(dbIdToSmartsheetId.entries()).slice(0, 5)
      })

      // Helper function to find parent's Smartsheet ID
      const findParentSmartsheetId = (parentKey: string): string | undefined => {
        // If parentKey is already a Smartsheet row ID (numeric, not starting with 'c')
        if (!parentKey.startsWith('c')) {
          const parentByRowId = items.find(i => i.smartsheetRowId === parentKey)
          if (parentByRowId) return parentKey
        }
        
        // If parentKey is a database ID, look it up in our mapping
        const fromMap = dbIdToSmartsheetId.get(parentKey)
        if (fromMap) return fromMap
        
        // Search items directly
        const parentItem = items.find(i => i.id === parentKey)
        if (parentItem?.smartsheetRowId && !parentItem.smartsheetRowId.startsWith('temp_')) {
          return parentItem.smartsheetRowId
        }
        
        return undefined
      }
      
      // Helper function to find the last child of a parent (to position new rows at the end)
      const findLastChildSmartsheetId = (parentSmartsheetId: string): string | undefined => {
        // Find all items that have this parent
        const children = items.filter(i => 
          i.parentRowId === parentSmartsheetId && 
          i.smartsheetRowId && 
          !i.smartsheetRowId.startsWith('temp_')
        )
        if (children.length === 0) return undefined
        
        // Sort by orderIndex to find the last one
        children.sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0))
        return children[0]?.smartsheetRowId
      }

      apiLogger.info('Creating new Smartsheet rows', { rowCount: itemsToCreate.length })
      
      // Track last created sibling per parent for proper ordering
      const lastSiblingByParent = new Map<string, string>()
      
      // IMPORTANT: Smartsheet requires rows with different parentIds to be created separately
      // Create rows one at a time to handle hierarchical items correctly
      for (const item of itemsToCreate) {
        try {
          const row: any = {
            cells: buildCells(item)
          }

          // Set parent row if this item has a parent
          const parentKey = item.parentRowId
          if (parentKey) {
            const parentSmartsheetId = findParentSmartsheetId(parentKey)
            if (parentSmartsheetId) {
              // Check if we already created a sibling in this batch
              let lastSiblingId = lastSiblingByParent.get(parentSmartsheetId)
              
              // If not, find the last existing child
              if (!lastSiblingId) {
                lastSiblingId = findLastChildSmartsheetId(parentSmartsheetId)
              }
              
              if (lastSiblingId) {
                // Use siblingId to position AFTER the last sibling (cannot combine with parentId)
                row.siblingId = parseInt(lastSiblingId)
                row.above = false // Position below the sibling
                apiLogger.debug('Positioning after sibling', { itemName: item.name, siblingId: lastSiblingId })
              } else {
                // No existing children - use parentId to add as first child
                row.parentId = parseInt(parentSmartsheetId)
                apiLogger.debug('Adding as first child', { itemName: item.name, parentSmartsheetId })
              }
            } else {
              // No parent found - add to bottom of sheet
              row.toBottom = true
              apiLogger.warn('Could not find parent Smartsheet ID, adding to bottom', { itemName: item.name, parentKey })
            }
          } else {
            // No parent - add to bottom of sheet
            row.toBottom = true
          }

          // Create single row
          const createResult = await SmartsheetAPI.addRows(sheetIdNum, [row])
          result.created++
          
          // Update our database with the new Smartsheet row ID
          if (createResult?.result) {
            const createdRows = Array.isArray(createResult.result) ? createResult.result : [createResult.result]
            if (createdRows[0]?.id && item.id) {
              const newSmartsheetRowId = String(createdRows[0].id)
              await prisma.wbsCache.update({
                where: { id: item.id },
                data: { smartsheetRowId: newSmartsheetRowId }
              })
              // Also update our mapping so children can find this parent
              dbIdToSmartsheetId.set(item.id, newSmartsheetRowId)
              
              // Track this as the last sibling for its parent (for ordering subsequent items)
              if (parentKey) {
                const parentSmartsheetId = findParentSmartsheetId(parentKey)
                if (parentSmartsheetId) {
                  lastSiblingByParent.set(parentSmartsheetId, newSmartsheetRowId)
                }
              }
              
              apiLogger.debug('Created row in Smartsheet', { itemName: item.name, smartsheetRowId: newSmartsheetRowId })
            }
          }
        } catch (createError) {
          const errorObj = createError instanceof Error 
            ? createError 
            : new Error(typeof createError === 'string' ? createError : 'Unknown error')
          const errorMessage = errorObj.message
          apiLogger.error('Failed to create row in Smartsheet', errorObj, { itemName: item.name })
          result.errors.push(`Failed to create "${item.name}": ${errorMessage}`)
        }
      }
    }

    apiLogger.info('Smartsheet sync complete', { updated: result.updated, created: result.created })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    apiLogger.error('Smartsheet sync failed', error as Error)
    result.errors.push(errorMsg)
  }
  
  return result
}
