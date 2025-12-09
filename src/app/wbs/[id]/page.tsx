'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { redirect, useParams, useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Save,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  Target,
  User,
  Edit,
  X,
  Upload,
  Download,
  RefreshCw,
  ExternalLink,
  Layers,
  Hash,
  Users
} from 'lucide-react'
import Link from 'next/link'

interface WbsTask {
  id: string
  name: string
  description: string | null
  ownerLastName: string | null
  approverLastName: string | null
  status: string
  startDate: Date | null
  endDate: Date | null
  budget: string | null
  actual: string | null
  variance: string | null
  notes: string | null
  atRisk: boolean
  orderIndex: number | null
  smartsheetRowId: string | null
  createdAt: Date
  updatedAt: Date
  lastSyncedAt: Date | null
  project: {
    id: string
    projectCode: string
    title: string
    status: string
    category: string | null
  }
}

const STATUS_OPTIONS = [
  { value: 'Not_Started', label: 'Not Started', color: 'bg-gray-100 text-gray-800' },
  { value: 'In_Progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'Complete', label: 'Complete', color: 'bg-green-100 text-green-800' },
  { value: 'Approval_Pending', label: 'Approval Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'On_Hold', label: 'On Hold', color: 'bg-red-100 text-red-800' }
]

const TEAM_MEMBERS = [
  'Adams', 'Allen', 'Barringer', 'Campbell', 'Clark', 'Donahue', 'Egbert', 'Elswick',
  'Fields', 'Forster', 'Galloway', 'Green', 'Hall', 'Hicks', 'Huff', 'McCord',
  'Merritt', 'Privette', 'Roberts', 'Southall', 'Thomas', 'Thompson', 'Waugh', 'Woodworth'
]

function WbsTaskContent() {
  const { user, isLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const [wbsTask, setWbsTask] = useState<WbsTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ownerLastName: 'none',
    approverLastName: 'none',
    status: 'Not_Started',
    startDate: '',
    endDate: '',
    budget: '',
    actual: '',
    variance: '',
    notes: '',
    atRisk: false
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      redirect('/auth/simple')
    }
  }, [user, isLoading])

  // Load WBS task data
  useEffect(() => {
    if (user && params.id) {
      fetchWbsTask()
    }
  }, [user, params.id])

  const fetchWbsTask = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/wbs/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${user?.lastName}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch WBS task')
      }

      const data = await response.json()
      setWbsTask(data)
      
      // Populate form
      setFormData({
        name: data.name || '',
        description: data.description || '',
        ownerLastName: data.ownerLastName || 'none',
        approverLastName: data.approverLastName || 'none',
        status: data.status || 'Not_Started',
        startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
        endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
        budget: data.budget || '',
        actual: data.actual || '',
        variance: data.variance || '',
        notes: data.notes || '',
        atRisk: data.atRisk || false
      })
      
    } catch (error) {
      console.error('Error fetching WBS task:', error)
      setError('Failed to load WBS task')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/wbs/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.lastName}`,
        },
        body: JSON.stringify({
          ...formData,
          ownerLastName: formData.ownerLastName === 'none' ? null : formData.ownerLastName,
          approverLastName: formData.approverLastName === 'none' ? null : formData.approverLastName,
          startDate: formData.startDate ? new Date(formData.startDate) : null,
          endDate: formData.endDate ? new Date(formData.endDate) : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save WBS task')
      }

      const updatedTask = await response.json()
      setWbsTask(updatedTask)
      setSuccessMessage('✅ WBS task saved successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error) {
      console.error('Error saving WBS task:', error)
      setError(error instanceof Error ? error.message : 'Failed to save WBS task')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncToSmartsheet = async () => {
    try {
      setSyncing(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/wbs/${params.id}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.lastName}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync to Smartsheet')
      }

      const result = await response.json()
      setSuccessMessage('✅ Changes synced to Smartsheet successfully!')
      
      // Refresh task data
      await fetchWbsTask()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error) {
      console.error('Error syncing to Smartsheet:', error)
      setError(error instanceof Error ? error.message : 'Failed to sync to Smartsheet')
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status)
    return statusOption || STATUS_OPTIONS[0]
  }

  const calculateProgress = () => {
    const status = formData.status
    switch (status) {
      case 'Not_Started': return 0
      case 'In_Progress': return 50
      case 'Complete': return 100
      case 'Approved': return 100
      case 'Approval_Pending': return 90
      case 'On_Hold': return 25
      default: return 0
    }
  }

  const formatCurrency = (value: string) => {
    if (!value) return ''
    const num = parseFloat(value.replace(/[^0-9.-]+/g, ''))
    if (isNaN(num)) return value
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-lg text-gray-600">Loading WBS task...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error && !wbsTask) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error</AlertTitle>
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Layers className="mr-3 h-8 w-8 text-blue-600" />
                WBS Task Editor
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                Edit work breakdown structure task details
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button onClick={handleSave} disabled={saving} className="btn-electric">
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleSyncToSmartsheet} 
              disabled={syncing}
              variant="outline"
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              {syncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Sync to Smartsheet
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <Alert className="border-green-200 bg-green-50 mb-6">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50 mb-6">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error</AlertTitle>
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Task Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project & Task Info */}
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hash className="mr-2 h-5 w-5" />
                  Task Information
                </CardTitle>
                <CardDescription>
                  Project: {wbsTask?.project.projectCode} - {wbsTask?.project.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Task Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter task name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the task details and requirements"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="owner">Assigned To</Label>
                    <Select
                      value={formData.ownerLastName}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, ownerLastName: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No assignee</SelectItem>
                        {TEAM_MEMBERS.map(member => (
                          <SelectItem key={member} value={member}>{member}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="approver">Approver</Label>
                    <Select
                      value={formData.approverLastName}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, approverLastName: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select approver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No approver</SelectItem>
                        {TEAM_MEMBERS.map(member => (
                          <SelectItem key={member} value={member}>{member}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Schedule & Status */}
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Schedule & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Progress</Label>
                  <div className="flex items-center space-x-3">
                    <Progress value={calculateProgress()} className="flex-1" />
                    <span className="text-sm font-medium text-gray-600">{calculateProgress()}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="atRisk"
                    checked={formData.atRisk}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, atRisk: checked }))}
                  />
                  <Label htmlFor="atRisk" className="flex items-center">
                    <AlertTriangle className="mr-1 h-4 w-4 text-yellow-600" />
                    Task is at risk
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Budget & Financials */}
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Budget & Financials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget</Label>
                    <Input
                      id="budget"
                      value={formData.budget}
                      onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                      placeholder="$0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="actual">Actual</Label>
                    <Input
                      id="actual"
                      value={formData.actual}
                      onChange={(e) => setFormData(prev => ({ ...prev, actual: e.target.value }))}
                      placeholder="$0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="variance">Variance</Label>
                    <Input
                      id="variance"
                      value={formData.variance}
                      onChange={(e) => setFormData(prev => ({ ...prev, variance: e.target.value }))}
                      placeholder="$0"
                      className={
                        formData.variance && parseFloat(formData.variance.replace(/[^0-9.-]+/g, '')) < 0 
                          ? 'border-red-300 text-red-600' 
                          : ''
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Notes & Comments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any additional notes, comments, or updates about this task"
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Task Overview */}
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="mr-2 h-5 w-5" />
                  Task Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge className={getStatusBadge(formData.status).color}>
                    {getStatusBadge(formData.status).label}
                  </Badge>
                </div>

                {formData.ownerLastName && formData.ownerLastName !== 'none' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Assigned to:</span>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="text-sm font-medium">{formData.ownerLastName}</span>
                    </div>
                  </div>
                )}

                {formData.approverLastName && formData.approverLastName !== 'none' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Approver:</span>
                    <div className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="text-sm font-medium">{formData.approverLastName}</span>
                    </div>
                  </div>
                )}

                {formData.atRisk && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 text-sm">
                      This task is flagged as at risk
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="text-xs text-gray-500 space-y-1">
                  {wbsTask?.createdAt && (
                    <div>Created: {new Date(wbsTask.createdAt).toLocaleDateString()}</div>
                  )}
                  {wbsTask?.updatedAt && (
                    <div>Updated: {new Date(wbsTask.updatedAt).toLocaleDateString()}</div>
                  )}
                  {wbsTask?.lastSyncedAt && (
                    <div>Last Synced: {new Date(wbsTask.lastSyncedAt).toLocaleDateString()}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Context */}
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers className="mr-2 h-5 w-5" />
                  Project Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600">Project Code</div>
                  <div className="font-medium">{wbsTask?.project.projectCode}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Project Title</div>
                  <div className="font-medium text-sm">{wbsTask?.project.title}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Category</div>
                  <div className="font-medium">{wbsTask?.project.category || 'General'}</div>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/projects">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View All Projects
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WbsTaskPage() {
  return <WbsTaskContent />
}