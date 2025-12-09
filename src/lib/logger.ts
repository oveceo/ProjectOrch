/**
 * Enterprise-grade logging utility for Transmission WBS Task Manager
 * Provides structured logging with different levels and context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

// Log levels in order of severity
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Get current minimum log level from environment
function getMinLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL || process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  return (env as LogLevel) || 'info'
}

// Format log entry for output
function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context 
    ? ` | ${JSON.stringify(entry.context)}` 
    : ''
  const errorStr = entry.error 
    ? ` | Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ''}` 
    : ''
  
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}${errorStr}`
}

// Create structured log entry
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return entry
}

// Check if log should be output based on level
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLogLevel()]
}

// Output log entry
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry)
  
  switch (entry.level) {
    case 'debug':
      console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
      console.error(formatted)
      break
  }

  // In production, you could also send to external logging service
  // Example: sendToLogService(entry)
}

// Main logger class
class Logger {
  private prefix: string

  constructor(prefix?: string) {
    this.prefix = prefix || 'EO'
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!shouldLog(level)) return
    
    const prefixedMessage = `[${this.prefix}] ${message}`
    const entry = createLogEntry(level, prefixedMessage, context, error)
    outputLog(entry)
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error)
  }

  // Create a child logger with additional prefix
  child(childPrefix: string): Logger {
    return new Logger(`${this.prefix}:${childPrefix}`)
  }

  // Log API request
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, { ...context, type: 'api_request' })
  }

  // Log API response
  apiResponse(method: string, path: string, status: number, durationMs?: number): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this.log(level, `API ${method} ${path} → ${status}`, {
      type: 'api_response',
      status,
      durationMs,
    })
  }

  // Log database operation
  database(operation: string, table: string, context?: LogContext): void {
    this.debug(`DB ${operation} on ${table}`, { ...context, type: 'database' })
  }

  // Log authentication event
  auth(event: string, userInfo?: { name?: string; lastName?: string }, context?: LogContext): void {
    this.info(`Auth: ${event}`, { 
      ...context, 
      type: 'auth',
      user: userInfo?.name || userInfo?.lastName || 'unknown'
    })
  }

  // Log Smartsheet operation
  smartsheet(operation: string, sheetId?: string | number, context?: LogContext): void {
    this.info(`Smartsheet: ${operation}`, {
      ...context,
      type: 'smartsheet',
      sheetId,
    })
  }

  // Log performance metric
  performance(operation: string, durationMs: number, context?: LogContext): void {
    const level: LogLevel = durationMs > 5000 ? 'warn' : 'debug'
    this.log(level, `Performance: ${operation} completed in ${durationMs}ms`, {
      ...context,
      type: 'performance',
      durationMs,
    })
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for creating module-specific loggers
export function createLogger(module: string): Logger {
  return logger.child(module)
}

// Performance timing helper
export function startTimer(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}

// Async operation logger wrapper
export async function withLogging<T>(
  operation: string,
  fn: () => Promise<T>,
  moduleLogger?: Logger
): Promise<T> {
  const log = moduleLogger || logger
  const getElapsed = startTimer()
  
  try {
    log.debug(`Starting: ${operation}`)
    const result = await fn()
    log.performance(operation, getElapsed())
    return result
  } catch (error) {
    log.error(`Failed: ${operation}`, error as Error)
    throw error
  }
}

