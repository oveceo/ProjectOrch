import nodemailer from 'nodemailer'
import { Client } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials'
import { ClientSecretCredential } from '@azure/identity'

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// Microsoft Graph client for Teams
let graphClient: Client | null = null

function getGraphClient(): Client {
  if (!graphClient && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET) {
    const credential = new ClientSecretCredential(
      process.env.GRAPH_TENANT_ID!,
      process.env.GRAPH_CLIENT_ID!,
      process.env.GRAPH_CLIENT_SECRET!
    )

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    })

    graphClient = Client.initWithMiddleware({
      authProvider
    })
  }

  return graphClient!
}

export class NotificationService {
  // Send weekly reminder email
  static async sendWeeklyReminder(assigneeEmail: string, projects: any[]): Promise<void> {
    const subject = `EO Project Updates - ${projects.length} projects need attention`
    const html = this.generateWeeklyReminderHtml(assigneeEmail, projects)
    const text = this.generateWeeklyReminderText(assigneeEmail, projects)

    await this.sendEmail(assigneeEmail, subject, html, text)

    // Also send Teams message if configured
    if (process.env.TEAMS_WEBHOOK_URL) {
      await this.sendTeamsMessage(assigneeEmail, projects)
    }
  }

  // Send escalation notification
  static async sendEscalationNotification(approverEmail: string, projects: any[]): Promise<void> {
    const subject = `🚨 EO Project Escalation - ${projects.length} projects overdue`
    const html = this.generateEscalationHtml(approverEmail, projects)
    const text = this.generateEscalationText(approverEmail, projects)

    await this.sendEmail(approverEmail, subject, html, text)

    // Send Teams message for escalations
    if (process.env.TEAMS_WEBHOOK_URL) {
      await this.sendTeamsEscalation(approverEmail, projects)
    }
  }

  // Send email
  private static async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!process.env.SMTP_HOST) {
      console.warn('SMTP not configured, skipping email notification')
      return
    }

    try {
      await emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@eo-orchestrator.com',
        to,
        subject,
        html,
        text
      })
    } catch (error) {
      console.error('Failed to send email:', error)
      throw error
    }
  }

  // Send Teams message via webhook
  private static async sendTeamsMessage(assigneeEmail: string, projects: any[]): Promise<void> {
    if (!process.env.TEAMS_WEBHOOK_URL) return

    try {
      const message = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": `Weekly project reminder for ${assigneeEmail}`,
        "sections": [{
          "activityTitle": "📋 Weekly Project Reminder",
          "activitySubtitle": `Projects needing attention for ${assigneeEmail}`,
          "facts": projects.map(project => ({
            "name": `${project.projectCode}: ${project.title}`,
            "value": `Status: ${project.status} | Last updated: ${project.lastUpdateAt || 'Never'}`
          })),
          "markdown": true
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "View Projects",
          "targets": [{
            "os": "default",
            "uri": `${process.env.APP_BASE_URL}/projects`
          }]
        }]
      }

      const response = await fetch(process.env.TEAMS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        throw new Error(`Teams webhook failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send Teams message:', error)
      // Don't throw - Teams failure shouldn't break the flow
    }
  }

  // Send Teams escalation
  private static async sendTeamsEscalation(approverEmail: string, projects: any[]): Promise<void> {
    if (!process.env.TEAMS_WEBHOOK_URL) return

    try {
      const message = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF0000",
        "summary": `Project escalation for ${approverEmail}`,
        "sections": [{
          "activityTitle": "🚨 Project Escalation Required",
          "activitySubtitle": `Overdue projects requiring attention`,
          "facts": projects.map(project => ({
            "name": `${project.projectCode}: ${project.title}`,
            "value": `Assignee: ${project.assignee?.name || project.assigneeEmail} | Last updated: ${project.lastUpdateAt || 'Never'}`
          })),
          "markdown": true
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "Review Projects",
          "targets": [{
            "os": "default",
            "uri": `${process.env.APP_BASE_URL}/projects`
          }]
        }]
      }

      const response = await fetch(process.env.TEAMS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        throw new Error(`Teams webhook failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send Teams escalation:', error)
    }
  }

  // Generate weekly reminder HTML
  private static generateWeeklyReminderHtml(assigneeEmail: string, projects: any[]): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Weekly Project Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0076D7;">Weekly Project Reminder</h2>
            <p>Hello,</p>
            <p>You have ${projects.length} project(s) that need your attention:</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              ${projects.map(project => `
                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #ddd;">
                  <h3 style="margin: 0; color: #0076D7;">${project.projectCode}: ${project.title}</h3>
                  <p style="margin: 5px 0;"><strong>Status:</strong> ${project.status}</p>
                  <p style="margin: 5px 0;"><strong>Last Updated:</strong> ${project.lastUpdateAt ? new Date(project.lastUpdateAt).toLocaleDateString() : 'Never'}</p>
                  <p style="margin: 5px 0;"><strong>Description:</strong> ${project.description || 'No description'}</p>
                  ${project.wbsSheetUrl ? `<p style="margin: 5px 0;"><a href="${project.wbsSheetUrl}" style="color: #0076D7;">View Work Breakdown Schedule</a></p>` : ''}
                  ${project.wbsAppUrl ? `<p style="margin: 5px 0;"><a href="${project.wbsAppUrl}" style="color: #0076D7;">Edit WBS in App</a></p>` : ''}
                </div>
              `).join('')}
            </div>

            <p>Please update these projects or let us know if you need assistance.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_BASE_URL}/projects" style="background-color: #0076D7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View All Projects</a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              This is an automated reminder from the EO Project Orchestrator.
              If you have any questions, please contact your project manager.
            </p>
          </div>
        </body>
      </html>
    `
  }

  // Generate weekly reminder text
  private static generateWeeklyReminderText(assigneeEmail: string, projects: any[]): string {
    return `
