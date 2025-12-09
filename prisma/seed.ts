import { PrismaClient, UserRole, ApprovalStatus, ProjectStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create demo users
  const users = [
    {
      email: 'admin@demo.com',
      name: 'Demo Admin',
      role: UserRole.eo_engineer
    },
    {
      email: 'manager@demo.com',
      name: 'Demo Manager',
      role: UserRole.manager
    },
    {
      email: 'assignee@demo.com',
      name: 'Demo Assignee',
      role: UserRole.assignee
    },
    {
      email: 'approver@demo.com',
      name: 'Demo Approver',
      role: UserRole.approver
    },
    {
      email: 'creator@demo.com',
      name: 'Demo Creator',
      role: UserRole.creator
    }
  ]

  console.log('Creating users...')
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: userData,
      create: userData
    })
    console.log(`✓ Created user: ${user.email} (${user.role})`)
  }

  // Get created users for reference
  const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.com' } })
  const manager = await prisma.user.findUnique({ where: { email: 'manager@demo.com' } })
  const assignee = await prisma.user.findUnique({ where: { email: 'assignee@demo.com' } })
  const approver = await prisma.user.findUnique({ where: { email: 'approver@demo.com' } })
  const creator = await prisma.user.findUnique({ where: { email: 'creator@demo.com' } })

  // Create demo projects
  const projects = [
    {
      projectCode: 'P-001',
      title: 'Website Redesign',
      description: 'Complete overhaul of company website with modern design and improved UX',
      category: 'Digital',
      approverEmail: approver?.email,
      assigneeEmail: assignee?.email,
      approvalStatus: ApprovalStatus.Approved,
      status: ProjectStatus.In_Progress,
      requiresWbs: true,
      createdById: creator?.id
    },
    {
      projectCode: 'P-002',
      title: 'Mobile App Development',
      description: 'Native mobile application for iOS and Android platforms',
      category: 'Technology',
      approverEmail: approver?.email,
      assigneeEmail: assignee?.email,
      approvalStatus: ApprovalStatus.Approved,
      status: ProjectStatus.Not_Started,
      requiresWbs: true,
      createdById: creator?.id
    },
    {
      projectCode: 'P-003',
      title: 'Office Relocation',
      description: 'Moving to new office space and setting up infrastructure',
      category: 'Operations',
      approverEmail: approver?.email,
      assigneeEmail: manager?.email,
      approvalStatus: ApprovalStatus.Pending_Approval,
      status: ProjectStatus.Not_Started,
      requiresWbs: false,
      createdById: admin?.id
    },
    {
      projectCode: 'P-004',
      title: 'Customer Portal Enhancement',
      description: 'Adding new features and improving security of customer portal',
      category: 'Digital',
      approverEmail: approver?.email,
      assigneeEmail: assignee?.email,
      approvalStatus: ApprovalStatus.Approved,
      status: ProjectStatus.At_Risk,
      requiresWbs: true,
      createdById: creator?.id
    },
    {
      projectCode: 'P-005',
      title: 'Compliance Audit Preparation',
      description: 'Preparing documentation and processes for annual compliance audit',
      category: 'Compliance',
      approverEmail: approver?.email,
      assigneeEmail: manager?.email,
      approvalStatus: ApprovalStatus.Approved,
      status: ProjectStatus.Complete,
      requiresWbs: false,
      createdById: admin?.id
    }
  ]

  console.log('Creating projects...')
  for (const projectData of projects) {
    const project = await prisma.project.upsert({
      where: { projectCode: projectData.projectCode },
      update: projectData,
      create: projectData
    })
    console.log(`✓ Created project: ${project.projectCode} - ${project.title}`)
  }

  // Create WBS items for projects that require them
  const wbsItems = [
    // P-001 WBS
    {
      projectId: (await prisma.project.findUnique({ where: { projectCode: 'P-001' } }))!.id,
      name: 'Project Planning',
      description: 'Initial project planning and requirements gathering',
      ownerEmail: assignee?.email,
      status: ProjectStatus.Complete,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-02-15'),
      atRisk: false,
      budget: '5000',
      actual: '4800',
      variance: '200',
      orderIndex: 1
    },
    {
      projectId: (await prisma.project.findUnique({ where: { projectCode: 'P-001' } }))!.id,
      name: 'Design Phase',
      description: 'UI/UX design and mockups',
      ownerEmail: assignee?.email,
      status: ProjectStatus.In_Progress,
      startDate: new Date('2024-02-16'),
      endDate: new Date('2024-03-31'),
      atRisk: false,
      budget: '15000',
      actual: '12000',
      variance: '3000',
      orderIndex: 2
    },
    {
      projectId: (await prisma.project.findUnique({ where: { projectCode: 'P-001' } }))!.id,
      name: 'Development',
      description: 'Frontend and backend development',
      ownerEmail: assignee?.email,
      status: ProjectStatus.In_Progress,
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-05-31'),
      atRisk: false,
      budget: '25000',
      actual: '15000',
      variance: '10000',
      orderIndex: 3
    },
    // P-002 WBS
    {
      projectId: (await prisma.project.findUnique({ where: { projectCode: 'P-002' } }))!.id,
      name: 'Requirements Analysis',
      description: 'Gather and analyze mobile app requirements',
      ownerEmail: assignee?.email,
      status: ProjectStatus.Not_Started,
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-03-31'),
      atRisk: false,
      budget: '10000',
      actual: '0',
      variance: '10000',
      orderIndex: 1
    },
    // P-004 WBS (At Risk)
    {
      projectId: (await prisma.project.findUnique({ where: { projectCode: 'P-004' } }))!.id,
      name: 'Security Audit',
      description: 'Security assessment and vulnerability testing',
      ownerEmail: assignee?.email,
      status: ProjectStatus.Blocked,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-28'),
      atRisk: true,
      budget: '8000',
      actual: '7500',
      variance: '500',
      orderIndex: 1
    },
    {
      projectId: (await prisma.project.findUnique({ where: { projectCode: 'P-004' } }))!.id,
      name: 'Feature Implementation',
      description: 'Implement new portal features',
      ownerEmail: assignee?.email,
      status: ProjectStatus.At_Risk,
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-04-15'),
      atRisk: true,
      budget: '18000',
      actual: '16000',
      variance: '2000',
      orderIndex: 2
    }
  ]

  console.log('Creating WBS items...')
  for (const wbsData of wbsItems) {
    const wbs = await prisma.wbsCache.create({
      data: wbsData
    })
    console.log(`✓ Created WBS item: ${wbs.name} for project ${wbsData.projectId}`)
  }

  // Create some audit entries
  console.log('Creating audit entries...')
  const auditEntries = [
    {
      actorEmail: admin?.email || 'admin@demo.com',
      action: 'CREATE_PROJECT',
      targetType: 'Project',
      targetId: (await prisma.project.findUnique({ where: { projectCode: 'P-001' } }))!.id,
      payload: { projectCode: 'P-001', action: 'Initial project creation' }
    },
    {
      actorEmail: assignee?.email || 'assignee@demo.com',
      action: 'UPDATE_WBS_ITEM',
      targetType: 'WbsCache',
      targetId: (await prisma.wbsCache.findFirst({ where: { name: 'Project Planning' } }))!.id,
      payload: { status: 'Complete', action: 'Marked planning phase as complete' }
    }
  ]

  for (const auditData of auditEntries) {
    await prisma.audit.create({
      data: auditData
    })
  }

  console.log('✅ Database seeding completed successfully!')
  console.log('')
  console.log('Demo accounts created:')
  console.log('  Admin: admin@demo.com / admin123 (EO Engineer)')
  console.log('  Manager: manager@demo.com / manager123 (Manager)')
  console.log('  Assignee: assignee@demo.com / assignee123 (Assignee)')
  console.log('  Approver: approver@demo.com / approver123 (Approver)')
  console.log('  Creator: creator@demo.com / creator123 (Creator)')
  console.log('')
  console.log('You can now start the development server and log in with these credentials.')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
