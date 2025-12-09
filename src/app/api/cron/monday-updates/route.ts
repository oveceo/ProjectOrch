import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { NotificationService } from '@/lib/notifications'
import { ApprovalStatus, ProjectStatus } from '@prisma/client'

// POST /api/cron/monday-updates - Weekly Monday notifications
export async function POST(request: NextRequest) {
  try {
    // Basic auth check (in production, use proper API key validation)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get projects that need notifications
    const projectsNeedingUpdates = await getProjectsNeedingUpdates()

    if (projectsNeedingUpdates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No projects need notifications',
        notificationsSent: 0
      })
    }

    // Group by assignee
    const notificationsByAssignee = groupProjectsByAssignee(projectsNeedingUpdates)

    // Send notifications
    let totalNotifications = 0
    const results = []

    for (const [assigneeEmail, projects] of Object.entries(notificationsByAssignee)) {
      try {
        await NotificationService.sendWeeklyReminder(assigneeEmail, projects)
        totalNotifications++
        results.push({ email: assigneeEmail, status: 'sent', projectCount: projects.length })
      } catch (error) {
        console.error(`Failed to send notification to ${assigneeEmail}:`, error)
        results.push({ email: assigneeEmail, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // Check for escalation (projects not updated for N days)
    const escalationDays = parseInt(process.env.ESCALATION_DAYS || '7')
    const projectsNeedingEscalation = await getProjectsNeedingEscalation(escalationDays)

    if (projectsNeedingEscalation.length > 0) {
      await sendEscalationNotifications(projectsNeedingEscalation)
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${totalNotifications} notifications`,
      notificationsSent: totalNotifications,
      results,
      escalations: projectsNeedingEscalation.length
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to get projects needing updates
async function getProjectsNeedingUpdates() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  return await prisma.project.findMany({
    where: {
      AND: [
        {
          approvalStatus: ApprovalStatus.Approved
        },
        {
          status: {
            in: [ProjectStatus.Not_Started, ProjectStatus.In_Progress, ProjectStatus.At_Risk]
          }
        },
        {
          OR: [
            { lastUpdateAt: null },
            { lastUpdateAt: { lt: sevenDaysAgo } }
          ]
        },
        {
          assigneeEmail: { not: null }
        }
      ]
    },
    include: {
      assignee: {
        select: { name: true, email: true }
      },
      _count: {
        select: { wbsCache: true }
      }
    }
  })
}

// Helper function to group projects by assignee
function groupProjectsByAssignee(projects: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}

  for (const project of projects) {
    if (!project.assigneeEmail) continue

    if (!grouped[project.assigneeEmail]) {
      grouped[project.assigneeEmail] = []
    }

    grouped[project.assigneeEmail].push(project)
  }

  return grouped
}

// Helper function to get projects needing escalation
async function getProjectsNeedingEscalation(days: number): Promise<any[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return await prisma.project.findMany({
    where: {
      AND: [
        {
          approvalStatus: ApprovalStatus.Approved
        },
        {
          status: {
            in: [ProjectStatus.Not_Started, ProjectStatus.In_Progress, ProjectStatus.At_Risk, ProjectStatus.Blocked]
          }
        },
        {
          lastUpdateAt: { lt: cutoffDate }
        },
        {
          assigneeEmail: { not: null }
        }
      ]
    },
    include: {
      assignee: {
        select: { name: true, email: true }
      },
      approver: {
        select: { name: true, email: true }
      }
    }
  })
}

// Helper function to send escalation notifications
async function sendEscalationNotifications(projects: any[]): Promise<void> {
  // Group by approver for escalation
  const escalationByApprover: Record<string, any[]> = {}

  for (const project of projects) {
    const approverEmail = project.approverEmail || 'eo_engineer@company.com' // Fallback

    if (!escalationByApprover[approverEmail]) {
      escalationByApprover[approverEmail] = []
    }

    escalationByApprover[approverEmail].push(project)
  }

  // Send escalation notifications
  for (const [approverEmail, projects] of Object.entries(escalationByApprover)) {
    try {
      await NotificationService.sendEscalationNotification(approverEmail, projects)
    } catch (error) {
      console.error(`Failed to send escalation to ${approverEmail}:`, error)
      console.error('Escalation error:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
}
