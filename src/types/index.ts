import { UserRole, ApprovalStatus, ProjectStatus } from '@prisma/client'

// Re-export Prisma types
export { UserRole, ApprovalStatus, ProjectStatus }

// Smartsheet types
export interface SmartsheetRow {
  id: number
  parentId?: number
  cells: SmartsheetCell[]
  expanded?: boolean
  createdAt?: string
  modifiedAt?: string
}

export interface SmartsheetCell {
  columnId: number
  value?: any
  displayValue?: string
}

export interface SmartsheetColumn {
  id: number
  title: string
  type: string
  primary?: boolean
}

export interface SmartsheetSheet {
  id: number
  name: string
  columns: SmartsheetColumn[]
  rows: SmartsheetRow[]
  permalink?: string
}

// Project types
export interface ProjectWithRelations {
  id: string
  portfolioRowId?: string | null
  projectCode: string
  title: string
  description?: string | null
  category?: string | null
  approverEmail?: string | null
  assigneeEmail?: string | null
  approvalStatus: ApprovalStatus
  status: ProjectStatus
  wbsFolderId?: string | null
  wbsSheetId?: string | null
  wbsSheetUrl?: string | null
  wbsAppUrl?: string | null
  requiresWbs: boolean
  budget?: string | null
  actual?: string | null
  variance?: string | null
  startDate?: Date | null
  endDate?: Date | null
  atRisk?: boolean | null
  lastUpdateAt?: Date | null
  createdAt: Date
  updatedAt: Date
  creator?: {
    id: string
    email: string
    name?: string | null
  } | null
  assignee?: {
    id: string
    email: string
    name?: string | null
  } | null
  approver?: {
    id: string
    email: string
    name?: string | null
  } | null
  _count?: {
    wbsCache: number
  }
}

// WBS types
export interface WbsItem {
  id: string
  projectId: string
  smartsheetRowId?: string | null
  parentRowId?: string | null
  name: string
  description?: string | null
  ownerEmail?: string | null
  ownerLastName?: string | null
  approverLastName?: string | null
  status: ProjectStatus
  startDate?: Date | null
  endDate?: Date | null
  atRisk: boolean
  budget?: string | null
  actual?: string | null
  variance?: string | null
  notes?: string | null
  skipWbs: boolean
  orderIndex: number
  lastSyncedAt: Date
  children?: WbsItem[]
  project: {
    id: string
    projectCode: string
    title: string
    status: ProjectStatus
    category?: string | null
  }
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Auth types
export interface AuthUser {
  id: string
  email: string
  name?: string | null
  role: UserRole
}

// Notification types
export interface NotificationData {
  to: string
  subject: string
  html: string
  text?: string
}

// Audit types
export interface AuditEntry {
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  payload?: any
}
