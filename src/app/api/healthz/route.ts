import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger, startTimer } from '@/lib/logger'

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: HealthCheck
    environment: HealthCheck
    smartsheet: HealthCheck
  }
  details?: {
    node: string
    platform: string
    memory: {
      used: number
      total: number
      percentage: number
    }
  }
}

interface HealthCheck {
  status: 'pass' | 'warn' | 'fail'
  message?: string
  latency?: number
}

// Track startup time for uptime calculation
const startupTime = Date.now()

// Required environment variables
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'SMARTSHEET_ACCESS_TOKEN',
]

const OPTIONAL_ENV_VARS = [
  'SMARTSHEET_PORTFOLIO_SHEET_ID',
  'SMARTSHEET_WBS_TEMPLATE_SHEET_ID',
  'SMARTSHEET_WBS_FOLDER_ID',
]

export async function GET(request: NextRequest) {
  const getElapsed = startTimer()
  const healthStatus: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startupTime) / 1000),
    checks: {
      database: { status: 'pass' },
      environment: { status: 'pass' },
      smartsheet: { status: 'pass' },
    },
  }

  // Check database connectivity
  try {
    const dbTimer = startTimer()
    await prisma.$queryRaw`SELECT 1`
    healthStatus.checks.database = {
      status: 'pass',
      message: 'Database connection successful',
      latency: dbTimer(),
    }
  } catch (error) {
    logger.error('Health check: Database connection failed', error as Error)
    healthStatus.checks.database = {
      status: 'fail',
      message: 'Database connection failed',
    }
    healthStatus.status = 'error'
  }

  // Check environment variables
  const missingRequired = REQUIRED_ENV_VARS.filter((v) => !process.env[v])
  const missingOptional = OPTIONAL_ENV_VARS.filter((v) => !process.env[v])

  if (missingRequired.length > 0) {
    healthStatus.checks.environment = {
      status: 'fail',
      message: `Missing required variables: ${missingRequired.join(', ')}`,
    }
    healthStatus.status = 'error'
  } else if (missingOptional.length > 0) {
    healthStatus.checks.environment = {
      status: 'warn',
      message: `Missing optional variables: ${missingOptional.join(', ')}`,
    }
    if (healthStatus.status === 'ok') {
      healthStatus.status = 'degraded'
    }
  } else {
    healthStatus.checks.environment = {
      status: 'pass',
      message: 'All environment variables configured',
    }
  }

  // Check Smartsheet token validity (basic check)
  const smartsheetToken = process.env.SMARTSHEET_ACCESS_TOKEN
  if (!smartsheetToken || smartsheetToken.length < 20) {
    healthStatus.checks.smartsheet = {
      status: 'fail',
      message: 'Invalid or missing Smartsheet token',
    }
    if (healthStatus.status === 'ok') {
      healthStatus.status = 'degraded'
    }
  } else {
    healthStatus.checks.smartsheet = {
      status: 'pass',
      message: 'Smartsheet token configured',
    }
  }

  // Include system details only in verbose mode or development
  const verbose = request.nextUrl.searchParams.get('verbose') === 'true' ||
                  process.env.NODE_ENV === 'development'
  
  if (verbose) {
    const memUsage = process.memoryUsage()
    healthStatus.details = {
      node: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
    }
  }

  // Log health check
  logger.debug('Health check completed', {
    status: healthStatus.status,
    latency: getElapsed(),
  })

  // Return appropriate status code
  const httpStatus = healthStatus.status === 'ok' ? 200 :
                     healthStatus.status === 'degraded' ? 200 : 503

  return NextResponse.json(healthStatus, { status: httpStatus })
}

// HEAD request for simple uptime checks
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
