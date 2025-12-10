'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FolderPlus,
  CloudDownload
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface SyncPanelProps {
  onSyncComplete?: () => void
}

export function SyncPanel({ onSyncComplete }: SyncPanelProps) {
  const { user } = useAuth()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [wbsStatus, setWbsStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [wbsMessage, setWbsMessage] = useState('')

  const runFullSync = async () => {
    setSyncStatus('syncing')
    setMessage('Syncing from Smartsheet...')

    try {
      const response = await fetch('/api/sync/smartsheet', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })
      const data = await response.json()

      if (response.ok) {
        setSyncStatus('success')
        setMessage(data.message || 'Sync completed!')
        onSyncComplete?.()
      } else {
        setSyncStatus('error')
        setMessage(data.error || 'Sync failed')
      }
    } catch (err) {
      setSyncStatus('error')
      setMessage('Failed to sync')
    }

    // Reset after 5 seconds
    setTimeout(() => {
      setSyncStatus('idle')
      setMessage('')
    }, 5000)
  }

  const checkNewProjects = async () => {
    setWbsStatus('checking')
    setWbsMessage('Checking for approved projects...')

    try {
      // Step 1: Check for new projects and create WBS folders
      const response = await fetch('/api/portfolio/new-projects', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })
      const data = await response.json()

      if (response.ok) {
        setWbsStatus('success')
        setWbsMessage(data.message || 'Check completed!')
        
        // Step 2: Auto-trigger full sync
        await runFullSync()
      } else {
        setWbsStatus('error')
        setWbsMessage(data.error || 'Check failed')
      }
    } catch (err) {
      setWbsStatus('error')
      setWbsMessage('Failed to check projects')
    }

    // Reset after 5 seconds
    setTimeout(() => {
      setWbsStatus('idle')
      setWbsMessage('')
    }, 5000)
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 shadow-sm">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status Indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span className="font-medium text-gray-700">Smartsheet Sync</span>
            </div>
            
            {/* Sync Status Badge */}
            {syncStatus === 'syncing' && (
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </Badge>
            )}
            {syncStatus === 'success' && (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Synced
              </Badge>
            )}
            {syncStatus === 'error' && (
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            )}
            
            {/* WBS Status Badge */}
            {wbsStatus === 'checking' && (
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Creating WBS...
              </Badge>
            )}
            {wbsStatus === 'success' && (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                <FolderPlus className="h-3 w-3 mr-1" />
                WBS Ready
              </Badge>
            )}
          </div>

          {/* Messages */}
          {(message || wbsMessage) && (
            <div className="flex-1 text-sm text-gray-600">
              {wbsMessage || message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={checkNewProjects}
              disabled={wbsStatus === 'checking' || syncStatus === 'syncing'}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              {wbsStatus === 'checking' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4 mr-2" />
              )}
              Create WBS Folders
            </Button>
            
            <Button
              onClick={runFullSync}
              disabled={syncStatus === 'syncing' || wbsStatus === 'checking'}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4 mr-2" />
              )}
              Sync Data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