Weekly Project Reminder

Hello,

You have ${projects.length} project(s) that need your attention:

${projects.map(project => `
${project.projectCode}: ${project.title}
Status: ${project.status}
Last Updated: ${project.lastUpdateAt ? new Date(project.lastUpdateAt).toLocaleDateString() : 'Never'}
Description: ${project.description || 'No description'}
${project.wbsAppUrl ? `Edit WBS: ${project.wbsAppUrl}` : ''}
`).join('\n')}

Please update these projects or let us know if you need assistance.

View all projects: ${process.env.APP_BASE_URL}/projects

---
This is an automated reminder from the EO Project Orchestrator.
    `.trim()
  }

  // Generate escalation HTML
  private static generateEscalationHtml(approverEmail: string, projects: any[]): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Project Escalation Required</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #FF0000;">🚨 Project Escalation Required</h2>
            <p>Hello,</p>
            <p>The following ${projects.length} project(s) have not been updated recently and require your attention:</p>

            <div style="background-color: #FFF5F5; border: 2px solid #FF0000; padding: 15px; border-radius: 5px; margin: 20px 0;">
              ${projects.map(project => `
                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #FFAAAA;">
                  <h3 style="margin: 0; color: #FF0000;">${project.projectCode}: ${project.title}</h3>
                  <p style="margin: 5px 0;"><strong>Assignee:</strong> ${project.assignee?.name || project.assigneeEmail}</p>
                  <p style="margin: 5px 0;"><strong>Status:</strong> ${project.status}</p>
                  <p style="margin: 5px 0;"><strong>Last Updated:</strong> ${project.lastUpdateAt ? new Date(project.lastUpdateAt).toLocaleDateString() : 'Never'}</p>
                  <p style="margin: 5px 0;"><strong>Description:</strong> ${project.description || 'No description'}</p>
                  ${project.wbsSheetUrl ? `<p style="margin: 5px 0;"><a href="${project.wbsSheetUrl}" style="color: #FF0000;">View Work Breakdown Schedule</a></p>` : ''}
                  ${project.wbsAppUrl ? `<p style="margin: 5px 0;"><a href="${project.wbsAppUrl}" style="color: #FF0000;">Edit WBS in App</a></p>` : ''}
                </div>
              `).join('')}
            </div>

            <p>Please review these projects and take appropriate action.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_BASE_URL}/projects" style="background-color: #FF0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Projects</a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              This is an automated escalation from the EO Project Orchestrator.
              Immediate attention is required.
            </p>
          </div>
        </body>
      </html>
    `
  }

  // Generate escalation text
  private static generateEscalationText(approverEmail: string, projects: any[]): string {
    return `
🚨 PROJECT ESCALATION REQUIRED

Hello,

The following ${projects.length} project(s) have not been updated recently and require your attention:

${projects.map(project => `
${project.projectCode}: ${project.title}
Assignee: ${project.assignee?.name || project.assigneeEmail}
Status: ${project.status}
Last Updated: ${project.lastUpdateAt ? new Date(project.lastUpdateAt).toLocaleDateString() : 'Never'}
Description: ${project.description || 'No description'}
${project.wbsAppUrl ? `Edit WBS: ${project.wbsAppUrl}` : ''}
`).join('\n')}

Please review these projects and take appropriate action.

Review all projects: ${process.env.APP_BASE_URL}/projects

---
This is an automated escalation from the EO Project Orchestrator.
Immediate attention is required.
    `.trim()
  }
}
