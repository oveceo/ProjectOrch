'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Users,
  FileText,
  ExternalLink,
  Edit,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  Layers,
  TrendingUp,
  Building2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ListTodo,
  Circle
} from 'lucide-react'
import Link from 'next/link'

interface ProjectDetails {
  id: string
  projectCode: string
  title: string
  description?: string | null
  category?: string | null
  status: string
  approvalStatus: string
  wbsSheetId?: string | null
  wbsSheetUrl?: string | null
  startDate?: string | null
  endDate?: string | null
  budget?: string | null
  actual?: string | null
  variance?: string | null
  ownerLastName?: string | null
  approverLastName?: string | null
  creatorLastName?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    wbsCache: number
  }
  creator?: { name: string; email: string } | null
  assignee?: { name: string; email: string } | null
  approver?: { name: string; email: string } | null
}

interface WbsStats {
  total: number
  complete: number
  inProgress: number
  notStarted: number
  blocked: number
  atRisk: number
}

interface WbsItem {
  id: string
  name: string
  description?: string | null
  status: string
  parentRowId?: string | null
  smartsheetRowId?: string | null
  skipWbs: boolean
  ownerLastName?: string | null
  children: WbsItem[]
  progress: number
  completedCount: number
  totalCount: number
}

// Build hierarchical tree and calculate progress
function buildProgressTree(flatItems: any[]): { tree: WbsItem[], overallProgress: number } {
  const itemMap = new Map<string, WbsItem>()
  const rootItems: WbsItem[] = []

  // First pass: create all items
  flatItems.forEach((item) => {
    const wbsItem: WbsItem = {
      id: item.id,
      name: item.name || 'Unnamed',
      description: item.description,
      status: item.status || 'Not_Started',
      parentRowId: item.parentRowId,
      smartsheetRowId: item.smartsheetRowId,
      skipWbs: item.skipWbs || false,
      ownerLastName: item.ownerLastName,
      children: [],
      progress: 0,
      completedCount: 0,
      totalCount: 0
    }
    itemMap.set(item.id, wbsItem)
    if (item.smartsheetRowId) {
      itemMap.set(item.smartsheetRowId, wbsItem)
    }
  })

  // Second pass: build hierarchy
  flatItems.forEach((item) => {
    const wbsItem = itemMap.get(item.id)!
    const parentKey = item.parentRowId
    
    if (parentKey && itemMap.has(parentKey)) {
      const parent = itemMap.get(parentKey)!
      parent.children.push(wbsItem)
    } else if (!item.skipWbs) {
      // Only add non-skipWbs items as potential roots
      rootItems.push(wbsItem)
    } else {
      // Header rows (skipWbs) - find phases underneath
      rootItems.push(wbsItem)
    }
  })

  // Calculate progress bottom-up (subtasks -> tasks -> phases)
  const calculateProgress = (item: WbsItem): { completed: number, total: number } => {
    if (item.children.length === 0) {
      // Leaf node - progress is based on its own status
      const isComplete = item.status === 'Complete'
      item.progress = isComplete ? 100 : 0
      item.completedCount = isComplete ? 1 : 0
      item.totalCount = 1
      return { completed: isComplete ? 1 : 0, total: 1 }
    }

    // Non-leaf - calculate from children (excluding skipWbs header items)
    let totalCompleted = 0
    let totalItems = 0

    item.children.forEach(child => {
      if (!child.skipWbs) {
        const childStats = calculateProgress(child)
        totalCompleted += childStats.completed
        totalItems += childStats.total
      } else {
        // For skipWbs items, recurse into their children
        calculateProgress(child)
      }
    })

    item.completedCount = totalCompleted
    item.totalCount = totalItems
    item.progress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

    return { completed: totalCompleted, total: totalItems }
  }

  // Calculate progress for all root items
  let overallCompleted = 0
  let overallTotal = 0
  
  rootItems.forEach(item => {
    const stats = calculateProgress(item)
    if (!item.skipWbs) {
      overallCompleted += stats.completed
      overallTotal += stats.total
    } else {
      // For header items, count their non-skipWbs children
      item.children.forEach(child => {
        if (!child.skipWbs) {
          overallCompleted += child.completedCount
          overallTotal += child.totalCount
        }
      })
    }
  })

  const overallProgress = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0

  return { tree: rootItems, overallProgress }
}

