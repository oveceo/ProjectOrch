import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Only for debugging - remove in production
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'missing',
    SMARTSHEET_ACCESS_TOKEN: process.env.SMARTSHEET_ACCESS_TOKEN ? 'configured' : 'missing',
    SMARTSHEET_ACCESS_TOKEN_LENGTH: process.env.SMARTSHEET_ACCESS_TOKEN?.length || 0,
    ALL_ENV_KEYS: Object.keys(process.env).filter(key => key.startsWith('SMARTSHEET')),
  })
}
