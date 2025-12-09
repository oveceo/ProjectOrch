import { NextRequest, NextResponse } from 'next/server'
import { SmartsheetAPI } from '@/lib/smartsheet'
import { prisma } from '@/lib/db'
import { createWbsSheetFromTemplate } from '@/lib/smartsheet-wbs-template'

// Create the Smartsheet client directly for folder/sheet creation
const smartsheet = require('smartsheet')
const client = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN || '',
  logLevel: 'info'
})

interface CreateWbsProjectRequest {
  projectCode: string
  projectTitle: string
  description?: string
  createdBy: string
}

export async function POST(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    const userLastName = authHeader.replace('Bearer ', '')
    if (!userLastName || userLastName === 'undefined') {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      )
    }

    const { projectCode, projectTitle, description } = await request.json() as CreateWbsProjectRequest

    // Auto-generate project code if not provided or empty
    let finalProjectCode = projectCode
    if (!projectCode || projectCode.trim() === '') {
      finalProjectCode = await generateNextProjectCode()
    }

    // Validate input
    if (!finalProjectCode || !projectTitle) {
      return NextResponse.json(
        { error: 'Project code and title are required' },
        { status: 400 }
      )
    }

    // Validate project code format (P-#### or similar)
    const projectCodePattern = /^[A-Z]+-\d+$/
    if (!projectCodePattern.test(finalProjectCode)) {
      return NextResponse.json(
        { error: 'Project code must be in format like P-0001, P-0010, etc.' },
        { status: 400 }
      )
    }

    // Check if project already exists
    const existingProject = await prisma.project.findUnique({
      where: { projectCode: finalProjectCode }
    })

    if (existingProject) {
      return NextResponse.json(
        { error: `Project ${finalProjectCode} already exists` },
        { status: 409 }
      )
    }

    console.log(`Creating new WBS project: ${finalProjectCode} - ${projectTitle}`)

    // Step 1: Create the project in our database
    const project = await prisma.project.create({
      data: {
        projectCode: finalProjectCode,
        title: projectTitle,
        description: description || `WBS project for ${finalProjectCode}`,
        status: 'Not_Started',
        category: 'WBS',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`✅ Created database project: ${finalProjectCode}`)

    // Step 2: Create Smartsheet structure
    const smartsheetResult = await createSmartsheetWbsStructure(finalProjectCode, projectTitle, userLastName)

    if (!smartsheetResult.success) {
      // Rollback database project if Smartsheet creation fails
      await prisma.project.delete({
        where: { id: project.id }
      })
      
      return NextResponse.json(
        { error: `Failed to create Smartsheet structure: ${smartsheetResult.error}` },
        { status: 500 }
      )
    }

    console.log(`✅ Created Smartsheet structure for ${projectCode}`)

    return NextResponse.json({
      success: true,
      message: `Successfully created WBS project ${projectCode}`,
      project: {
        id: project.id,
        projectCode: project.projectCode,
        title: project.title,
        description: project.description,
        smartsheet: smartsheetResult.data
      }
    })

  } catch (error) {
    console.error('Error creating WBS project:', error)
    return NextResponse.json(
      { error: 'Internal server error during project creation' },
      { status: 500 }
    )
  }
}

/**
 * Create the complete Smartsheet WBS structure:
 * 1. Create WBS (#P-XXXX) folder
 * 2. Create Work Breakdown Schedule sheet with template
 * 3. Set up proper permissions and sharing
 */
async function createSmartsheetWbsStructure(projectCode: string, projectTitle: string, createdBy: string) {
  try {
    if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
      throw new Error('Smartsheet access token not configured')
    }

    // Get the "Work Breakdown Schedules" parent folder ID
    const WORK_BREAKDOWN_SCHEDULES_FOLDER_ID = 4414766191011716 // From your structure

    // Step 1: Create the project folder (e.g., "WBS (#P-0015)")
    const folderName = `WBS (#${projectCode})`
    
    const folderResponse = await client.folders.createFolder({
      body: {
        name: folderName
      },
      folderId: WORK_BREAKDOWN_SCHEDULES_FOLDER_ID
    })

    const projectFolderId = folderResponse.result.id
    console.log(`Created folder: ${folderName} (ID: ${projectFolderId})`)

    // Step 2: Create the WBS sheet using template system
    const wbsResult = await createWbsSheetFromTemplate(
      projectCode, 
      projectTitle, 
      projectFolderId
    )

    if (!wbsResult.success) {
      console.warn(`Could not create WBS sheet: ${wbsResult.error}`)
      // Continue anyway - user can create manually
    }

    console.log(`✅ Created WBS project structure for ${projectCode}`)

    return {
      success: true,
      data: {
        folderId: projectFolderId,
        folderName: folderName,
        wbsSheet: wbsResult.success ? {
          sheetId: wbsResult.sheetId,
          sheetName: wbsResult.sheetName
        } : null,
        message: wbsResult.success 
          ? 'WBS project created with folder and template sheet!'
          : 'WBS folder created. You can manually add a Work Breakdown Schedule sheet.'
      }
    }

  } catch (error) {
    console.error('Error creating Smartsheet WBS structure:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate the next project code based on the last project created
 * Format: P-XXXX (e.g., P-0001, P-0015, P-0123, etc.)
 */
async function generateNextProjectCode(): Promise<string> {
  try {
    // Get the highest project code from existing projects
    const highestProject = await prisma.project.findFirst({
      where: {
        projectCode: {
          startsWith: 'P-'
        }
      },
      orderBy: {
        projectCode: 'desc'
      }
    })

    if (!highestProject) {
      // No existing projects, start with P-0001
      return 'P-0001'
    }

    // Extract the number from the project code (e.g., "P-0015" -> 15)
    const match = highestProject.projectCode.match(/^P-(\d+)$/)
    if (!match) {
      // If format doesn't match, start fresh
      return 'P-0001'
    }

    const currentNumber = parseInt(match[1], 10)
    const nextNumber = currentNumber + 1

    // Format with leading zeros (4 digits)
    return `P-${nextNumber.toString().padStart(4, '0')}`
  } catch (error) {
    console.error('Error generating next project code:', error)
    // Fallback to a simple timestamp-based code
    const timestamp = Date.now().toString().slice(-4)
    return `P-${timestamp}`
  }
}

// Simplified version - folder creation only for now
