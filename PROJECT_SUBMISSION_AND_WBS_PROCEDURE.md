# Project Submission & WBS Management Procedure
**Ohio Valley Electric Corporation - Transmission Department**

---

## Overview

This procedure covers the complete workflow for submitting new projects and managing Work Breakdown Structures (WBS) using the **Transmission Project Orchestrator** application.

**Key Features:**
- ✅ **Automated WBS Folder Creation** - When projects are approved in Smartsheet, WBS folders are automatically created
- ✅ **Two-Way Sync** - Data flows between the app and Smartsheet
- ✅ **Real-Time Task Management** - Track tasks, assignees, and progress
- ✅ **Budget & Timeline Tracking** - Monitor costs and dates

---

## Quick Start Guide

### For New Projects

1. **Submit via Smartsheet Form** → Project goes to Portfolio sheet
2. **Wait for Approval** → Approver changes status to "Approved"
3. **WBS Folder Created Automatically** → System creates `WBS (#P-XXXX)` folder
4. **Sync & Start Working** → Click "Sync Data" in app to see your project

### For Existing Users

1. **Log in** → Select name, enter password (`lastname123`)
2. **Sync Data** → Click "Sync Data" button on WBS Home
3. **View Tasks** → Check "My Tasks" panel for your assignments
4. **Edit WBS** → Click "Edit WBS" on any project to manage tasks

---

## PART 1: PROJECT SUBMISSION

### Step 1: Access the Submission Form

**Location:** `file:///G:/EO/Department%20Links/Transmission%20Hub.html`
- Navigate to **"Submission Forms & Tools"** section
- Click **"New Project Submission"**

### Step 2: Complete the Form

| Field | Required | Description |
|-------|----------|-------------|
| **Created by** | ✅ | Select your last name |
| **Approved By** | ✅ | Select project approver |
| **Project Name** | ✅ | Descriptive project title |
| **Assigned To** | ✅ | Primary person responsible |
| **Work Breakdown Needed?** | ☐ | Check if detailed WBS tracking needed |
| **Description** | ✅ | Project scope and objectives |
| **Priority** | ✅ | Low / Medium / High |
| **Category** | ✅ | Electrical, Infrastructure, etc. |
| **Budget** | Optional | Estimated cost |
| **Due Date** | ✅ | Target completion date |
| **File Upload** | Optional | Supporting documents |

### Step 3: Submit and Wait for Approval

1. Click **Submit** at bottom of form
2. Project appears in Portfolio sheet with **"Pending Approval"** status
3. Approver reviews and changes status to **"Approved"**
4. ⚡ **System automatically creates WBS folder** when approved

---

## PART 2: AUTOMATIC WBS FOLDER CREATION

### How It Works

When a project's **Approval Status** changes to **"Approved"** in the Portfolio sheet:

1. **Webhook fires** → Smartsheet notifies the application
2. **System checks** → Verifies no duplicate WBS folder exists
3. **Folder copied** → Creates `WBS (#P-XXXX)` from template
4. **Contents included:**
   - ✅ Work Breakdown Schedule (sheet with all data)
   - ✅ Project Dashboard
   - ⚠️ Reports must be set up manually (Smartsheet API limitation)
5. **Project code updated** → Row 1 of WBS sheet gets project code

### Manual Trigger (if needed)

If automatic creation didn't happen, use the app:

1. Go to **WBS Home** page
2. Click **"Create WBS Folders"** button (green)
3. System checks all approved projects and creates missing folders
4. Auto-triggers **"Sync Data"** afterward

---

## PART 3: USING THE APPLICATION

### Logging In

**URL:** Your organization's deployed application URL

1. **Select Your Name** from dropdown
2. **Enter Password:** `[lastname]123` (all lowercase)
   - Example: If you're "Forster", password is `forster123`
3. Click **Sign In**

