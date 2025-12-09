import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const apiLogger = logger.child('api:webhooks:smartsheet:setup')

// Create Smartsheet client
const smartsheet = require('smartsheet')
const client = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN || '',
  logLevel: 'info'
})

const PORTFOLIO_SHEET_ID = parseInt(process.env.SMARTSHEET_PORTFOLIO_SHEET_ID || '6732698911461252')

/**
 * POST /api/webhooks/smartsheet/setup - Create Smartsheet webhook
 * 
 * This registers a webhook with Smartsheet that will call our
 * /api/webhooks/smartsheet endpoint whenever rows are created
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    // Get the callback URL (our webhook endpoint)
    const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'https://transmission-wbs-app.onrender.com'
    const callbackUrl = `${appBaseUrl}/api/webhooks/smartsheet`

    apiLogger.info('Setting up Smartsheet webhook', { 
      sheetId: PORTFOLIO_SHEET_ID, 
      callbackUrl 
    })

    // Create the webhook
    const webhookResponse = await client.webhooks.createWebhook({
      body: {
        name: 'EO Project Orchestrator - New Project Webhook',
        callbackUrl: callbackUrl,
        scope: 'sheet',
        scopeObjectId: PORTFOLIO_SHEET_ID,
        events: ['*.*'],  // All events (we'll filter in our handler)
        version: 1
      }
    })

    const webhookId = webhookResponse.result.id
    apiLogger.info('Webhook created', { webhookId })

    // Enable the webhook (required step after creation)
    await client.webhooks.updateWebhook({
      webhookId: webhookId,
      body: {
        enabled: true
      }
    })

    apiLogger.info('Webhook enabled successfully', { webhookId })

    return NextResponse.json({
      success: true,
      message: 'Webhook created and enabled',
      webhook: {
        id: webhookId,
        callbackUrl,
        sheetId: PORTFOLIO_SHEET_ID
      }
    })

  } catch (error) {
    apiLogger.error('Failed to create webhook', error as Error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create webhook',
      message: errorMessage,
      hint: 'Make sure APP_BASE_URL is set correctly in environment variables'
    }, { status: 500 })
  }
}

/**
 * GET /api/webhooks/smartsheet/setup - List existing webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const response = await client.webhooks.listWebhooks({})
    
    const webhooks = response.data || []
    const portfolioWebhooks = webhooks.filter((w: any) => 
      w.scopeObjectId === PORTFOLIO_SHEET_ID
    )

    return NextResponse.json({
      success: true,
      webhooks: portfolioWebhooks,
      allWebhooks: webhooks.length,
      portfolioWebhooks: portfolioWebhooks.length
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to list webhooks'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/webhooks/smartsheet/setup - Delete a webhook
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('webhookId')

    if (!webhookId) {
      return NextResponse.json({ error: 'webhookId required' }, { status: 400 })
    }

    await client.webhooks.deleteWebhook({ webhookId: parseInt(webhookId) })

    return NextResponse.json({
      success: true,
      message: `Webhook ${webhookId} deleted`
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to delete webhook'
    }, { status: 500 })
  }
}

