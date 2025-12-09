'use client'

import { useState, useEffect } from 'react'
import { redirect } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Mail,
  Phone,
  Shield,
  Zap,
  CheckCircle,
  User,
  Settings,
  MoreHorizontal,
  Edit,
  Trash2,
  Crown,
  Briefcase,
  Clock,
  BarChart3,
  Activity
} from 'lucide-react'
import { UserRole } from '@prisma/client'
import { ApiResponse } from '@/types'

interface TeamMember {
  id: string
  email: string
  name?: string | null
  role: UserRole
  createdAt: Date
  updatedAt: Date
  _count?: {
    createdProjects: number
    assignedProjects: number
    approvedProjects: number
  }
}

interface CreateUserForm {
  email: string
  name: string
  role: UserRole
}

function TeamContent() {
  const { user, isLoading } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    name: '',
    role: UserRole.assignee
  })
  const [submitting, setSubmitting] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      redirect('/auth/simple')
    }
  }, [user, isLoading])

  // Fetch team members
  useEffect(() => {
    if (user) {
      fetchTeamMembers()
    }
  }, [user])

  // Filter team members
  useEffect(() => {
    let filtered = teamMembers

    if (searchTerm) {
      filtered = filtered.filter(member =>
        member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => member.role === roleFilter)
    }

    setFilteredMembers(filtered)
  }, [teamMembers, searchTerm, roleFilter])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/team')
      const data: ApiResponse<TeamMember[]> = await response.json()

      if (data.success && data.data) {
        setTeamMembers(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMember = async () => {
    if (!createForm.email.trim()) {
      alert('Email is required')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      })

      const data = await response.json()

      if (response.ok) {
        setTeamMembers(prev => [...prev, data])
        setCreateDialogOpen(false)
        setCreateForm({
          email: '',
          name: '',
          role: UserRole.assignee
        })
      } else {
        alert(data.error || 'Failed to create team member')
      }
    } catch (error) {
      console.error('Error creating team member:', error)
      alert('Failed to create team member')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateMember = async (memberId: string, updates: Partial<CreateUserForm>) => {
    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (response.ok) {
        setTeamMembers(prev => prev.map(m => m.id === memberId ? data : m))
        setEditingMember(null)
      } else {
        alert(data.error || 'Failed to update team member')
      }
    } catch (error) {
      console.error('Error updating team member:', error)
      alert('Failed to update team member')
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setTeamMembers(prev => prev.filter(m => m.id !== memberId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to remove team member')
      }
    } catch (error) {
      console.error('Error removing team member:', error)
      alert('Failed to remove team member')
    }
  }

  const getRoleBadge = (role: UserRole) => {
    const roleConfig = {
      [UserRole.eo_engineer]: {
        label: 'Transmission Engineer',
        className: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: Zap
      },
      [UserRole.manager]: {
        label: 'Project Manager',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Shield
      },
      [UserRole.creator]: {
        label: 'Project Coordinator',
        className: 'bg-green-100 text-green-800 border-green-200',
        icon: User
      },
      [UserRole.assignee]: {
        label: 'Electrical Engineer',
        className: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: User
      },
      [UserRole.approver]: {
        label: 'Operations Manager',
        className: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: CheckCircle
      }
    }

    const config = roleConfig[role]
    const Icon = config.icon

    return (
      <Badge className={`${config.className} font-medium px-3 py-1`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getRoleDescription = (role: UserRole) => {
    const descriptions = {
      [UserRole.eo_engineer]: 'Full system access, can manage all projects and users',
      [UserRole.manager]: 'Can manage assigned projects and team members',
      [UserRole.creator]: 'Can create and edit their own projects',
      [UserRole.assignee]: 'Can view and update assigned projects',
      [UserRole.approver]: 'Can approve or reject projects requiring approval'
    }
    return descriptions[role]
  }

  // Calculate team stats
  const stats = {
    total: teamMembers.length,
    engineers: teamMembers.filter(m => m.role === UserRole.assignee).length,
    managers: teamMembers.filter(m => m.role === UserRole.manager).length,
    coordinators: teamMembers.filter(m => m.role === UserRole.creator).length,
    approvers: teamMembers.filter(m => m.role === UserRole.approver).length,
    eoEngineers: teamMembers.filter(m => m.role === UserRole.eo_engineer).length
  }

  // Show loading while auth is loading or fetching team members
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading team...</div>
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
                Team Management
              </h1>
              <p className="text-lg text-gray-600">
                Manage team members, roles, and permissions
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-electric">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Add a new member to your electrical operations team.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="user@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={createForm.name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={createForm.role}
                        onValueChange={(value: UserRole) => setCreateForm(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UserRole.assignee}>
                            <div className="flex items-center">
                              <User className="mr-2 h-4 w-4" />
                              Electrical Engineer
                            </div>
                          </SelectItem>
                          <SelectItem value={UserRole.creator}>
                            <div className="flex items-center">
                              <User className="mr-2 h-4 w-4" />
                              Project Coordinator
                            </div>
                          </SelectItem>
                          <SelectItem value={UserRole.manager}>
                            <div className="flex items-center">
                              <Shield className="mr-2 h-4 w-4" />
                              Project Manager
                            </div>
                          </SelectItem>
                          <SelectItem value={UserRole.approver}>
                            <div className="flex items-center">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Operations Manager
                            </div>
                          </SelectItem>
                          <SelectItem value={UserRole.eo_engineer}>
                            <div className="flex items-center">
                              <Zap className="mr-2 h-4 w-4" />
                              EO Engineer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        {getRoleDescription(createForm.role)}
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateMember} disabled={submitting}>
                      {submitting ? 'Adding...' : 'Add Member'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="corporate-card border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Total Team
              </CardTitle>
              <Users className="h-8 w-8 bg-blue-100 rounded-full p-2 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-500">Active members</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                EO Engineers
              </CardTitle>
              <Zap className="h-8 w-8 bg-purple-100 rounded-full p-2 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.eoEngineers}</div>
              <p className="text-xs text-gray-500">System admins</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Managers
              </CardTitle>
              <Shield className="h-8 w-8 bg-blue-100 rounded-full p-2 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.managers}</div>
              <p className="text-xs text-gray-500">Project oversight</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Coordinators
              </CardTitle>
              <User className="h-8 w-8 bg-green-100 rounded-full p-2 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.coordinators}</div>
              <p className="text-xs text-gray-500">Project creation</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Engineers
              </CardTitle>
              <Briefcase className="h-8 w-8 bg-orange-100 rounded-full p-2 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.engineers}</div>
              <p className="text-xs text-gray-500">Field execution</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Management Tabs */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger>
            <TabsTrigger value="activity">Team Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                      Manage your electrical operations team
                    </CardDescription>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mt-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search team members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="md:w-48">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value={UserRole.eo_engineer}>Transmission Engineer</SelectItem>
                      <SelectItem value={UserRole.manager}>Project Manager</SelectItem>
                      <SelectItem value={UserRole.creator}>Project Coordinator</SelectItem>
                      <SelectItem value={UserRole.assignee}>Electrical Engineer</SelectItem>
                      <SelectItem value={UserRole.approver}>Operations Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Member</TableHead>
                        <TableHead className="font-semibold text-gray-700">Role</TableHead>
                        <TableHead className="font-semibold text-gray-700">Projects</TableHead>
                        <TableHead className="font-semibold text-gray-700">Joined</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member, index) => (
                        <TableRow key={member.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src="" alt={member.name || member.email} />
                                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-green-500 text-white font-semibold">
                                  {(member.name || member.email)[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {member.name || 'Unnamed User'}
                                </div>
                                <div className="text-sm text-gray-500">{member.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(member.role)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center space-x-4">
                                <span className="text-gray-600">
                                  {member._count?.createdProjects || 0} created
                                </span>
                                <span className="text-gray-600">
                                  {member._count?.assignedProjects || 0} assigned
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(member.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center space-x-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteMember(member.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove Member
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

                {filteredMembers.length === 0 && (
                  <div className="text-center py-16">
                    <div className="flex flex-col items-center space-y-4">
                      <Users className="h-16 w-16 text-gray-400" />
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No team members found</h3>
                        <p className="text-gray-500">
                          {searchTerm || roleFilter !== 'all'
                            ? 'Try adjusting your search or filter criteria.'
                            : 'Get started by adding your first team member.'}
                        </p>
                      </div>
                      {!searchTerm && roleFilter === 'all' && (
                        <Button className="btn-electric" onClick={() => setCreateDialogOpen(true)}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add First Member
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="mr-2 h-5 w-5" />
                    Role Permissions
                  </CardTitle>
                  <CardDescription>
                    Understanding team member capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <Crown className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">EO Engineer</h4>
                        <p className="text-sm text-gray-600">
                          Full system access, user management, all project operations
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Project Manager</h4>
                        <p className="text-sm text-gray-600">
                          Manage assigned projects, oversee team progress, approve changes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Project Coordinator</h4>
                        <p className="text-sm text-gray-600">
                          Create and coordinate projects, manage basic project details
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <User className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Electrical Engineer</h4>
                        <p className="text-sm text-gray-600">
                          Execute assigned tasks, update project status, view project details
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Operations Manager</h4>
                        <p className="text-sm text-gray-600">
                          Approve project requests, review project performance
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    Role Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="text-sm font-medium">EO Engineers</span>
                      </div>
                      <span className="text-sm font-bold">{stats.eoEngineers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium">Project Managers</span>
                      </div>
                      <span className="text-sm font-bold">{stats.managers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Project Coordinators</span>
                      </div>
                      <span className="text-sm font-bold">{stats.coordinators}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium">Electrical Engineers</span>
                      </div>
                      <span className="text-sm font-bold">{stats.engineers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium">Operations Managers</span>
                      </div>
                      <span className="text-sm font-bold">{stats.approvers}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle>Team Activity</CardTitle>
                <CardDescription>
                  Recent team activities and project updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-16">
                  <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Activity Feed Coming Soon</h3>
                  <p className="text-gray-500">
                    Track team member activities, project updates, and system events.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function TeamPage() {
  return (
    <>
      <Navigation />
      <TeamContent />
    </>
  )
}