const STATUS_COLORS: Record<string, string> = {
  'Not_Started': 'bg-gray-100 text-gray-800',
  'In_Progress': 'bg-blue-100 text-blue-800',
  'Complete': 'bg-green-100 text-green-800',
  'Blocked': 'bg-red-100 text-red-800',
  'At_Risk': 'bg-orange-100 text-orange-800',
}

const APPROVAL_COLORS: Record<string, string> = {
  'Pending_Approval': 'bg-yellow-100 text-yellow-800',
  'Approved': 'bg-green-100 text-green-800',
  'Rejected': 'bg-red-100 text-red-800',
}

// Interactive Progress Item Component
function ProgressItem({ 
  item, 
  level = 0, 
  defaultExpanded = false 
}: { 
  item: WbsItem
  level?: number
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasChildren = item.children.filter(c => !c.skipWbs).length > 0
  
  // Determine item type based on level
  const getItemType = () => {
    if (item.skipWbs) return 'header'
    if (level === 0) return 'phase'
    if (level === 1) return 'task'
    return 'subtask'
  }
  
  const itemType = getItemType()
  
  // Get progress bar color based on progress
  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-blue-500'
    if (progress >= 50) return 'bg-yellow-500'
    if (progress > 0) return 'bg-orange-500'
    return 'bg-gray-300'
  }

  // Get status badge
  const getStatusBadge = () => {
    const statusColors: Record<string, string> = {
      'Complete': 'bg-green-100 text-green-800',
      'In_Progress': 'bg-blue-100 text-blue-800',
      'Not_Started': 'bg-gray-100 text-gray-600',
      'Blocked': 'bg-red-100 text-red-800',
    }
    return statusColors[item.status] || statusColors['Not_Started']
  }

  // Skip rendering header items, just render their children
  if (item.skipWbs) {
    return (
      <>
        {item.children.filter(c => !c.skipWbs).map(child => (
          <ProgressItem key={child.id} item={child} level={0} defaultExpanded={defaultExpanded} />
        ))}
      </>
    )
  }

  return (
    <div className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div 
        className={`
          p-3 rounded-lg mb-2 transition-all cursor-pointer
          ${hasChildren ? 'hover:bg-blue-50' : 'hover:bg-gray-50'}
          ${expanded && hasChildren ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200'}
        `}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Expand/Collapse Icon */}
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="h-5 w-5 text-blue-500 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              )
            ) : (
              <Circle className="h-3 w-3 text-gray-300 ml-1 flex-shrink-0" />
            )}
            
            {/* Icon based on type */}
            {itemType === 'phase' && (
              expanded ? <FolderOpen className="h-5 w-5 text-blue-500" /> : <Folder className="h-5 w-5 text-blue-400" />
            )}
            {itemType === 'task' && <ListTodo className="h-4 w-4 text-green-500" />}
            {itemType === 'subtask' && <CheckCircle2 className={`h-4 w-4 ${item.status === 'Complete' ? 'text-green-500' : 'text-gray-400'}`} />}
            
            {/* Name */}
            <span className={`font-medium truncate ${itemType === 'phase' ? 'text-gray-900' : 'text-gray-700'}`}>
              {item.name}
            </span>
            
            {/* Assigned To */}
            {item.ownerLastName && (
              <span className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                <Users className="h-3 w-3 mr-1" />
                {item.ownerLastName}
              </span>
            )}
            
            {/* Status Badge for leaf items */}
            {!hasChildren && (
              <Badge className={`${getStatusBadge()} text-xs flex-shrink-0`}>
                {item.status.replace('_', ' ')}
              </Badge>
            )}
          </div>
          
          {/* Progress Section */}
          <div className="flex items-center space-x-3 ml-4">
            <div className="text-right">
              <span className={`text-lg font-bold ${item.progress === 100 ? 'text-green-600' : 'text-gray-700'}`}>
                {item.progress}%
              </span>
              {hasChildren && (
                <p className="text-xs text-gray-500">
                  {item.completedCount}/{item.totalCount}
                </p>
              )}
            </div>
            <div className="w-24">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor(item.progress)} transition-all duration-300`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Description if available */}
        {item.description && expanded && (
          <p className="mt-2 text-sm text-gray-500 ml-8">{item.description}</p>
        )}
      </div>
      
      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1">
          {item.children.filter(c => !c.skipWbs).map(child => (
            <ProgressItem key={child.id} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectOverviewContent() {
  const { user, isLoading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [wbsStats, setWbsStats] = useState<WbsStats | null>(null)
  const [wbsItems, setWbsItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProgressBreakdown, setShowProgressBreakdown] = useState(false)

  // Build progress tree from WBS items
  const progressData = useMemo(() => {
    if (wbsItems.length === 0) return { tree: [], overallProgress: 0 }
    return buildProgressTree(wbsItems)
  }, [wbsItems])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/simple')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && projectId) {
      fetchProjectData()
    }
  }, [user, projectId])

  const fetchProjectData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch project details
      const projectRes = await fetch(`/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })
      
      if (!projectRes.ok) throw new Error('Failed to fetch project')
      const projectData = await projectRes.json()
      setProject(projectData)

      // Fetch WBS items to calculate stats
      const wbsRes = await fetch(`/api/projects/${projectId}/wbs`, {
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })

      if (wbsRes.ok) {
        const wbsData = await wbsRes.json()
        if (wbsData.success && wbsData.data) {
          const items = wbsData.data
          setWbsItems(items)
          setWbsStats({
            total: items.filter((i: any) => !i.skipWbs).length,
            complete: items.filter((i: any) => i.status === 'Complete' && !i.skipWbs).length,
            inProgress: items.filter((i: any) => i.status === 'In_Progress' && !i.skipWbs).length,
            notStarted: items.filter((i: any) => i.status === 'Not_Started' && !i.skipWbs).length,
            blocked: items.filter((i: any) => i.status === 'Blocked' && !i.skipWbs).length,
            atRisk: items.filter((i: any) => i.atRisk && !i.skipWbs).length,
          })
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load project data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Not set'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) return '$0.00'
    const num = parseFloat(amount.replace(/[^0-9.-]/g, ''))
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  const getProgressPercent = () => {
    // Use the calculated progress from the tree (accounts for hierarchy)
    return progressData.overallProgress
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading Project...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
        <Navigation />
        <div className="max-w-4xl mx-auto p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {error || 'Project not found'}
            </AlertDescription>
          </Alert>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-3xl font-bold text-gray-900">{project.projectCode}</h1>
                  <Badge className={STATUS_COLORS[project.status] || STATUS_COLORS['Not_Started']}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                  <Badge className={APPROVAL_COLORS[project.approvalStatus] || APPROVAL_COLORS['Pending_Approval']}>
                    {project.approvalStatus.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xl text-gray-600 mt-1">{project.title}</p>
                {project.category && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center">
                    <Building2 className="h-4 w-4 mr-1" />
                    {project.category}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {project.wbsSheetUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={project.wbsSheetUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View in Smartsheet
                  </a>
                </Button>
              )}
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href={`/wbs/project/${project.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit WBS
                </Link>
              </Button>
            </div>
          </div>

          {project.description && (
            <p className="mt-4 text-gray-600 bg-gray-50 p-4 rounded-lg">
              {project.description}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Progress Card - CLICKABLE */}
          <Card 
            className={`border-l-4 border-l-blue-500 cursor-pointer transition-all hover:shadow-lg hover:border-blue-400 ${showProgressBreakdown ? 'ring-2 ring-blue-400' : ''}`}
            onClick={() => setShowProgressBreakdown(!showProgressBreakdown)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                <span className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Overall Progress
                </span>
                {showProgressBreakdown ? (
                  <ChevronDown className="h-4 w-4 text-blue-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{getProgressPercent()}%</div>
              <Progress value={getProgressPercent()} className="mt-2" />
              <p className="text-xs text-gray-500 mt-1">
                {wbsStats?.complete || 0} of {wbsStats?.total || 0} items complete
              </p>
              <p className="text-xs text-blue-500 mt-2 font-medium">
                Click to {showProgressBreakdown ? 'hide' : 'view'} breakdown →
              </p>
            </CardContent>
          </Card>

          {/* WBS Tasks Card */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <Layers className="h-4 w-4 mr-2" />
                WBS Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{wbsStats?.total || 0}</div>
              <div className="flex space-x-2 mt-2 text-xs">
                <span className="text-blue-600">{wbsStats?.inProgress || 0} active</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">{wbsStats?.notStarted || 0} pending</span>
              </div>
            </CardContent>
          </Card>

          {/* At Risk Card */}
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Items at Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${(wbsStats?.atRisk || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {wbsStats?.atRisk || 0}
              </div>
              {(wbsStats?.blocked || 0) > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {wbsStats?.blocked} blocked tasks
                </p>
              )}
            </CardContent>
          </Card>

          {/* Budget Card */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(project.budget)}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {project.actual && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Actual:</span>
                    <span className="font-medium">{formatCurrency(project.actual)}</span>
                  </div>
                )}
                {project.variance && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Variance:</span>
                    <span className={`font-medium ${parseFloat(project.variance.replace(/[^0-9.-]/g, '')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(project.variance)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Breakdown - Interactive */}
        {showProgressBreakdown && progressData.tree.length > 0 && (
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center">
                  <Layers className="h-5 w-5 mr-2 text-blue-600" />
                  Progress Breakdown
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); setShowProgressBreakdown(false); }}
                >
                  Close
                </Button>
              </CardTitle>
              <CardDescription>
                Click on phases to expand and see task progress. Progress is calculated based on child completion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {progressData.tree.map(item => (
                  <ProgressItem key={item.id} item={item} defaultExpanded={true} />
                ))}
              </div>
              
              {/* Legend */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Progress Legend:</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-green-500 rounded" />
                    <span>100% Complete</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-blue-500 rounded" />
                    <span>75%+ Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-yellow-500 rounded" />
                    <span>50%+ Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-orange-500 rounded" />
                    <span>Some Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-2 bg-gray-300 rounded" />
                    <span>Not Started</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">Start Date</span>
                <span className="font-medium">{formatDate(project.startDate)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">End Date</span>
                <span className="font-medium">{formatDate(project.endDate)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">Created</span>
                <span className="font-medium">{formatDate(project.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-medium">{formatDate(project.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Team Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Users className="h-5 w-5 mr-2 text-blue-600" />
                Team
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">Project Owner (Assigned To)</span>
                <span className="font-medium text-blue-700">{project.ownerLastName || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-gray-600">Approver</span>
                <span className="font-medium text-purple-700">{project.approverLastName || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600">Created</span>
                <span className="font-medium">{project.creatorLastName || 'System (from Smartsheet sync)'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Status Breakdown */}
        {wbsStats && wbsStats.total > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Target className="h-5 w-5 mr-2 text-blue-600" />
                Task Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{wbsStats.complete}</div>
                  <div className="text-sm text-gray-600">Complete</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{wbsStats.inProgress}</div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-600">{wbsStats.notStarted}</div>
                  <div className="text-sm text-gray-600">Not Started</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">{wbsStats.blocked}</div>
                  <div className="text-sm text-gray-600">Blocked</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-orange-600">{wbsStats.atRisk}</div>
                  <div className="text-sm text-gray-600">At Risk</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex justify-center space-x-4">
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Link href={`/wbs/project/${project.id}`}>
              <Layers className="h-5 w-5 mr-2" />
              Open WBS Editor
            </Link>
          </Button>
          {project.wbsSheetUrl && (
            <Button asChild size="lg" variant="outline">
              <a href={project.wbsSheetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-5 w-5 mr-2" />
                View in Smartsheet
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProjectOverviewPage() {
  return <ProjectOverviewContent />
}
