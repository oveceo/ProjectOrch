import { z } from 'zod'
import { ProjectStatus, ApprovalStatus, UserRole } from '@prisma/client'

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

export const idSchema = z.string().cuid().or(z.string().uuid()).or(z.string().min(1))

export const dateSchema = z.union([
  z.date(),
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  z.null()
]).transform((val) => {
  if (val === null) return null
  if (val instanceof Date) return val
  return new Date(val)
})

export const currencySchema = z.string().regex(/^-?\$?[\d,]+(\.\d{0,2})?$/).or(z.string().max(0)).nullable()

// ============================================================================
// USER VALIDATION
// ============================================================================

export const userSchema = z.object({
  id: idSchema.optional(),
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.nativeEnum(UserRole).default(UserRole.assignee),
})

export const loginSchema = z.object({
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(1, 'Password is required'),
})

// ============================================================================
// PROJECT VALIDATION
// ============================================================================

export const projectStatusSchema = z.nativeEnum(ProjectStatus)
export const approvalStatusSchema = z.nativeEnum(ApprovalStatus)

export const createProjectSchema = z.object({
  projectCode: z.string().min(1, 'Project code is required').max(20),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  approverEmail: z.string().email().optional().nullable(),
  assigneeEmail: z.string().email().optional().nullable(),
  status: projectStatusSchema.default(ProjectStatus.Not_Started),
  approvalStatus: approvalStatusSchema.default(ApprovalStatus.Pending_Approval),
  requiresWbs: z.boolean().default(false),
})

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: idSchema,
})

// ============================================================================
// WBS VALIDATION
// ============================================================================

export const wbsStatusSchema = z.enum([
  'Not_Started',
  'In_Progress', 
  'Complete',
  'Approval_Pending',
  'Approved',
  'On_Hold',
  'Blocked',
  'At_Risk'
])

export const createWbsTaskSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1, 'Task name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  ownerLastName: z.string().max(100).optional().nullable(),
  approverLastName: z.string().max(100).optional().nullable(),
  status: wbsStatusSchema.default('Not_Started'),
  startDate: dateSchema.optional().nullable(),
  endDate: dateSchema.optional().nullable(),
  budget: currencySchema.optional(),
  actual: currencySchema.optional(),
  variance: currencySchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
  atRisk: z.boolean().default(false),
  orderIndex: z.number().int().min(0).default(0),
  parentRowId: z.string().optional().nullable(),
})

export const updateWbsTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  ownerLastName: z.string().max(100).optional().nullable(),
  approverLastName: z.string().max(100).optional().nullable(),
  status: wbsStatusSchema.optional(),
  startDate: dateSchema.optional().nullable(),
  endDate: dateSchema.optional().nullable(),
  budget: currencySchema.optional(),
  actual: currencySchema.optional(),
  variance: currencySchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
  atRisk: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
})

// ============================================================================
// API RESPONSE HELPERS
// ============================================================================

export interface ValidationError {
  field: string
  message: string
}

export function parseValidation<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors: ValidationError[] = result.error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))
  
  return { success: false, errors }
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(e => `${e.field}: ${e.message}`).join(', ')
}

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

export const authHeaderSchema = z.object({
  authorization: z.string().min(1, 'Authorization header is required'),
})

export function extractUserLastName(authHeader: string | null): string | null {
  if (!authHeader) return null
  const lastName = authHeader.replace('Bearer ', '').trim()
  return lastName && lastName !== 'undefined' ? lastName : null
}

// ============================================================================
// TEAM MEMBERS (for validation)
// ============================================================================

export const TEAM_MEMBERS = [
  'Adams', 'Allen', 'Barringer', 'Campbell', 'Clark', 'Donahue', 
  'Egbert', 'Elswick', 'Fields', 'Forster', 'Galloway', 'Green', 
  'Hall', 'Hicks', 'Huff', 'McCord', 'Merritt', 'Privette', 
  'Roberts', 'Southall', 'Thomas', 'Thompson', 'Waugh', 'Woodworth'
] as const

export const teamMemberSchema = z.enum(TEAM_MEMBERS).or(z.literal('none')).or(z.null())

