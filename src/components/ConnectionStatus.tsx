'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, RefreshCw, Server, ServerOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ConnectionStatusProps {
  showDetails?: boolean
}

export function ConnectionStatus({ showDetails = false }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isServerHealthy, setIsServerHealthy] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkServerHealth = useCallback(async () => {
    setIsChecking(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch('/api/healthz', {
        signal: controller.signal,
        cache: 'no-store'
      })
      
      clearTimeout(timeoutId)
      
      const data = await response.json()
      setIsServerHealthy(response.ok && data.status === 'ok')
      setLastCheck(new Date())
    } catch (error) {
      console.warn('Health check failed:', error)
      setIsServerHealthy(false)
      setLastCheck(new Date())
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    // Set initial online state
    setIsOnline(navigator.onLine)

    // Handle online/offline events
    const handleOnline = () => {
      setIsOnline(true)
      checkServerHealth()
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setIsServerHealthy(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial health check
    checkServerHealth()

    // Periodic health checks (every 30 seconds)
    const interval = setInterval(checkServerHealth, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [checkServerHealth])

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-100 text-red-800 border-red-200'
    if (!isServerHealthy) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3" />
    if (!isServerHealthy) return <ServerOff className="h-3 w-3" />
    return <Wifi className="h-3 w-3" />
  }

  const getStatusText = () => {
    if (!isOnline) return 'Offline'
    if (!isServerHealthy) return 'Server Issue'
    return 'Connected'
  }

  // Don't show anything if everything is fine and we don't want details
  if (!showDetails && isOnline && isServerHealthy) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge className={`${getStatusColor()} flex items-center space-x-1.5 px-2 py-1`}>
        {getStatusIcon()}
        <span className="text-xs font-medium">{getStatusText()}</span>
      </Badge>

      {showDetails && (
        <Button
          variant="ghost"
          size="sm"
          onClick={checkServerHealth}
          disabled={isChecking}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  )
}

// Offline banner component for full-width notification
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setDismissed(false)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setDismissed(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline || dismissed) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 px-4 py-2 flex items-center justify-center z-50">
      <WifiOff className="h-4 w-4 mr-2" />
      <span className="text-sm font-medium">
        You are currently offline. Some features may be unavailable.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 text-yellow-900 hover:text-yellow-700 font-bold"
      >
        ×
      </button>
    </div>
  )
}

