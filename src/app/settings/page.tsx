'use client'

import { useState, useEffect } from 'react'
import { redirect } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  User,
  Bell,
  Shield,
  Database,
  Mail,
  Zap,
  Globe,
  Key,
  Save,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  RefreshCw as SyncIcon
} from 'lucide-react'
// Roles removed - access determined by project involvement

interface UserSettings {
  email: string
  name: string
  notifications: {
    emailNotifications: boolean
    projectUpdates: boolean
    approvalRequests: boolean
    weeklyReports: boolean
    dueDateReminders: boolean
  }
  preferences: {
    theme: 'light' | 'dark' | 'system'
    timezone: string
    dateFormat: string
    itemsPerPage: number
  }
}

interface SystemSettings {
  systemName: string
  systemDescription: string
  defaultProjectCategories: string[]
  autoApprovalThreshold: number
  maintenanceMode: boolean
  backupFrequency: string
  smtpSettings: {
    enabled: boolean
    host: string
    port: number
    secure: boolean
  }
  smartsheetSettings: {
    enabled: boolean
    apiKey: string
    workspaceId: string
  }
}

function SettingsContent() {
  const { user, isLoading } = useAuth()
  const [userSettings, setUserSettings] = useState<UserSettings>({
    email: '',
    name: '',
    notifications: {
      emailNotifications: true,
      projectUpdates: true,
      approvalRequests: true,
      weeklyReports: false,
      dueDateReminders: true
    },
    preferences: {
      theme: 'system',
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      itemsPerPage: 25
    }
  })
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    systemName: 'Transmission Project Orchestrator',
    systemDescription: 'Transmission Department Project Management System',
    defaultProjectCategories: ['Transmission', 'Infrastructure', 'Maintenance', 'Safety'],
    autoApprovalThreshold: 50000,
    maintenanceMode: false,
    backupFrequency: 'daily',
    smtpSettings: {
      enabled: false,
      host: '',
      port: 587,
      secure: false
    },
    smartsheetSettings: {
      enabled: false,
      apiKey: '',
      workspaceId: ''
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [showApiKey, setShowApiKey] = useState(false)
  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState<string>('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      redirect('/auth/simple')
    }
  }, [user, isLoading])

  // Load settings on mount
  useEffect(() => {
    if (user) {
      loadUserSettings()
      loadSystemSettings()  // Everyone can access integrations now
      setLoading(false)
    }
  }, [user])

  const loadUserSettings = async () => {
    try {
      // Mock loading user settings - in real app, fetch from API
      if (user) {
        // AuthContext user does not include email; default to empty string
        setUserSettings(prev => ({
          ...prev,
          email: '', // email not tracked in simple auth
          name: user.name || ''
        }))
      }
    } catch (error) {
      console.error('Failed to load user settings:', error)
    }
  }

  const loadSystemSettings = async () => {
    try {
      // Mock loading system settings - in real app, fetch from API
      // This would be admin-only
    } catch (error) {
      console.error('Failed to load system settings:', error)
    }
  }

  const saveUserSettings = async () => {
    setSaving(true)
    try {
      // Mock saving - in real app, make API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('User settings saved:', userSettings)
    } catch (error) {
      console.error('Failed to save user settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveSystemSettings = async () => {
    setSaving(true)
    try {
      // Mock saving - in real app, make API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('System settings saved:', systemSettings)
    } catch (error) {
      console.error('Failed to save system settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const testSmartsheetConnection = async () => {
    setTestConnectionStatus('testing')
    try {
      // Mock testing - in real app, make API call to test connection
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTestConnectionStatus('success')
    } catch (error) {
      console.error('Failed to test Smartsheet connection:', error)
      setTestConnectionStatus('error')
    }
  }

  const syncFromSmartsheet = async () => {
    setSyncStatus('syncing')
    setSyncMessage('Starting sync from Smartsheet...')

    try {
      const response = await fetch('/api/sync/smartsheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.lastName}`,
        },
        body: JSON.stringify({
          workspaceId: systemSettings.smartsheetSettings.workspaceId || 'YOUR_WORKSPACE_ID'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSyncStatus('success')
        setSyncMessage(data.message || 'Sync completed successfully')
      } else {
        setSyncStatus('error')
        setSyncMessage(data.error || 'Sync failed')
      }
    } catch (error) {
      console.error('Failed to sync from Smartsheet:', error)
      setSyncStatus('error')
      setSyncMessage('Failed to sync from Smartsheet')
    }
  }

  const exportSettings = () => {
    const settings = {
      userSettings,
      systemSettings,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string)
        if (settings.userSettings) {
          setUserSettings(settings.userSettings)
        }
        if (settings.systemSettings) {
          setSystemSettings(settings.systemSettings)
        }
      } catch (error) {
        console.error('Failed to import settings:', error)
        alert('Failed to import settings. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  // Show loading while auth is loading
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading settings...</div>
      </div>
    )
  }

  // Don't render anything if not authenticated
  if (!user) {
    return null
  }

  // Everyone can access all settings - access is determined by project involvement, not roles

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Settings & Configuration
              </h1>
              <p className="text-lg text-gray-600">
                Manage your preferences and system configuration
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-3">
              <Button onClick={exportSettings} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="" alt={userSettings.name} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-green-500 text-white text-2xl">
                      {(userSettings.name || userSettings.email)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{userSettings.name || 'Unnamed User'}</h3>
                    <p className="text-gray-600">{userSettings.email}</p>
                    <Badge className="mt-2 bg-blue-100 text-blue-800">
                      Transmission User
                    </Badge>
                  </div>
                </div>

                {/* Admin WBS Management */}
                {['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette'].includes(user?.lastName || '') && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">WBS Data Management</AlertTitle>
                    <AlertDescription className="text-red-700 mt-2">
                      <p className="mb-3">
                        If you're not seeing your WBS tasks, the cache might contain old email addresses instead of last names.
                      </p>
                      <Button
                        onClick={async () => {
                          if (!confirm('This will clear all cached WBS data. After clearing, go to Settings → System → Sync from Smartsheet. Continue?')) return
                          
                          try {
                            const response = await fetch('/api/wbs/clear-cache', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${user?.lastName}`,
                              },
                            })
                            
                            const data = await response.json()
                            
                            if (response.ok) {
                              alert(`✅ ${data.message}\n\n🎯 Next step: Go to Settings → System tab → Click "Sync from Smartsheet"`)
                            } else {
                              alert(`❌ Error: ${data.error}`)
                            }
                          } catch (error) {
                            console.error('Error clearing cache:', error)
                            alert('❌ Failed to clear cache')
                          }
                        }}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear WBS Cache
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={userSettings.name}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userSettings.email}
                      onChange={(e) => setUserSettings(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveUserSettings} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Settings */}
          <TabsContent value="preferences" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2 h-5 w-5" />
                  User Preferences
                </CardTitle>
                <CardDescription>
                  Customize your experience with the system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={userSettings.preferences.theme}
                      onValueChange={(value: 'light' | 'dark' | 'system') =>
                        setUserSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, theme: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={userSettings.preferences.timezone}
                      onValueChange={(value) =>
                        setUserSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, timezone: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select
                      value={userSettings.preferences.dateFormat}
                      onValueChange={(value) =>
                        setUserSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, dateFormat: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="itemsPerPage">Items Per Page</Label>
                    <Select
                      value={userSettings.preferences.itemsPerPage.toString()}
                      onValueChange={(value) =>
                        setUserSettings(prev => ({
                          ...prev,
                          preferences: { ...prev.preferences, itemsPerPage: parseInt(value) }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveUserSettings} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Settings */}
          <TabsContent value="automation" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5 text-yellow-500" />
                  WBS Folder Automation
                </CardTitle>
                <CardDescription>
                  Automatically create WBS folders when new projects are submitted via Smartsheet form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">How it works</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    When a project's approval status changes to "Approved":
                    <ol className="list-decimal ml-4 mt-2 space-y-1">
                      <li>Smartsheet sends a webhook notification for the row update</li>
                      <li>The system checks if Approval Status = "Approved"</li>
                      <li>Creates a new folder named WBS (#P-XXXX)</li>
                      <li>Copies all sheets from the template folder into the new folder</li>
                      <li>Updates row 1 in the WBS sheet with the project code</li>
                      <li>Links are added back to the Portfolio sheet</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Setup Webhook</h4>
                      <p className="text-sm text-gray-500">Register webhook with Smartsheet to enable automation</p>
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/webhooks/smartsheet/setup', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${user?.lastName}` }
                          })
                          const data = await response.json()
                          if (data.success) {
                            alert('✅ Webhook created successfully! Automation is now active.')
                          } else {
                            alert('❌ Failed to create webhook: ' + (data.message || data.error))
                          }
                        } catch (err) {
                          alert('Error setting up webhook')
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Enable Automation
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Manual Trigger</h4>
                      <p className="text-sm text-gray-500">Check for new projects and create WBS folders now</p>
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/portfolio/new-projects', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${user?.lastName}` }
                          })
                          const data = await response.json()
                          alert(data.message || 'Check completed')
                        } catch (err) {
                          alert('Error checking for new projects')
                        }
                      }}
                      variant="outline"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Run Now
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Check Webhook Status</h4>
                      <p className="text-sm text-gray-500">View active webhooks for Portfolio sheet</p>
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/webhooks/smartsheet/setup', {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${user?.lastName}` }
                          })
                          const data = await response.json()
                          if (data.portfolioWebhooks > 0) {
                            alert(`✅ ${data.portfolioWebhooks} webhook(s) active for Portfolio sheet`)
                          } else {
                            alert('⚠️ No webhooks found. Click "Enable Automation" to set up.')
                          }
                        } catch (err) {
                          alert('Error checking webhook status')
                        }
                      }}
                      variant="outline"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Check Status
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Settings */}
          <TabsContent value="integrations" className="space-y-6">
              {/* Smartsheet Integration */}
              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="mr-2 h-5 w-5" />
                    Smartsheet Integration
                  </CardTitle>
                  <CardDescription>
                    Configure connection to Smartsheet for automatic synchronization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Enable Smartsheet Integration</Label>
                      <p className="text-sm text-gray-600">Automatically sync projects with Smartsheet</p>
                    </div>
                    <Switch
                      checked={systemSettings.smartsheetSettings.enabled}
                      onCheckedChange={(checked) => setSystemSettings(prev => ({
                        ...prev,
                        smartsheetSettings: { ...prev.smartsheetSettings, enabled: checked }
                      }))}
                    />
                  </div>

                  {systemSettings.smartsheetSettings.enabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="smartsheetApiKey">API Key</Label>
                        <div className="relative">
                          <Input
                            id="smartsheetApiKey"
                            type={showApiKey ? "text" : "password"}
                            value={systemSettings.smartsheetSettings.apiKey}
                            onChange={(e) => setSystemSettings(prev => ({
                              ...prev,
                              smartsheetSettings: { ...prev.smartsheetSettings, apiKey: e.target.value }
                            }))}
                            placeholder="Enter your Smartsheet API key"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="workspaceId">Workspace ID</Label>
                        <Input
                          id="workspaceId"
                          value={systemSettings.smartsheetSettings.workspaceId}
                          onChange={(e) => setSystemSettings(prev => ({
                            ...prev,
                            smartsheetSettings: { ...prev.smartsheetSettings, workspaceId: e.target.value }
                          }))}
                          placeholder="Enter workspace ID"
                        />
                      </div>

                      <div className="flex items-center space-x-4">
                        <Button
                          onClick={testSmartsheetConnection}
                          disabled={testConnectionStatus === 'testing'}
                          variant="outline"
                        >
                          {testConnectionStatus === 'testing' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                          Test Connection
                        </Button>

                        <div className="flex gap-2">
                          <Button
                            onClick={syncFromSmartsheet}
                            disabled={syncStatus === 'syncing' || !systemSettings.smartsheetSettings.enabled}
                            variant="outline"
                          >
                            {syncStatus === 'syncing' && <SyncIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync from Smartsheet'}
                          </Button>
                          
                          <Button
                            onClick={async () => {
                              if (!confirm('This will clear all cached WBS data and force a fresh sync. Are you sure?')) return
                              
                              try {
                                const response = await fetch('/api/wbs/clear-cache', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${user?.lastName}`,
                                  },
                                })
                                
                                const data = await response.json()
                                
                                if (response.ok) {
                                  alert(`✅ ${data.message}`)
                                } else {
                                  alert(`❌ Error: ${data.error}`)
                                }
                              } catch (error) {
                                console.error('Error clearing cache:', error)
                                alert('❌ Failed to clear cache')
                              }
                            }}
                            variant="destructive"
                            size="sm"
                          >
                            Clear WBS Cache
                          </Button>
                        </div>

                        {testConnectionStatus === 'success' && (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Connection successful
                          </div>
                        )}

                        {testConnectionStatus === 'error' && (
                          <div className="flex items-center text-red-600">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Connection failed
                          </div>
                        )}
                      </div>

                      {syncMessage && (
                        <div className={`mt-4 p-3 rounded-md ${
                          syncStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                          syncStatus === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                          'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {syncMessage}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={saveSystemSettings} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Integration Settings'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <>
      <Navigation />
      <SettingsContent />
    </>
  )
}
