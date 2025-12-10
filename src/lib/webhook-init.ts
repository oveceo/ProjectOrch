import { SmartsheetAPI } from './smartsheet'
import { logger } from './logger'

const initLogger = logger.child('webhook:init')

const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')
const APP_BASE_URL = process.env.APP_BASE_URL || ''
const WEBHOOK_CALLBACK_URL = `${APP_BASE_URL}/api/webhooks/smartsheet`

let initialized = false

/**
 * Auto-register Smartsheet webhook on app startup
 * This ensures the webhook is always active without manual intervention
 */
export async function initializeWebhook(): Promise<void> {
  // Only run once
  if (initialized) return
  initialized = true

  // Skip if no APP_BASE_URL configured (local dev)
  if (!APP_BASE_URL || APP_BASE_URL.includes('localhost')) {
    initLogger.info('Skipping webhook init - localhost or no APP_BASE_URL')
    return
  }

  try {
    initLogger.info('Checking webhook status...', { callbackUrl: WEBHOOK_CALLBACK_URL })

    // Check if webhook already exists
    const webhooks = await SmartsheetAPI.getWebhooks()
    const existingWebhook = webhooks.data?.find((wh: any) =>
      wh.callbackUrl === WEBHOOK_CALLBACK_URL &&
      wh.scopeObjectId === PORTFOLIO_SHEET_ID &&
      wh.enabled
    )

    if (existingWebhook) {
      initLogger.info('Webhook already active', { webhookId: existingWebhook.id })
      return
    }

    // Delete any stale webhooks for this callback URL
    for (const wh of webhooks.data || []) {
      if (wh.callbackUrl === WEBHOOK_CALLBACK_URL) {
        initLogger.info('Deleting stale webhook', { webhookId: wh.id })
        await SmartsheetAPI.deleteWebhook(wh.id)
      }
    }

    // Create new webhook
    initLogger.info('Registering new webhook...')
    const newWebhook = await SmartsheetAPI.createWebhook(
      PORTFOLIO_SHEET_ID,
      WEBHOOK_CALLBACK_URL,
      ['row.updated'] // Only listen for updates (when approval status changes)
    )

    initLogger.info('✅ Webhook registered successfully', { webhookId: newWebhook.result?.id })
  } catch (error) {
    initLogger.error('Failed to initialize webhook', error as Error)
    // Don't throw - app should still work, just without auto-webhook
  }
}

