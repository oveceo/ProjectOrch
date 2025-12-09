'use client'

import { useState, useEffect } from 'react'
import { redirect } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  FolderOpen,
  DollarSign,
  Target,
  Download,
  Filter,
  PieChart,
  Activity,
  Zap,
  Briefcase
} from 'lucide-react'
import { ProjectWithRelations, ApiResponse } from '@/types'
import { ProjectStatus, ApprovalStatus } from '@prisma/client'

interface ReportData {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  overdueProjects: number
  projectsByStatus: { status: string; count: number; percentage: number }[]
  projectsByCategory: { category: string; count: number; percentage: number }[]
  monthlyTrends: { month: string; created: number; completed: number }[]
  teamPerformance: { member: string; projects: number; completion: number; efficiency: number }[]
  budgetAnalysis: { category: string; budget: number; actual: number; variance: number }[]
}

function ReportsContent() {
  const { user, isLoading } = useAuth()
  const [projects, setProjects] = useState<ProjectWithRelations[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      redirect('/auth/simple')
    }
  }, [user, isLoading])

  // Fetch projects and generate reports
  useEffect(() => {
    if (user) {
      fetchProjects()
    }
  }, [user])

  // Generate report data when projects change
  useEffect(() => {
    if (projects.length > 0) {
      generateReportData()
    }
  }, [projects, timeRange, selectedCategory])

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

  const generateReportData = () => {
    const filteredProjects = projects.filter(project => {
      if (selectedCategory !== 'all' && project.category !== selectedCategory) {
        return false
      }
      return true
    })

    // Calculate basic metrics
    const totalProjects = filteredProjects.length
    const activeProjects = filteredProjects.filter(p => p.status === ProjectStatus.In_Progress).length
    const completedProjects = filteredProjects.filter(p => p.status === ProjectStatus.Complete).length
    const overdueProjects = filteredProjects.filter(p => {
      if (!p.endDate || p.status === ProjectStatus.Complete) return false
      return new Date(p.endDate) < new Date()
    }).length

    // Projects by status
    const statusCounts = filteredProjects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const projectsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status: status.replace('_', ' '),
      count,
      percentage: Math.round((count / totalProjects) * 100)
    }))

    // Projects by category
    const categoryCounts = filteredProjects.reduce((acc, project) => {
      const category = project.category || 'Uncategorized'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const projectsByCategory = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / totalProjects) * 100)
    }))

    // Monthly trends (mock data for now)
    const monthlyTrends = [
      { month: 'Jan', created: 5, completed: 3 },
      { month: 'Feb', created: 8, completed: 6 },
      { month: 'Mar', created: 12, completed: 9 },
      { month: 'Apr', created: 7, completed: 11 },
      { month: 'May', created: 15, completed: 8 },
      { month: 'Jun', created: 10, completed: 12 }
    ]

    // Team performance (mock data)
    const teamPerformance = [
      { member: 'John Doe', projects: 8, completion: 75, efficiency: 85 },
      { member: 'Jane Smith', projects: 12, completion: 92, efficiency: 88 },
      { member: 'Mike Johnson', projects: 6, completion: 67, efficiency: 72 },
      { member: 'Sarah Wilson', projects: 9, completion: 89, efficiency: 94 },
      { member: 'Tom Brown', projects: 4, completion: 50, efficiency: 65 }
    ]

    // Budget analysis (mock data)
    const budgetAnalysis = [
      { category: 'Electrical', budget: 150000, actual: 142000, variance: 8000 },
      { category: 'Infrastructure', budget: 200000, actual: 195000, variance: 5000 },
      { category: 'Maintenance', budget: 75000, actual: 82000, variance: -7000 },
      { category: 'Safety', budget: 50000, actual: 45000, variance: 5000 }
    ]

    setReportData({
      totalProjects,
      activeProjects,
      completedProjects,
      overdueProjects,
      projectsByStatus,
      projectsByCategory,
      monthlyTrends,
      teamPerformance,
      budgetAnalysis
    })
  }

  const exportReport = () => {
    // Mock export functionality
    const data = {
      generatedAt: new Date().toISOString(),
      timeRange: `${timeRange} days`,
      category: selectedCategory,
      ...reportData
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Show loading while auth is loading or fetching data
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading reports...</div>
      </div>
    )
  }

  // Don't render anything if not authenticated
  if (!user) {
    return null
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Data Available</h2>
          <p className="text-gray-600">Unable to generate reports. Please check your data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Project Reports & Analytics
              </h1>
              <p className="text-lg text-gray-600">
                Comprehensive insights into project performance and team productivity
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Safety">Safety</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportReport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="corporate-card border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Total Projects
              </CardTitle>
              <FolderOpen className="h-8 w-8 bg-blue-100 rounded-full p-2 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{reportData.totalProjects}</div>
              <p className="text-xs text-gray-500">Active projects tracked</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Active Projects
              </CardTitle>
              <Clock className="h-8 w-8 bg-green-100 rounded-full p-2 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{reportData.activeProjects}</div>
              <p className="text-xs text-gray-500">Currently in progress</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Completion Rate
              </CardTitle>
              <CheckCircle className="h-8 w-8 bg-purple-100 rounded-full p-2 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {reportData.totalProjects > 0 ? Math.round((reportData.completedProjects / reportData.totalProjects) * 100) : 0}%
              </div>
              <p className="text-xs text-gray-500">{reportData.completedProjects} completed</p>
            </CardContent>
          </Card>

          <Card className="corporate-card border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Overdue Projects
              </CardTitle>
              <AlertTriangle className="h-8 w-8 bg-red-100 rounded-full p-2 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{reportData.overdueProjects}</div>
              <p className="text-xs text-gray-500">Require immediate attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="team">Team Performance</TabsTrigger>
            <TabsTrigger value="budget">Budget Analysis</TabsTrigger>
            <TabsTrigger value="details">Detailed Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Project Status Distribution */}
              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <PieChart className="mr-2 h-5 w-5" />
                    Project Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.projectsByStatus.map((item, index) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            index === 0 ? 'bg-blue-500' :
                            index === 1 ? 'bg-green-500' :
                            index === 2 ? 'bg-orange-500' :
                            index === 3 ? 'bg-red-500' : 'bg-gray-500'
                          }`}></div>
                          <span className="text-sm font-medium">{item.status}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold">{item.count}</span>
                          <span className="text-xs text-gray-500 ml-2">({item.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Category Distribution */}
              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Projects by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reportData.projectsByCategory.map((item, index) => (
                      <div key={item.category} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.category}</span>
                          <span>{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              index === 0 ? 'bg-blue-500' :
                              index === 1 ? 'bg-green-500' :
                              index === 2 ? 'bg-orange-500' :
                              index === 3 ? 'bg-red-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Monthly Project Trends
                </CardTitle>
                <CardDescription>
                  Project creation vs completion over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.monthlyTrends.map((month, index) => (
                    <div key={month.month} className="grid grid-cols-4 gap-4 items-center">
                      <div className="text-sm font-medium">{month.month}</div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{month.created}</div>
                        <div className="text-xs text-gray-500">Created</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{month.completed}</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${month.created > month.completed ? 'text-red-600' : 'text-green-600'}`}>
                          {month.created - month.completed > 0 ? '+' : ''}{month.created - month.completed}
                        </div>
                        <div className="text-xs text-gray-500">Net Change</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Team Performance Metrics
                </CardTitle>
                <CardDescription>
                  Individual team member productivity and efficiency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Team Member</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">Projects</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">Completion Rate</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">Efficiency</TableHead>
                        <TableHead className="font-semibold text-gray-700 text-center">Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.teamPerformance.map((member, index) => (
                        <TableRow key={member.member} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                          <TableCell className="font-medium">{member.member}</TableCell>
                          <TableCell className="text-center">{member.projects}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${member.completion >= 80 ? 'text-green-600' : member.completion >= 60 ? 'text-orange-600' : 'text-red-600'}`}>
                              {member.completion}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${member.efficiency >= 80 ? 'text-green-600' : member.efficiency >= 60 ? 'text-orange-600' : 'text-red-600'}`}>
                              {member.efficiency}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              member.completion >= 80 && member.efficiency >= 80 ? 'bg-green-100 text-green-800' :
                              member.completion >= 60 && member.efficiency >= 60 ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {member.completion >= 80 && member.efficiency >= 80 ? 'Excellent' :
                               member.completion >= 60 && member.efficiency >= 60 ? 'Good' : 'Needs Improvement'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budget" className="space-y-6">
            <Card className="corporate-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Budget Analysis
                </CardTitle>
                <CardDescription>
                  Budget vs actual spending by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {reportData.budgetAnalysis.map((item, index) => (
                    <div key={item.category} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{item.category}</h4>
                        <Badge className={item.variance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {item.variance >= 0 ? 'Under Budget' : 'Over Budget'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Budget</div>
                          <div className="font-bold text-lg">${item.budget.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Actual</div>
                          <div className="font-bold text-lg">${item.actual.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Variance</div>
                          <div className={`font-bold text-lg ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.variance >= 0 ? '+' : ''}${Math.abs(item.variance).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>0%</span>
                          <span>Budget Utilization: {Math.round((item.actual / item.budget) * 100)}%</span>
                          <span>100%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.actual <= item.budget ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min((item.actual / item.budget) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    Recent Project Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Activity Feed</h3>
                    <p className="text-gray-500">
                      Detailed project activity and audit trail coming soon.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="corporate-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="mr-2 h-5 w-5" />
                    Performance Indicators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">On-Time Delivery</span>
                      <span className="text-sm font-bold text-green-600">
                        {Math.round((reportData.completedProjects / Math.max(reportData.totalProjects, 1)) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Budget Adherence</span>
                      <span className="text-sm font-bold text-orange-600">87%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Quality Score</span>
                      <span className="text-sm font-bold text-blue-600">92%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Team Satisfaction</span>
                      <span className="text-sm font-bold text-purple-600">88%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <>
      <Navigation />
      <ReportsContent />
    </>
  )
}