### WBS Home Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Project Breakdown Management                               │
│  Manage your projects and tasks                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚡ Smartsheet Sync                                   │   │
│  │ [Create WBS Folders]  [Sync Data]                   │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  📊 Stats: Projects | My Tasks | In Progress | Complete... │
├───────────────────────────┬─────────────────────────────────┤
│  MY PROJECTS              │  MY TASKS                       │
│  ┌───────────────────┐    │  ┌───────────────────────────┐ │
│  │ P-0015            │    │  │ Task: Install Equipment   │ │
│  │ Title...          │    │  │ Project: P-0015           │ │
│  │ [Edit WBS]        │    │  │ Status: In Progress       │ │
│  └───────────────────┘    │  │ Due: 12/15/2025          │ │
│                           │  └───────────────────────────┘ │
└───────────────────────────┴─────────────────────────────────┘
```

### Sync Panel Buttons

| Button | Action |
|--------|--------|
| **Create WBS Folders** (green) | Checks approved projects, creates missing WBS folders, then syncs |
| **Sync Data** (blue outline) | Pulls latest data from Smartsheet |

---

## PART 4: WORKING WITH WBS

### Opening the WBS Editor

- Click **"Edit WBS"** button on any project card
- OR click on a task in "My Tasks" panel

### WBS Table Columns

| Column | Description |
|--------|-------------|
| **Skip** | Checkbox - excludes from WBS numbering (for headers) |
| **WBS** | Auto-calculated number (1, 1.1, 1.1.1) |
| **Name** | Task/phase name |
| **Description** | Detailed description |
| **Assigned To** | Dropdown - team member last name |
| **Status** | Not Started / In Progress / Complete / Blocked |
| **Start Date** | When work begins |
| **End Date** | When work should complete |
| **At Risk** | Flag for problems |
| **Budget** | Allocated amount |
| **Actual** | Actual spent |
| **Variance** | Auto-calculated difference |
| **Actions** | Add child (+) / Delete (🗑️) |

### WBS Hierarchy

| Level | Type | Example WBS # | Background |
|-------|------|---------------|------------|
| 0 | Header | — | Purple |
| 1 | Phase | 1, 2, 3 | Blue |
| 2 | Task | 1.1, 1.2, 2.1 | Gray |
| 3 | Subtask | 1.1.1, 1.1.2 | White |

### Adding Items

- **Add Phase:** Click "Add Phase" button (top of editor)
- **Add Task:** Click ➕ on a Phase row
- **Add Subtask:** Click ➕ on a Task row

### Saving Changes

1. Make your edits (yellow "Unsaved Changes" badge appears)
2. Click **"Save & Sync"** (green button)
3. Wait for confirmation: "✅ Saved X items • Synced to Smartsheet"

---

## PART 5: DAILY WORKFLOW

### Morning Routine
1. ☐ Log into application
2. ☐ Click **"Sync Data"** to get overnight changes
3. ☐ Check "My Tasks" for today's work
4. ☐ Note any overdue or at-risk items

### During Work
1. ☐ Open project WBS editor when starting a task
2. ☐ Update status to "In Progress"
3. ☐ Add notes in Description field
4. ☐ **Save & Sync** after each significant update

### End of Day
1. ☐ Update all task statuses
2. ☐ Add completion notes
3. ☐ **Save & Sync** final changes
4. ☐ Check for tomorrow's tasks

---

## PART 6: SETTINGS

### Accessing Settings
Click **"Settings"** in top navigation

### Automation Tab
- **Enable Automation** - Sets up webhook for auto WBS creation
- **Run Now** - Manual check for new approved projects
- **Check Status** - View active webhooks

### Integrations Tab
- **Smartsheet Integration** toggle
- **Sync from Smartsheet** button
- **Clear WBS Cache** - For troubleshooting

---

## PART 7: TROUBLESHOOTING

### Project Not Appearing After Approval

**Cause:** Webhook may not have fired or sync not run

**Solution:**
1. Go to WBS Home
2. Click **"Create WBS Folders"** button
3. System will find and create missing WBS folders

### WBS Folder Created But Empty

**Cause:** Folder copy didn't include data

**Solution:**
1. Delete the empty folder in Smartsheet
2. Go to WBS Home in app
3. Click **"Create WBS Folders"**
4. System will recreate with full data

### Can't See My Tasks

**Solution:**
1. Click **"Sync Data"** to refresh
2. Check if "Show All" toggle is needed
3. Verify your name is in "Assigned To" in Smartsheet

### Report Not Copied to New WBS Folder

**Note:** This is a known Smartsheet API limitation. Reports cannot be copied programmatically.

**Solution:** Manually create reports in each WBS folder using Smartsheet's "Save as New" feature.

### Sync Errors

**Solution:**
1. Check internet connection
2. Verify Smartsheet access token is valid
3. Wait 60 seconds and retry (rate limit)

---

## Quick Reference

### Key Actions

| Action | How To |
|--------|--------|
| Submit new project | Smartsheet form |
| Check for new WBS folders | "Create WBS Folders" button |
| Refresh data | "Sync Data" button |
| Edit a project | "Edit WBS" on project card |
| Add a phase | "Add Phase" button in editor |
| Add task/subtask | ➕ icon on parent row |
| Save changes | "Save & Sync" button |
| Delete item | 🗑️ icon on row |

### Status Colors

| Status | Color | Meaning |
|--------|-------|---------|
| Not Started | Gray | Haven't begun |
| In Progress | Blue | Currently working |
| Complete | Green | Finished |
| Blocked | Red | Cannot proceed |
| At Risk | Orange ⚠️ | Has problems |

### Important Rules

- 🔄 **Always sync first** before starting work
- 💾 **Save frequently** - changes don't auto-save
- ⚠️ **Flag at-risk items** immediately
- 📝 **Use descriptions** to communicate

---

## Support

**For Technical Issues:**
- Check this document first
- Try "Sync Data" to refresh
- Clear browser cache
- Contact IT support

**For Process Questions:**
- Contact your supervisor
- Check with project approver

---

**Document Version:** 2.0  
**Last Updated:** December 10, 2025  
**System:** Transmission Project Orchestrator  
**Department:** Ohio Valley Electric Corporation - Transmission
