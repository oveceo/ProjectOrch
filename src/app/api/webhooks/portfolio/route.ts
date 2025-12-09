import { NextRequest, NextResponse } from 'next/server'
import { PortfolioSyncService } from '@/lib/portfolio-sync'
import { z } from 'zod'

// Webhook payload validation schema
const webhookPayloadSchema = z.object({
  nonce: z.string(),
  timestamp: z.string(),
  webhookId: z.string(),
  scope: z.string(),
  scopeObjectId: z.string(),
  events: z.array(z.object({
    objectType: z.string(),
    eventType: z.string(),
    rowId: z.number().optional(),
    columnId: z.number().optional(),
    userId: z.number().optional()
  }))
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate webhook payload
    const validationResult = webhookPayloadSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('Invalid webhook payload:', validationResult.error)
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    const payload = validationResult.data

    // Verify webhook is for our portfolio sheet
    if (payload.scope !== 'sheet' || payload.scopeObjectId !== process.env.SMARTSHEET_PORTFOLIO_SHEET_ID) {
      return NextResponse.json(
        { error: 'Webhook not for portfolio sheet' },
        { status: 400 }
      )
    }

    // Process webhook events
    await PortfolioSyncService.processWebhook(payload)

    // Return success response
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Webhook handshake endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('smartsheetHookChallenge')

  if (challenge) {
    // Respond to Smartsheet webhook verification
    return NextResponse.json({
      smartsheetHookResponse: challenge
    })
  }

  return NextResponse.json(
    { error: 'Invalid webhook verification request' },
    { status: 400 }
  )
}
