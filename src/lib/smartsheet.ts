import * as smartsheet from 'smartsheet'
import { SmartsheetSheet, SmartsheetRow, SmartsheetColumn } from '@/types'

// Smartsheet API client configuration
const client = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN || '',
  logLevel: 'info'
})

// Direct API base URL for operations not supported by SDK
const SMARTSHEET_API_BASE = 'https://api.smartsheet.com/2.0'

// Helper for direct API calls (for operations SDK doesn't support well)
async function directApiCall(method: string, endpoint: string, body?: any): Promise<any> {
  const response = await fetch(`${SMARTSHEET_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.SMARTSHEET_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Smartsheet API error: ${response.status} - ${errorData.message || response.statusText}`)
  }
  
  return response.json()
}

// Rate limiting and retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
}

// Idempotency keys for safe retries
const idempotencyKeys = new Map<string, number>()

function generateIdempotencyKey(operation: string, params: any): string {
  return `${operation}_${JSON.stringify(params)}_${Date.now()}`
}

function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt)
  return Math.min(delay, RETRY_CONFIG.maxDelay)
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  params: any = {}
): Promise<T> {
  const idempotencyKey = generateIdempotencyKey(operationName, params)

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Check for cached result if this is a retry
      if (attempt > 0 && idempotencyKeys.has(idempotencyKey)) {
        throw new Error('Idempotency key collision - operation already in progress')
      }

      idempotencyKeys.set(idempotencyKey, Date.now())
      const result = await operation()
      idempotencyKeys.delete(idempotencyKey)
      return result
    } catch (error: any) {
      idempotencyKeys.delete(idempotencyKey)

      // Don't retry on authentication errors
      if (error.statusCode === 401 || error.statusCode === 403) {
        throw error
      }

      // Don't retry on client errors (4xx) except rate limiting
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error
      }

      // If this was the last attempt, throw the error
      if (attempt === RETRY_CONFIG.maxRetries) {
        throw error
      }

      // Wait before retrying
      const delay = getRetryDelay(attempt)
      console.warn(`Smartsheet ${operationName} failed (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}), retrying in ${delay}ms:`, error.message)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Unexpected error in retry logic')
}

export class SmartsheetAPI {
  // Get sheet by ID
  static async getSheet(sheetId: number): Promise<SmartsheetSheet> {
    return withRetry(
      () => client.sheets.getSheet({ id: sheetId }),
      'getSheet',
      { sheetId }
    )
  }

  // Get sheet columns
  static async getColumns(sheetId: number): Promise<SmartsheetColumn[]> {
    const sheet = await this.getSheet(sheetId)
    return sheet.columns
  }

  // Get sheet rows
  static async getRows(sheetId: number): Promise<SmartsheetRow[]> {
    const sheet = await this.getSheet(sheetId)
    return sheet.rows
  }

  // Add rows to sheet
  static async addRows(sheetId: number, rows: any[]): Promise<any> {
    return withRetry(
      () => client.sheets.addRows({
        sheetId,
        body: rows
      }),
      'addRows',
      { sheetId, rowCount: rows.length }
    )
  }

  // Update rows in sheet (uses updateRow which accepts array of rows)
  static async updateRows(sheetId: number, rows: any[]): Promise<any> {
    return withRetry(
      () => client.sheets.updateRow({
        sheetId,
        body: rows
      }),
      'updateRows',
      { sheetId, rowCount: rows.length }
    )
  }

  // Delete rows from sheet (delete one at a time)
  static async deleteRows(sheetId: number, rowIds: number[]): Promise<any> {
    // Delete rows one by one since SDK uses deleteRow (singular)
    const results = []
    for (const rowId of rowIds) {
      const result = await withRetry(
        () => client.sheets.deleteRow({
          sheetId,
          rowId
        }),
        'deleteRow',
        { sheetId, rowId }
      )
      results.push(result)
    }
    return results
  }

  // Create new sheet
  static async createSheet(name: string, columns: any[], folderId?: number): Promise<any> {
    const options: any = {
      body: {
        name,
        columns
      }
    }

    if (folderId) {
      options.body.folderId = folderId
    }

    return withRetry(
      () => client.sheets.createSheet(options),
      'createSheet',
      { name, folderId }
    )
  }

