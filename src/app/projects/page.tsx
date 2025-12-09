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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertTriangle, Calendar, Clock, Search, Filter, FolderOpen, CheckCircle2, XCircle, AlertCircle, Plus, Edit, Trash2, MoreHorizontal, Layers, ExternalLink } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ProjectWithRelations, ApiResponse } from '@/types'
import { ProjectStatus, ApprovalStatus } from '@prisma/client'

// Shape of project update payload (matches /api/projects/[id] schema)
interface CreateProjectForm {
  title?: string
  description?: string
  category?: string
  approverEmail?: string
  assigneeEmail?: string
  approvalStatus?: ApprovalStatus
  status?: ProjectStatus
  requiresWbs?: boolean
  budget?: string
  actual?: string
  variance?: string
  startDate?: string
  endDate?: string
  atRisk?: boolean
}


function ProjectsContent() {
  const { user, isLoading } = useAuth()
  const [projects, setProjects] = useState<ProjectWithRelations[]>([])
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [approvalFilter, setApprovalFilter] = useState<string>('all')
  const [createWbsDialogOpen, setCreateWbsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithRelations | null>(null)
  const [wbsForm, setWbsForm] = useState({
    projectCode: '',
    title: '',
    description: ''
  })
  const [wbsSubmitting, setWbsSubmitting] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      redirect('/auth/simple')
    }
  }, [user, isLoading])

  // Fetch projects
  useEffect(() => {
    if (user) {
      fetchProjects()
    }
  }, [user])

  // Filter projects
  useEffect(() => {
    let filtered = projects

    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.projectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(project => project.category === categoryFilter)
    }

    if (approvalFilter !== 'all') {
      filtered = filtered.filter(project => project.approvalStatus === approvalFilter)
    }

    setFilteredProjects(filtered)
  }, [projects, searchTerm, statusFilter, categoryFilter, approvalFilter])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${user?.lastName}`
        }
      })
      const data: ApiResponse<ProjectWithRelations[]> = await response.json()

      if (data.success && data.data) {
        setProjects(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleCreateWbsProject = async () => {
    if (!wbsForm.title.trim()) {
      alert('Project title is required')
      return
    }

    setWbsSubmitting(true)
    try {
      const response = await fetch('/api/projects/create-wbs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.lastName}`,
        },
        body: JSON.stringify({
          projectCode: '', // Empty string will trigger auto-generation
          projectTitle: wbsForm.title,
          description: wbsForm.description,
          createdBy: user?.name || user?.lastName || 'Unknown'
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Add the new project to the list
        const newProject = data.project
        setProjects(prev => [newProject, ...prev])
        setCreateWbsDialogOpen(false)
        setWbsForm({
          projectCode: '',
          title: '',
          description: ''
        })
        alert(`✅ WBS Project ${newProject.projectCode} created successfully!\n\nSmartsheet folder and WBS template have been created.`)
      } else {
        console.error('Failed to create WBS project:', data.error)
        alert(`Failed to create WBS project: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to create WBS project:', error)
      alert('Failed to create WBS project. Please try again.')
    } finally {
      setWbsSubmitting(false)
    }
  }

  const handleUpdateProject = async (projectId: string, updates: Partial<CreateProjectForm>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.lastName}`,
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (response.ok) {
        setProjects(prev => prev.map(p => p.id === projectId ? data : p))
        setEditingProject(null)
      } else {
        alert(data.error || 'Failed to update project')
      }
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Failed to update project')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      'Not_Started': 'status-not-started',
      'In_Progress': 'status-in-progress',
      'Blocked': 'status-blocked',
      'At_Risk': 'status-at-risk',
      'Complete': 'status-complete'
    }

    const statusLabels: Record<string, string> = {
      'Not_Started': 'Not Started',
      'In_Progress': 'In Progress',
      'Blocked': 'Blocked',
      'At_Risk': 'At Risk',
      'Complete': 'Complete'
    }

    return (
      <Badge className={`${statusClasses[status] || 'status-not-started'} font-medium px-3 py-1`}>
        {statusLabels[status] || status.replace('_', ' ')}
      </Badge>
    )
  }

  const getApprovalStatusBadge = (status: string) => {
    const approvalClasses: Record<string, string> = {
      'Pending_Approval': 'approval-pending',
      'Approved': 'approval-approved',
      'Rejected': 'approval-rejected'
    }

    const approvalLabels: Record<string, string> = {
      'Pending_Approval': 'Pending',
      'Approved': 'Approved',
      'Rejected': 'Rejected'
    }

    return (
      <Badge className={`${approvalClasses[status] || 'approval-pending'} font-medium px-3 py-1`}>
        {approvalLabels[status] || status.replace('_', ' ')}
      </Badge>
    )
  }

  // Show loading while auth is loading
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Don't render anything if not authenticated
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Project Management
              </h1>
              <p className="text-lg text-gray-600">
                View and manage Work Breakdown Structure (WBS) projects
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
              <Button
                onClick={() => window.open('https://app.smartsheet.com/b/form/019345ef18197ac2926824b1d5b29fdf', '_blank')}
                className="btn-electric"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project Request
              </Button>

              <Dialog open={createWbsDialogOpen} onOpenChange={setCreateWbsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Create WBS Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create WBS Project</DialogTitle>
                    <DialogDescription>
                      Create a new Work Breakdown Structure project with Smartsheet integration.
                      This will automatically create the folder structure and WBS template in Smartsheet.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="wbs-title">Project Title *</Label>
                      <Input
                        id="wbs-title"
                        placeholder="e.g., Network Infrastructure Upgrade"
                        value={wbsForm.title}
                        onChange={(e) => setWbsForm(prev => ({ ...prev, title: e.target.value }))}
                      />
                      <p className="text-sm text-gray-500">Project code will be auto-generated (P-XXXX format)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wbs-description">Description</Label>
                      <Textarea
                        id="wbs-description"
                        placeholder="Brief description of the project..."
                        value={wbsForm.description}
                        onChange={(e) => setWbsForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateWbsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateWbsProject} disabled={wbsSubmitting} className="btn-electric">
                      {wbsSubmitting ? 'Creating...' : 'Create WBS Project'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="corporate-card border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Total Projects
              </CardTitle>
              <FolderOpen className="h-8 w-8 bg-blue-100 rounded-full p-2 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{projects.length}</div>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                In Progress
              </CardTitle>
              <Clock className="h-8 w-8 bg-green-100 rounded-full p-2 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {projects.filter(p => p.status === 'In_Progress').length}
              </div>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                At Risk
              </CardTitle>
              <AlertTriangle className="h-8 w-8 bg-orange-100 rounded-full p-2 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {projects.filter(p => p.atRisk).length}
              </div>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Pending Approval
              </CardTitle>
              <AlertCircle className="h-8 w-8 bg-purple-100 rounded-full p-2 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {projects.filter(p => p.approvalStatus === 'Pending_Approval').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Table */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">All Projects</h2>
                <p className="text-gray-600 mt-1">Manage and track project details</p>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Not_Started">Not Started</SelectItem>
                  <SelectItem value="In_Progress">In Progress</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                  <SelectItem value="At_Risk">At Risk</SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Safety">Safety</SelectItem>
                </SelectContent>
              </Select>
              <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Approvals</SelectItem>
                  <SelectItem value="Pending_Approval">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Project Code</TableHead>
                  <TableHead className="font-semibold text-gray-700">Title</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700">Approval</TableHead>
                  <TableHead className="font-semibold text-gray-700">Assignee</TableHead>
                  <TableHead className="font-semibold text-gray-700">Due Date</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project, index) => (
                  <TableRow key={project.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <TableCell className="font-mono font-semibold text-blue-700">
                      {project.projectCode}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 max-w-xs">
                      <div className="truncate" title={project.title}>
                        {project.title}
                      </div>
                      {project.description && (
                        <div className="text-xs text-gray-500 truncate mt-1 max-w-xs" title={project.description}>
                          {project.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell>{getApprovalStatusBadge(project.approvalStatus)}</TableCell>
                    <TableCell className="text-sm">
                      {project.assignee?.name || project.assigneeEmail || (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.endDate ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className={project.endDate && new Date(project.endDate) < new Date() && project.status !== 'Complete' ? 'text-red-600 font-medium' : ''}>
                            {new Date(project.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No due date</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-300 hover:bg-blue-50"
                          asChild
                        >
                          <a href={`/projects/${project.id}`}>View</a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={`/wbs/project/${project.id}`}>
                                <Layers className="mr-2 h-4 w-4" />
                                Manage WBS
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingProject(project)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Project
                            </DropdownMenuItem>
                            {project.wbsSheetId && (
                              <DropdownMenuItem asChild>
                                <a href={`https://app.smartsheet.com/sheets/${project.wbsSheetId}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  View in Smartsheet
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteProject(project.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-16">
              <div className="flex flex-col items-center space-y-4">
                <FolderOpen className="h-16 w-16 text-gray-400" />
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No projects found</h3>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || approvalFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Get started by creating your first project.'}
                  </p>
                </div>
                {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && approvalFilter === 'all' && (
                  <Button className="btn-electric" onClick={() => window.open('https://app.smartsheet.com/b/form/019345ef18197ac2926824b1d5b29fdf', '_blank')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Project
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <>
      <Navigation />
      <ProjectsContent />
    </>
  )
}
