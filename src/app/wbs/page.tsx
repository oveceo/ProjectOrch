'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, CheckCircle2, Clock, AlertTriangle, Target, RefreshCw, 
  Layers, Edit, ExternalLink, FolderOpen, Calendar, TrendingUp,
  ChevronRight, Filter
} from 'lucide-react'
import Link from 'next/link'
import { SyncPanel } from '@/components/SyncPanel'

interface Project {
  id: string
  projectCode: string
  title: string
  status: string
  category?: string | null
  wbsSheetId?: string | null
  wbsSheetUrl?: string | null
  _count?: { wbsCache: number }
}

interface WbsTask {
  id: string
  name: string
  description?: string | null
  status: string
  ownerLastName?: string | null
  startDate?: string | null
  endDate?: string | null
  atRisk: boolean
  parentRowId?: string | null
  project: {
    id: string
    projectCode: string
    title: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'Not_Started': { label: 'Not Started', color: 'text-gray-700', bg: 'bg-gray-100' },
  'In_Progress': { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  'Complete': { label: 'Complete', color: 'text-green-700', bg: 'bg-green-100' },
  'Blocked': { label: 'Blocked', color: 'text-red-700', bg: 'bg-red-100' },
  'At_Risk': { label: 'At Risk', color: 'text-orange-700', bg: 'bg-orange-100' },
}

function MainContent() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [myTasks, setMyTasks] = useState<WbsTask[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAllProjects, setShowAllProjects] = useState(false) // Default to My Projects - only show where user is in Assigned To

  // Define loadData first before using it in useEffect
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch projects - use ?all=true to show all, or filter by involvement
      const projectsUrl = showAllProjects 
        ? '/api/projects?all=true' 
        : '/api/projects'
      
      const [projectsRes, tasksRes] = await Promise.all([
        fetch(projectsUrl, { headers: { 'Authorization': `Bearer ${user?.lastName}` } }),
        fetch('/api/wbs/my-tasks', { headers: { 'Authorization': `Bearer ${user?.lastName}` } })
      ])

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        setProjects(projectsData.data || [])
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setMyTasks(tasksData.data || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.lastName, showAllProjects])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/simple')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  const syncFromSmartsheet = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/sync/smartsheet', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${user?.lastName}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Sync complete!' })
        await loadData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Sync failed' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to sync' })
    } finally {
      setSyncing(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  // Filter tasks
  const filteredTasks = myTasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.project.projectCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Stats
  const stats = {
    totalProjects: projects.length,
    totalTasks: myTasks.length,
    inProgress: myTasks.filter(t => t.status === 'In_Progress').length,
    complete: myTasks.filter(t => t.status === 'Complete').length,
    atRisk: myTasks.filter(t => t.atRisk).length,
    overdue: myTasks.filter(t => t.endDate && new Date(t.endDate) < new Date() && t.status !== 'Complete').length
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isOverdue = (task: WbsTask) => {
    return task.endDate && new Date(task.endDate) < new Date() && task.status !== 'Complete'
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-lg text-gray-600">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Breakdown Management</h1>
            <p className="text-gray-600 mt-1">Manage your projects and tasks</p>
          </div>
        </div>

        {/* Sync Panel - Create WBS folders & Sync data */}
        <SyncPanel onSyncComplete={loadData} />

        {/* Message */}
        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Projects</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
                </div>
                <FolderOpen className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">My Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
                </div>
                <Layers className="h-8 w-8 text-indigo-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Complete</p>
                  <p className="text-2xl font-bold text-green-600">{stats.complete}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">At Risk</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.atRisk}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <Calendar className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects Panel */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gray-50">
              <div className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center text-lg">
                  <FolderOpen className="h-5 w-5 mr-2 text-blue-600" />
                  {showAllProjects ? 'All Projects' : 'My Projects'}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllProjects(!showAllProjects)}
                  className="text-xs"
                >
                  <Filter className="h-3 w-3 mr-1" />
                  {showAllProjects ? 'Show Mine' : 'Show All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {projects.length > 0 ? (
                  <div className="divide-y">
                    {projects.map(project => {
                      // Get the actual project name from the WBS cache (the row with skipWbs that has the real title)
                      const displayTitle = project.title && project.title !== project.projectCode 
                        ? project.title 
                        : null
                      
                      return (
                        <div 
                          key={project.id} 
                          className="p-4 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <Link 
                                  href={`/projects/${project.id}`}
                                  className="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline"
                                >
                                  {project.projectCode}
                                </Link>
                                <Badge className={`${STATUS_CONFIG[project.status]?.bg} ${STATUS_CONFIG[project.status]?.color} text-xs`}>
                                  {STATUS_CONFIG[project.status]?.label || project.status}
                                </Badge>
                                {project.wbsSheetId && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Linked
                                  </Badge>
                                )}
                              </div>
                              {displayTitle && (
                                <p className="text-sm font-medium text-gray-800 truncate mt-1">{displayTitle}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {project._count?.wbsCache || 0} WBS items
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/wbs/project/${project.id}`}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit WBS
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No projects yet</p>
                    <Button onClick={syncFromSmartsheet} variant="outline" className="mt-3" size="sm">
                      Sync from Smartsheet
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* My Tasks Panel */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <Target className="h-5 w-5 mr-2 text-blue-600" />
                  My Tasks
                </CardTitle>
              </div>
              {/* Filters */}
              <div className="flex space-x-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search tasks..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Not_Started">Not Started</SelectItem>
                    <SelectItem value="In_Progress">In Progress</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {filteredTasks.length > 0 ? (
                  <div className="divide-y">
                    {filteredTasks.map(task => {
                      // Determine task type from name field
                      const taskType = task.name?.toLowerCase().includes('subtask') ? 'Subtask' : 'Task'
                      const displayName = task.description || task.name
                      // Get project title (prefer the title if different from code)
                      const projectTitle = task.project.title && task.project.title !== task.project.projectCode
                        ? task.project.title
                        : null
                      
                      return (
                        <Link 
                          key={task.id} 
                          href={`/wbs/project/${task.project.id}`}
                          className="block p-4 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              {/* Task Type Badge + Name */}
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  taskType === 'Task' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {taskType}
                                </span>
                                <span className="font-medium text-gray-900 truncate">{displayName}</span>
                                {task.atRisk && (
                                  <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                )}
                              </div>
                              {/* Project Info */}
                              <div className="mt-1.5">
                                <span className="text-xs font-mono text-blue-600 mr-2">{task.project.projectCode}</span>
                                {projectTitle && (
                                  <span className="text-sm text-gray-700">{projectTitle}</span>
                                )}
                              </div>
                              {/* Status + Dates */}
                              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                <Badge className={`${STATUS_CONFIG[task.status]?.bg} ${STATUS_CONFIG[task.status]?.color} text-xs`}>
                                  {STATUS_CONFIG[task.status]?.label}
                                </Badge>
                                {task.startDate && (
                                  <span className="text-xs text-gray-500">
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    Started {formatDate(task.startDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              {task.endDate ? (
                                <>
                                  <div className="text-xs text-gray-500 mb-1">Due</div>
                                  <div className={`text-sm font-medium ${isOverdue(task) ? 'text-red-600' : 'text-gray-700'}`}>
                                    {formatDate(task.endDate)}
                                  </div>
                                  {isOverdue(task) && (
                                    <span className="text-xs text-red-500 font-medium">Overdue</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">No due date</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{searchTerm || statusFilter !== 'all' ? 'No matching tasks' : 'No tasks assigned to you'}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function WbsPage() {
  return <MainContent />
}