  // Copy sheet (template cloning) - uses direct API to include data, forms, rules
  static async copySheet(sheetId: number, name: string, folderId?: number): Promise<any> {
    const body: any = {
      newName: name
    }

    if (folderId) {
      body.destinationType = 'folder'
      body.destinationId = folderId
    }

    // Include ALL content when copying: data (rows), attachments, forms, rules, etc.
    const includeParams = 'data,attachments,cellLinks,forms,rules,ruleRecipients'
    
    return withRetry(
      () => directApiCall('POST', `/sheets/${sheetId}/copy?include=${includeParams}`, body),
      'copySheet',
      { sheetId, name, folderId }
    )
  }

  // Copy report to a folder
  static async copyReport(reportId: number, name: string, folderId: number): Promise<any> {
    return withRetry(
      () => directApiCall('POST', `/reports/${reportId}/copy`, {
        newName: name,
        destinationType: 'folder',
        destinationId: folderId
      }),
      'copyReport',
      { reportId, name, folderId }
    )
  }

  // Copy dashboard (sight) to a folder
  static async copyDashboard(dashboardId: number, name: string, folderId: number): Promise<any> {
    return withRetry(
      () => directApiCall('POST', `/sights/${dashboardId}/copy`, {
        newName: name,
        destinationType: 'folder',
        destinationId: folderId
      }),
      'copyDashboard',
      { dashboardId, name, folderId }
    )
  }

  // Create folder using direct API call (SDK doesn't support this well)
  static async createFolder(name: string, parentFolderId?: number): Promise<any> {
    if (!parentFolderId) {
      throw new Error('parentFolderId is required for creating folders')
    }
    
    return withRetry(
      () => directApiCall('POST', `/folders/${parentFolderId}/folders`, { name }),
      'createFolder',
      { name, parentFolderId }
    )
  }

  // Copy folder using direct API call
  static async copyFolder(sourceFolderId: number, destinationFolderId: number, newName: string): Promise<any> {
    return withRetry(
      () => directApiCall('POST', `/folders/${sourceFolderId}/copy`, {
        destinationType: 'folder',
        destinationId: destinationFolderId,
        newName: newName
      }),
      'copyFolder',
      { sourceFolderId, destinationFolderId, newName }
    )
  }

  // Get folder contents using direct API call
  static async getFolder(folderId: number): Promise<any> {
    return withRetry(
      () => directApiCall('GET', `/folders/${folderId}?include=sheets,folders,reports,dashboards`),
      'getFolder',
      { folderId }
    )
  }

  // Create webhook
  static async createWebhook(sheetId: number, callbackUrl: string, events: string[]): Promise<any> {
    return withRetry(
      () => client.webhooks.createWebhook({
        body: {
          name: `EO Orchestrator - Sheet ${sheetId}`,
          callbackUrl,
          scope: 'sheet',
          scopeObjectId: sheetId,
          events,
          version: 1
        }
      }),
      'createWebhook',
      { sheetId, events }
    )
  }

  // Delete webhook
  static async deleteWebhook(webhookId: number): Promise<any> {
    return withRetry(
      () => client.webhooks.deleteWebhook({ id: webhookId }),
      'deleteWebhook',
      { webhookId }
    )
  }

  // Get webhooks
  static async getWebhooks(): Promise<any> {
    return withRetry(
      () => client.webhooks.listWebhooks(),
      'getWebhooks'
    )
  }

  // Validate webhook signature
  static validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // Implementation depends on Smartsheet's webhook signing method
    // This is a placeholder - you'll need to implement based on their docs
    return true
  }

  // Helper: Find column by title
  static findColumnByTitle(columns: SmartsheetColumn[], title: string): SmartsheetColumn | undefined {
    return columns.find(col =>
      col.title.toLowerCase().trim() === title.toLowerCase().trim()
    )
  }

  // Helper: Get cell value by column title
  static getCellValue(row: SmartsheetRow, columns: SmartsheetColumn[], columnTitle: string): any {
    const column = this.findColumnByTitle(columns, columnTitle)
    if (!column) return null

    const cell = row.cells.find(cell => cell.columnId === column.id)
    return cell?.value || cell?.displayValue || null
  }

  // Helper: Create cell object for updates
  static createCell(columnId: number, value: any): any {
    return {
      columnId,
      value: value || undefined
    }
  }

  // Helper: Create hyperlink cell
  static createHyperlinkCell(columnId: number, url: string, text: string): any {
    return {
      columnId,
      value: text,
      hyperlink: {
        url
      }
    }
  }
}
