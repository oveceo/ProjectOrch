# Smartsheet Integration Setup Guide

## 📊 How the System Works

### Data Flow Overview
```
Smartsheet → Database → Application → Smartsheet
    ↓           ↓            ↓           ↑
  Import    Store Data   User Edits   Export Changes
```

### Current Status
- ✅ **Database**: Ready with proper schema
- ✅ **API Endpoints**: Working (returning 200 status codes)
- ❌ **Smartsheet Data**: Not imported yet (that's why you see no tasks)
- ❌ **Smartsheet Connection**: Needs configuration

## 🔧 Step 1: Get Smartsheet Access Token

1. Go to your Smartsheet account
2. Click on **Account** (top right) → **Personal Settings**
3. Go to **API Access** tab
4. Click **Generate new access token**
5. Give it a name like "EO Project Orchestrator"
6. Copy the token (you won't see it again!)

## 🔧 Step 2: Get Your Workspace ID

From your screenshots, you have:
- **EO Project Tracking** (main workspace) 
- **Work Breakdown Schedules** (folder inside workspace)
- **WBS (#P-0010)** (individual sheets inside folder)

### Get Workspace ID:
1. Go to your **EO Project Tracking** workspace in Smartsheet
2. Look at the URL: `https://app.smartsheet.com/workspaces/WORKSPACE_ID_HERE`
3. Copy the long number after `/workspaces/`

**The system will automatically discover ALL WBS sheets in your workspace!**
- Finds sheets like "WBS (#P-0010)", "WBS (P-0011)", etc.
- Searches through all folders (like "Work Breakdown Schedules")
- Syncs all discovered WBS sheets at once

## 🔧 Step 3: Configure Environment Variables

Update your `.env.local` file:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5500/eo_proj"

# Smartsheet Configuration
SMARTSHEET_ACCESS_TOKEN="YOUR_ACCESS_TOKEN_FROM_STEP_1"

# Next.js Configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3005"
```

## 🔧 Step 4: Column Mapping

Based on your actual Smartsheet structure, the system expects these columns:

### WBS Sheet Columns:
- **Name** → Task/Project name (e.g., "P-0010", "VoIP Phone Replacement")
- **Description** → Task description  
- **Assigned To** → Last name only (e.g., "Forster", "Adams") - Person doing the work
- **Approver** → Last name only (e.g., "Privette", "Campbell") - Person who approves
- **Status** → In Progress, Complete, Not Started, Approved, etc.
- **Start Date** → Task start date
- **End Date** → Task end date
- **Budget** → Budget amount (e.g., "$90,220.00")
- **Actual** → Actual cost spent
- **Variance** → Budget variance
- **Notes** → Task notes
- **At Risk** → Yes/No or true/false

### Intelligent Project Code Extraction:
The system automatically detects project codes from task names using patterns like:
- **P-0010** (direct project code)
- **WBS (#P-0010)** (project code in parentheses)
- **VoIP Phone Replacement** (inherits from parent row "P-0010")

### Projects Sheet Columns:
- **Project Code** → Unique project ID
- **Project Name** → Project title
- **Description** → Project description
- **Category** → Project category
- **Status** → Project status
- **Budget** → Project budget
- **Start Date** → Project start
- **End Date** → Project end

## 🚀 Step 4: Import Your Data

1. **Login as any admin user** (Forster, Clark, Huff, Woodworth, Privette, Adams, Allen)
2. **Go to Settings** → **System tab**
3. **Enable Smartsheet Integration** toggle
4. **Enter your API token** from Step 1
5. **Enter your Workspace ID** from Step 2  
6. **Click "Sync from Smartsheet"** button
7. **System automatically discovers and imports ALL WBS sheets**

## 🔄 How Data Sync Works

### Import Process (Smartsheet → Database):
```typescript
// 1. Connect to Smartsheet API
const sheetData = await smartsheetClient.sheets.getSheet({ id: sheetId })

// 2. For each row, extract data based on column mapping
const wbsData = extractWbsDataFromRow(row, columns)

// 3. Find/create project in database
const project = await prisma.project.findUnique({
  where: { projectCode: wbsData.projectCode }
})

// 4. Create/update WBS task
await prisma.wbsCache.upsert({
  where: { smartsheetRowId: row.id },
  update: wbsData,
  create: { ...wbsData, projectId: project.id }
})
```

### Export Process (Database → Smartsheet):
```typescript
// When user saves changes in the app:
// 1. Update database
await prisma.wbsCache.update({ id, data: updatedData })

// 2. Push changes back to Smartsheet
await smartsheetClient.sheets.updateRow({
  sheetId: SMARTSHEET_WBS_SHEET_ID,
  body: [{ id: smartsheetRowId, cells: updatedCells }]
})
```

## 🎯 User Experience Flow

### For Assignees (like "Forster"):
1. **User logs in** with their last name (e.g., "Forster")
2. **System queries database** for tasks where `ownerLastName = "Forster"`
3. **Dashboard shows** tasks they need to work on
4. **User updates** progress, status, actual costs, notes
5. **Changes sync back** to Smartsheet automatically

### For Approvers (like "Privette"):
1. **User logs in** with their last name (e.g., "Privette")
2. **System queries database** for tasks where `approverLastName = "Privette"`
3. **Dashboard shows** tasks they need to approve
4. **User reviews** and approves/rejects tasks
5. **Approval status** syncs back to Smartsheet

### Dual Role Users:
- Users see **both** tasks they're assigned to work on AND tasks they need to approve
- Tasks are clearly labeled with their role (Assignee vs Approver)

## 🔍 Why You See No Tasks Currently

The API is working (200 status codes) but returns empty results because:

```sql
-- This query runs when you login as "Privette" (who is an approver)
SELECT * FROM wbs_cache 
WHERE (ownerLastName = 'Privette' OR approverLastName = 'Privette')
AND project.status IN ('In_Progress', 'Not_Started')

-- Result: Empty (no data imported from Smartsheet yet)

-- When you login as "Forster" (who is assigned to tasks):
SELECT * FROM wbs_cache 
WHERE (ownerLastName = 'Forster' OR approverLastName = 'Forster')
AND project.status IN ('In_Progress', 'Not_Started')

-- Result: Should show VoIP Phone Replacement and related tasks
```

## ⚡ Quick Test

1. **Set up environment variables** (Steps 1-3)
2. **Login as "Adams"** (EO Engineer)
3. **Go to Settings** → **Sync from Smartsheet**
4. **Check terminal** for sync logs
5. **Login as your name** → **Should see your tasks!**

## 🛠 Troubleshooting

### Common Issues:
- **No tasks showing**: Data not imported yet
- **Sync fails**: Check access token and sheet IDs
- **Wrong tasks**: Check "Assigned To" column has last names only
- **Status errors**: Ensure status values match expected formats

### Debug Steps:
1. Check terminal logs during sync
2. Verify database has data: `SELECT * FROM wbs_cache;`
3. Check Smartsheet column names match mapping
4. Ensure "Assigned To" column has last names (not emails)

Once you complete the setup, the system will:
- ✅ Import your existing Smartsheet data
- ✅ Show tasks assigned to each user
- ✅ Allow users to edit their tasks
- ✅ Sync changes back to Smartsheet automatically
