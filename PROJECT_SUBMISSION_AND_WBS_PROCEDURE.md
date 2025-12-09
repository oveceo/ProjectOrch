# Project Submission & WBS Management Procedure
**Ohio Valley Electric Corporation - Transmission Department**

---

## Overview

This procedure covers the complete workflow for submitting new projects and managing Work Breakdown Structures (WBS) using the Transmission Project Orchestrator application. The system integrates with Smartsheet to provide a seamless project management experience.

**System Location:**
- **New Project Submission Form:** `file:///G:/EO/Department%20Links/Transmission%20Hub.html` → "Submission Forms & Tools" section → "New Project Submission"
- **Project WBS Application:** Same section in Transmission Hub

---

## PART 1: PROJECT SUBMISSION

### Step 1: Access the New Project Submission Form

1. **Navigate to the Transmission Hub**
   - Open: `file:///G:/EO/Department%20Links/Transmission%20Hub.html`
   - Locate the **"Submission Forms & Tools"** section
   - Click on **"New Project Submission"** link

2. **Form Opens in Browser**
   - The Smartsheet form will open in your default web browser
   - URL will be: `https://app.smartsheet.com/b/form/...`

### Step 2: Complete the Project Submission Form

Fill out all required fields (marked with red asterisk *):

#### **Created by*** (Required)
- **Type:** Dropdown (searchable)
- **Action:** Type to search and select your last name
- **Example:** Type "Forster" and select from list

#### **Approved By*** (Required)
- **Type:** Dropdown (searchable)
- **Action:** Select the person responsible for project approval
- **Note:** This is typically your supervisor or project approver
- **Example:** "Privette", "Campbell", etc.

#### **Project Name*** (Required)
- **Type:** Text field
- **Action:** Enter a descriptive project name
- **Example:** "VoIP Phone Replacement", "Substation Transformer Upgrade"

#### **Assigned To*** (Required)
- **Type:** Dropdown (searchable)
- **Action:** Select the person who will be assigned to work on the project
- **Example:** Select last name from transmission team list

#### **Work Breakdown Needed?**
- **Type:** Checkbox
- **Action:** Check this box if the project requires a detailed WBS
- **When to check:**
  - Multi-phase projects
  - Projects with multiple tasks/subtasks
  - Projects requiring detailed tracking
  - Budget tracking needed
  - Projects with multiple team members

#### **Description*** (Required)
- **Type:** Text area (multi-line)
- **Action:** Provide detailed project description
- **Include:**
  - Project objectives
  - Scope of work
  - Expected deliverables
  - Any special requirements

#### **Priority*** (Required)
- **Type:** Radio buttons
- **Options:**
  - ○ Low
  - ○ Medium
  - ○ High
- **Action:** Select appropriate priority level

#### **Category*** (Required)
- **Type:** Dropdown
- **Action:** Select project category
- **Examples:**
  - Electrical
  - Infrastructure
  - Maintenance
  - Safety
  - IT/Technology

#### **Budget**
- **Type:** Text field
- **Action:** Enter estimated budget amount
- **Format:** Dollar amount (e.g., "$50,000")
- **Note:** Optional but recommended for tracking

#### **Due Date*** (Required)
- **Type:** Date picker
- **Format:** mm/dd/yyyy
- **Action:** Click calendar icon and select target completion date

#### **File Upload**
- **Type:** File upload area
- **Action:** 
  - Drag and drop files into the dashed box, OR
  - Click "Browse" to select files from your computer
- **Attach:**
  - Supporting documentation
  - Diagrams
  - Budget spreadsheets
  - Any relevant files

### Step 3: Submit the Form

1. **Review All Information**
   - Scroll through the entire form
   - Verify all required fields (*) are filled
   - Check for accuracy

2. **Click Submit Button**
   - Button located at bottom of form
   - Form will validate all required fields
   - If any required fields are missing, you'll see error messages

3. **Confirmation**
   - You'll receive a confirmation message
   - The submission is automatically recorded in Smartsheet
   - The project will appear in the portfolio sheet

---

## PART 2: ACCESSING THE PROJECT WBS APPLICATION

### Step 1: Launch the Application

1. **Navigate to Transmission Hub**
   - Open: `file:///G:/EO/Department%20Links/Transmission%20Hub.html`
   - Locate the **"Submission Forms & Tools"** section
   - Click on **"Project WBS Application"** (or similar link)

2. **Application Opens**
   - The web application will open in your browser
   - You'll see the login screen

### Step 2: Sign In

1. **Login Screen**
   - Title: **"Transmission Project Orchestrator"**
   - Subtitle: "Work Breakdown Structure Task Management"

2. **Select Your Name**
   - Click the **"Select Your Name"** dropdown
   - Scroll or type to find your last name
   - Click your name to select it
   - Available names include all Transmission team members:
     - Adams, Allen, Barringer, Campbell, Clark, Donahue, Egbert, Elswick, Fields, Forster, Galloway, Green, Hicks, Holskey, Huff, McCord, Merritt, Privette, Roberts, Southall, Thomas, Thompson, Waugh, Woodworth

3. **Enter Password**
   - Default password format: **[lastname]123** (all lowercase)
   - Examples:
     - If you selected "Forster", password is: **forster123**
     - If you selected "Campbell", password is: **campbell123**
   - The password hint appears below the password field

4. **Click "Sign In" Button**
   - Blue button with lock icon
   - You'll be redirected to the main WBS page

---

## PART 3: MAIN WBS HOME PAGE

After signing in, you'll see the **"Project Breakdown Management"** dashboard.

### Page Layout

**Header Section:**
- **Left:** "Project Breakdown Management" title and subtitle
- **Right:** Green **"Sync from Smartsheet"** button with refresh icon

**Statistics Dashboard (6 Cards):**
1. **Projects** - Total number of your projects
2. **My Tasks** - Total tasks assigned to you
3. **In Progress** - Number of active tasks
4. **Complete** - Number of completed tasks
5. **At Risk** - Number of at-risk items
6. **Overdue** - Number of overdue tasks

**Two-Panel View:**

#### Left Panel: "My Projects" or "All Projects"
- Shows projects you're involved with
- **Filter Toggle Button:** "Show All" / "Show Mine"
  - **Show Mine:** Only projects where you're in "Assigned To" field
  - **Show All:** All projects in the system

**Each Project Shows:**
- Project Code (e.g., P-0015) in blue monospace font
- Project Title
- Status badge (Not Started, In Progress, Complete, etc.)
- "Linked" badge if connected to Smartsheet
- Number of WBS items
- **"Edit WBS"** button

#### Right Panel: "My Tasks"
- Shows all tasks assigned to you
- **Search Bar:** Search by task name or project code
- **Status Filter Dropdown:** Filter by task status
  - All Status
  - Not Started
  - In Progress
  - Complete
  - Blocked

**Each Task Shows:**
- Task type badge (Task / Subtask)
- Task description
- Project code and title
- Status badge with color coding
- Start date (if set)
- Due date (if set)
- "Overdue" warning if past due date
- At-risk indicator (⚠️) if flagged
- Clicking a task opens the WBS editor for that project

---

## PART 4: CRITICAL - SMARTSHEET SYNCHRONIZATION

### ⚠️ IMPORTANT: Always Sync Before Working

**BEFORE you start working on any project or viewing tasks:**

1. **Click the "Sync from Smartsheet" Button**
   - Located in top-right corner of main page
   - Green button with refresh icon
   - This imports the latest data from Smartsheet

2. **Wait for Sync to Complete**
   - Button will show spinning animation
   - Success message will appear: "Sync complete! Updated X projects and Y WBS items"
   - Usually takes 5-15 seconds depending on data volume

3. **When to Sync:**
   - **First login of the day** - Always sync to get overnight changes
   - **Before starting work** - Ensures you have latest updates
   - **After someone else works in Smartsheet** - Get their changes
   - **After submitting a new project** - Pull in the new project
   - **Every few hours** - Stay updated with team changes

4. **What Sync Does:**
   - Pulls all projects from the Portfolio sheet
   - Updates project information (status, assignees, dates)
   - Imports all WBS items from all linked sheets
   - Updates task assignments, statuses, dates, budgets
   - Discovers new WBS sheets that were created
   - **Direction:** Smartsheet → Application Database

### 🔄 Two-Way Sync Concept

The system syncs in BOTH directions:

**Smartsheet → Application (Import):**
- Use "Sync from Smartsheet" button
- Pulls latest data into the application
- Do this regularly to stay updated

**Application → Smartsheet (Export):**
- Happens automatically when you click "Save & Sync" in WBS editor
- Pushes your changes back to Smartsheet
- Keeps Smartsheet updated with your work

---

## PART 5: CREATING A NEW WBS PROJECT

### Option A: From Smartsheet Form (Recommended)

If you submitted a project through the Smartsheet form with "Work Breakdown Needed?" checked, the project will appear after syncing. You can then add WBS details.

### Option B: Create Directly in Application

1. **Go to Projects Page**
   - Click "WBS Home" in top navigation if not already there

2. **Click "Create WBS Project" Button**
   - Located in top-right of the page
   - Gray outline button with folder icon

3. **Fill Out Creation Dialog:**

   **Project Title*** (Required)
   - Enter descriptive project name
   - Example: "Network Infrastructure Upgrade"

   **Description** (Optional)
   - Brief description of the project
   - Will help team members understand scope

   **Note:** Project code is auto-generated
   - System automatically creates next P-XXXX code
   - Example: P-0016, P-0017, etc.

4. **Click "Create WBS Project"**
   - Blue button
   - System will:
     - Create project in database
     - Create folder in Smartsheet: "WBS (#P-XXXX)"
     - Create "Work Breakdown Schedule" sheet from template
     - Link project to Smartsheet sheet
   - Success message: "✅ WBS Project P-XXXX created successfully!"

5. **Project Appears in List**
   - New project now visible in "My Projects" panel
   - Click "Edit WBS" to start building breakdown structure

---

## PART 6: EDITING WBS (WORK BREAKDOWN STRUCTURE)

### Opening the WBS Editor

**Three Ways to Open:**
1. Click **"Edit WBS"** button on project card in main page
2. Click on a task in "My Tasks" panel
3. From Projects page, click project row → "Manage WBS"

### WBS Editor Interface

**Top Bar:**
- **Left:**
  - "Back" button (← Back)
  - Project code (e.g., "WBS Editor: P-0015")
  - Project title
  
- **Right:**
  - "Unsaved Changes" badge (yellow, appears when you make edits)
  - **"Add Phase"** button (white outline)
  - **"Import from Smartsheet"** button (downloads latest from Smartsheet)
  - **"Save & Sync"** button (green, saves to database AND Smartsheet)

**Alert Messages:**
- Success messages (green): "✅ Saved X items • Synced Y to Smartsheet"
- Error messages (red): Display any sync or save errors

### WBS Table Columns

The spreadsheet-like table includes these columns:

1. **Skip** - Checkbox to skip WBS numbering for header rows
2. **WBS** - Auto-calculated WBS number (1, 1.1, 1.1.1, etc.)
3. **Name** - Task/phase name (editable text)
4. **Description** - Detailed description (editable text, LARGEST column)
5. **Assigned To** - Dropdown of team member last names
6. **Status** - Dropdown (Not Started, In Progress, Blocked, Complete)
7. **Start Date** - Date picker (mm/dd/yyyy)
8. **End Date** - Date picker (mm/dd/yyyy)
9. **At Risk** - Checkbox to flag at-risk items
10. **Budget** - Dollar amount (e.g., $50,000)
11. **Actual** - Actual cost spent
12. **Actions** - Plus (+) and Trash (🗑️) icons

### Understanding WBS Hierarchy

**Three Levels:**

1. **Header** (skipWbs = checked)
   - Project code and title rows
   - No WBS number
   - Cannot be deleted
   - Purple background
   - Badge: "Header"

2. **Phase** (Top Level)
   - Main project phases
   - WBS: 1, 2, 3, etc.
   - Light blue background
   - Badge: "Phase"
   - Can contain Tasks

3. **Task** (Second Level)
   - Individual tasks within phases
   - WBS: 1.1, 1.2, 2.1, etc.
   - Light gray background
   - Badge: "Task"
   - Can contain Subtasks

4. **Subtask** (Third Level)
   - Detailed items under tasks
   - WBS: 1.1.1, 1.1.2, 2.1.1, etc.
   - White background
   - Badge: "Subtask"
   - Cannot have children (3-level limit)

### Expand/Collapse

- **Chevron Icons:**
  - **Down arrow (▼):** Item is expanded (children visible)
  - **Right arrow (▶):** Item is collapsed (children hidden)
- Click chevron to toggle visibility
- Indentation shows hierarchy level

---

## PART 7: ADDING WBS ITEMS

### Add a New Phase

1. **Click "Add Phase" Button** (top-right of page)
   - Creates new phase under the project name row
   - Auto-numbers: "Phase 1", "Phase 2", etc.
   - Gets next WBS number: 1, 2, 3, etc.

2. **Edit the Phase Name**
   - Click in the Name field
   - Replace "Phase 1" with your phase name
   - Example: "Design & Planning", "Hardware Procurement", "Installation"

3. **Fill in Phase Details**
   - **Description:** Detailed phase description
   - **Assigned To:** Select phase owner from dropdown
   - **Status:** Set to "Not Started" initially
   - **Start Date:** Expected start date
   - **End Date:** Expected completion date
   - **Budget:** Allocated budget for this phase

### Add a Task (Under a Phase)

1. **Locate the Phase Row**
   - Find the phase you want to add a task to

2. **Click the Plus (+) Icon** in the Actions column
   - Green plus icon appears for Phases and Tasks
   - Tooltip says "Add Task" when hovering

3. **Task is Created**
   - Appears indented under the phase
   - Auto-named: "Task"
   - Gets WBS number: 1.1, 1.2, etc. (phase.task)

4. **Edit Task Details**
   - **Name:** Give it a meaningful name (e.g., "Order Equipment")
   - **Description:** What needs to be done
   - **Assigned To:** Who will do this task
   - **Status:** Current status
   - **Dates:** When it should be done
   - **Budget:** Cost for this specific task

### Add a Subtask (Under a Task)

1. **Locate the Task Row**
   - Find the task you want to break down further

2. **Click the Plus (+) Icon** on the task row
   - Tooltip says "Add Subtask"

3. **Subtask is Created**
   - Appears indented under the task
   - Auto-named: "Subtask"
   - Gets WBS number: 1.1.1, 1.1.2, etc. (phase.task.subtask)

4. **Edit Subtask Details**
   - Similar to task editing
   - **Note:** Subtasks CANNOT have children (3-level max depth)

### Special: Skip WBS Checkbox

**What it does:**
- Removes WBS numbering from an item
- Used for header rows and grouping items
- Children under a skipWbs item start fresh numbering

**When to use:**
- Project name/title rows (already set)
- Section headers that aren't actual work items
- Grouping labels

**How to use:**
- Check the "Skip" checkbox in first column
- Item background turns purple
- WBS number disappears
- Item becomes a "Header" type

---

## PART 8: EDITING WBS ITEMS

### Inline Editing

All fields are **directly editable** in the table:

1. **Text Fields (Name, Description, Budget, Actual):**
   - Click in the field
   - Type your changes
   - Changes are tracked but not saved yet

2. **Dropdowns (Assigned To, Status):**
   - Click the dropdown
   - Select new value from list
   - **Assigned To:** Shows all Transmission team members
   - **Status:** Not Started, In Progress, Blocked, Complete

3. **Date Fields (Start Date, End Date):**
   - Click the field
   - Opens date picker
   - Select date from calendar
   - Or type date in mm/dd/yyyy format

4. **Checkboxes (Skip WBS, At Risk):**
   - Click to toggle on/off
   - **Skip WBS:** Removes WBS numbering
   - **At Risk:** Flags item with ⚠️ icon

### Tracking Changes

- When you make ANY edit, yellow badge appears: **"Unsaved Changes"**
- This reminds you to save before leaving
- Changes are held in browser memory until saved

### Deleting Items

1. **Locate Item to Delete**
   - Find the row you want to remove
   - **Note:** Cannot delete header rows (skipWbs items)

2. **Click Trash Icon** (🗑️) in Actions column
   - Red trash can icon

3. **Confirm Deletion**
   - Popup: "Delete '[item name]' and all its children?"
   - Click OK to confirm
   - **WARNING:** Deleting a Phase deletes all its Tasks
   - **WARNING:** Deleting a Task deletes all its Subtasks

4. **Item Removed**
   - Row disappears from table
   - WBS numbers automatically recalculate
   - Change tracked as unsaved

---

## PART 9: SAVING AND SYNCING

### Save Your Changes

**CRITICAL:** You must manually save changes - they don't auto-save!

1. **Click "Save & Sync" Button**
   - Green button in top-right corner
   - Disabled (grayed out) if no unsaved changes
   - Shows save icon (💾)

2. **Saving Process:**
   - Button shows spinning animation: "Saving..."
   - System performs multiple operations:
     - **Step 1:** Saves all changes to application database
     - **Step 2:** Creates/updates items in database
     - **Step 3:** Syncs changes to Smartsheet
     - **Step 4:** Updates Smartsheet rows with your edits
     - **Step 5:** Creates new rows for new items
     - **Step 6:** Updates hierarchy (parent-child relationships)

3. **Success Confirmation:**
   - Green alert message appears:
     - "✅ Saved X items"
     - "• Synced Y to Smartsheet" (if Smartsheet sync succeeded)
   - "Unsaved Changes" badge disappears
   - Message auto-dismisses after 5 seconds

4. **If Sync Errors Occur:**
   - Orange alert: "⚠️ Smartsheet sync had errors"
   - Items saved to database but Smartsheet update failed
   - Check Smartsheet API token and sheet IDs
   - Can retry sync later
   - Your data is safe in the database

### Import from Smartsheet

If someone else edited the Smartsheet directly, or you want to refresh:

1. **Click "Import from Smartsheet" Button**
   - White outline button with download icon
   - Located next to "Save & Sync"

2. **Import Process:**
   - Button shows spinning: "Importing..."
   - Fetches latest data from Smartsheet
   - Overwrites local data with Smartsheet version
   - Rebuilds hierarchy

3. **Warning:**
   - **Any unsaved local changes will be lost!**
   - Always save first if you have changes
   - Use this to:
     - Get updates made by others in Smartsheet
     - Reset if you made mistakes
     - Refresh after external Smartsheet edits

4. **Success Message:**
   - "✅ Imported X items from Smartsheet!"
   - Table refreshes with latest data

---

## PART 10: WORKING WITH YOUR TASKS

### Finding Your Tasks

From the **WBS Home** page:

1. **"My Tasks" Panel (Right Side)**
   - Automatically shows only tasks where:
     - You're in "Assigned To" field, OR
     - You're in "Approver" field
   - Shows tasks from ALL projects

2. **Search Tasks**
   - Type in search box (magnifying glass icon)
   - Searches:
     - Task names
     - Task descriptions
     - Project codes

3. **Filter by Status**
   - Click status dropdown
   - Select status to filter:
     - All Status
     - Not Started
     - In Progress
     - Complete
     - Blocked

### Task Information Display

Each task card shows:

- **Type Badge:** "Task" (green) or "Subtask" (gray)
- **Task Name:** Main description
- **Project Code:** e.g., P-0015 (blue monospace)
- **Project Title:** Full project name
- **Status Badge:** Color-coded status
- **Start Date:** When task started
- **Due Date:** When task is due
- **Overdue Warning:** Red "Overdue" text if past due
- **At Risk Icon:** ⚠️ if task is flagged

### Opening a Task

- **Click anywhere on the task card**
- Opens the WBS Editor for that project
- Scrolls to and highlights your task
- You can then edit status, add notes, update dates, etc.

### Updating Task Status

1. **Open the project's WBS editor** (click task or "Edit WBS")
2. **Find your task** in the table
3. **Click the Status dropdown** for that row
4. **Select new status:**
   - **Not Started:** Haven't begun yet
   - **In Progress:** Currently working on it
   - **Complete:** Task finished
   - **Blocked:** Cannot proceed (explain in Description)
5. **Add notes** in Description field if needed
6. **Update dates** if actual dates changed
7. **Update Actual cost** if you have spending to report
8. **Click "Save & Sync"** to save changes

---

## PART 11: USING THE PROJECTS PAGE

### Accessing Projects Page

Option 1: Click "WBS Home" in top navigation (same as main page)

### Projects View

**Header:**
- Title: "Project Management"
- Subtitle: "View and manage Work Breakdown Structure (WBS) projects"
- **Buttons:**
  - **"New Project Request"** - Opens Smartsheet submission form
  - **"Create WBS Project"** - Creates project directly in app

**Statistics Cards (4 Cards):**
1. **Total Projects** - Count of all projects
2. **In Progress** - Active projects
3. **At Risk** - Projects with at-risk items
4. **Pending Approval** - Projects awaiting approval

**Projects Table:**

**Filters (Above Table):**
- **Search box:** Search by project code, title, or description
- **Status filter:** Filter by project status
- **Category filter:** Filter by category (Electrical, Infrastructure, etc.)
- **Approval filter:** Filter by approval status (Pending, Approved, Rejected)

**Table Columns:**
- **Project Code:** Unique identifier (P-XXXX)
- **Title:** Project name
- **Status:** Color-coded status badge
- **Approval:** Approval status badge
- **Assignee:** Person assigned to project
- **Due Date:** Project due date (red if overdue)
- **Actions:** View and manage buttons

**Actions Menu (⋮):**
- **View:** Open project details page
- **Manage WBS:** Open WBS editor
- **Edit Project:** Edit project properties
- **View in Smartsheet:** Open source Smartsheet (if linked)
- **Delete:** Remove project (with confirmation)

---

## PART 12: SETTINGS & ADMINISTRATION

### Accessing Settings

1. **Click "Settings"** in top navigation bar
   - Gear icon next to "WBS Home"

### Settings Page Tabs

#### **System Tab:**
- **Smartsheet Integration Toggle**
  - Enable/disable Smartsheet connection
  
- **API Token Management**
  - Enter/update Smartsheet API token
  - Get from: Smartsheet → Account → Personal Settings → API Access
  
- **Manual Sync Controls**
  - **"Sync from Smartsheet" Button:** Pull latest data
  - Sync status and last sync time
  
- **Workspace Configuration**
  - Workspace ID for sheet discovery
  - Folder IDs for WBS organization

#### **Team Tab:**
- View team members
- Manage user list (if admin)
- See who's assigned to what

#### **Reports Tab:**
- Project status reports
- Task completion metrics
- At-risk items summary
- Budget variance reports

---

## PART 13: BEST PRACTICES

### Daily Workflow

**Morning Routine:**
1. Log into the application
2. **IMMEDIATELY click "Sync from Smartsheet"**
3. Review "My Tasks" panel
4. Check for overdue items (red text)
5. Check at-risk items (⚠️ icon)
6. Plan your day's work

**During Work:**
1. Open relevant project WBS editor
2. Update task statuses as you progress
3. Add notes in Description field
4. Update Actual costs when spending
5. **Save frequently** - Click "Save & Sync" after updates
6. Flag items as "At Risk" if you encounter issues

**End of Day:**
1. Update all task statuses
2. Add notes about progress or blockers
3. **Save & Sync** all changes
4. Set tomorrow's priorities

### When Working on a Project

**Before Starting Work:**
1. **Sync from Smartsheet** (get latest updates)
2. Open project WBS editor
3. Review phase and task breakdown
4. Verify assignments and dates
5. Check for dependencies

**While Working:**
1. Update status to "In Progress"
2. Add detailed notes in Description
3. Update dates if schedule changes
4. Flag "At Risk" if problems arise
5. Update Actual costs regularly
6. **Save & Sync** after each significant update

**After Completing Tasks:**
1. Change status to "Complete"
2. Add final notes/outcomes
3. Update final Actual cost
4. **Save & Sync**
5. Notify team members if needed

### Collaboration

**Team Coordination:**
- **Always sync before starting work** - Get team changes
- **Save & sync frequently** - Share your updates
- **Use Description field** - Communicate with team
- **Flag At Risk** - Alert team to problems
- **Update statuses** - Keep everyone informed

**If Multiple People Edit Simultaneously:**
- Last save wins (overwrites previous)
- **Best practice:** Coordinate who edits when
- Use Description field to note: "Edited by [Name] on [Date]"
- If conflict occurs: "Import from Smartsheet" to get latest

### Data Integrity

**Always:**
- ✅ Sync from Smartsheet at start of session
- ✅ Save & Sync after making changes
- ✅ Use meaningful names and descriptions
- ✅ Assign tasks to specific people
- ✅ Set realistic dates
- ✅ Update Actual costs accurately

**Never:**
- ❌ Close browser without saving
- ❌ Edit Smartsheet and Application simultaneously
- ❌ Delete items without confirming
- ❌ Leave status as "Not Started" when working
- ❌ Ignore "Unsaved Changes" warning

### Smartsheet Integration Rules

**Key Principles:**
1. **Smartsheet is the source of truth**
   - Import from Smartsheet to get latest
   - Portfolio sheet drives project list
   
2. **Two-way sync works best when:**
   - One person edits at a time
   - Changes are synced immediately
   - Team communicates about edits

3. **Column Mapping:**
   - **Assigned To** must be last name only (not email)
   - **Status** must match exact values
   - **Dates** must be valid date format
   - **At Risk** must be Yes/No or true/false

4. **Hierarchy:**
   - Parent-child relationships sync via parentRowId
   - Don't break hierarchy in Smartsheet manually
   - Let the application manage row relationships

---

## PART 14: TROUBLESHOOTING

### Can't See Any Projects or Tasks

**Problem:** Empty "My Projects" and "My Tasks" panels

**Solutions:**
1. **Click "Sync from Smartsheet"** button
   - Data may not have been imported yet
   - Wait for sync to complete
   
2. **Check "Show All" toggle**
   - May be filtered to "Show Mine" when you're not assigned
   - Click "Show All" to see all projects
   
3. **Verify Smartsheet has data**
   - Open Smartsheet directly
   - Check Portfolio sheet has projects
   - Check "Assigned To" has your last name

4. **Confirm you're in "Assigned To" field**
   - Check projects in Smartsheet
   - Your last name should be in "Assigned To" or "Approver"

### "Sync Failed" Error

**Problem:** Red error message when syncing

**Causes & Solutions:**
1. **Invalid API Token**
   - Go to Settings → System tab
   - Verify Smartsheet API token is entered correctly
   - Generate new token if expired

2. **Network Connection**
   - Check internet connection
   - Verify access to smartsheet.com
   - Check firewall rules

3. **Sheet Not Found**
   - Verify sheet IDs in settings
   - Check you have access to the sheets
   - Confirm sheets weren't deleted

4. **API Rate Limit**
   - Wait 60 seconds
   - Try syncing again
   - Smartsheet limits: 300 requests/minute

### Changes Not Saving to Smartsheet

**Problem:** Saves to database but not Smartsheet

**Solutions:**
1. **Check Success Message**
   - Look for "Synced X to Smartsheet" in message
   - If missing, Smartsheet sync failed

2. **Verify Sheet is Linked**
   - Check project has wbsSheetId
   - Open project details
   - Should show "Linked" badge

3. **Check Smartsheet Permissions**
   - Verify you have edit access
   - Confirm sheet isn't locked
   - Check column names match exactly

4. **Column Name Mismatches**
   - Smartsheet columns must be named exactly:
     - "Assigned To", "Status", "Start Date", etc.
   - Case-sensitive!

### WBS Numbers Wrong

**Problem:** Numbers don't match expected hierarchy

**Solutions:**
1. **Check Skip WBS boxes**
   - Items with Skip checked don't get numbers
   - Uncheck if they should be numbered

2. **Verify Hierarchy**
   - Expand all items (click chevrons)
   - Check items are under correct parents
   - Drag items in Smartsheet if needed, then re-import

3. **Recalculate**
   - Make any small edit
   - Numbers recalculate automatically
   - Or delete and re-add item

### Can't Login

**Problem:** "Invalid password" error

**Solutions:**
1. **Verify Name Selected**
   - Must select name from dropdown
   - Can't type custom name

2. **Check Password Format**
   - Must be: [lastname]123 (all lowercase)
   - Example: forster123, not Forster123

3. **Verify You're in Team List**
   - Check if your name appears in dropdown
   - If not, contact admin to add you

### Browser Issues

**Problem:** Page not loading or errors

**Solutions:**
1. **Clear Browser Cache**
   - Ctrl+Shift+Delete (Windows)
   - Clear cache and cookies
   - Reload page

2. **Try Different Browser**
   - Chrome recommended
   - Firefox also works well
   - Edge compatible

3. **Check JavaScript Enabled**
   - Application requires JavaScript
   - Check browser settings

4. **Disable Extensions**
   - Ad blockers may interfere
   - Try incognito/private mode

---

## PART 15: QUICK REFERENCE

### Common Actions Cheat Sheet

| Action | Location | Button/Icon |
|--------|----------|-------------|
| **Submit New Project** | Transmission Hub → Submission Forms | "New Project Submission" link |
| **Login** | Application start | Select name + password ([name]123) |
| **Sync Data** | WBS Home (top-right) | Green "Sync from Smartsheet" button |
| **View My Tasks** | WBS Home (right panel) | Automatic display |
| **Search Tasks** | My Tasks panel | 🔍 Search box |
| **Create WBS Project** | Projects page | "Create WBS Project" button |
| **Open WBS Editor** | Project card | "Edit WBS" button |
| **Add Phase** | WBS Editor (top-right) | "Add Phase" button |
| **Add Task/Subtask** | WBS Editor table | ➕ Plus icon on row |
| **Delete Item** | WBS Editor table | 🗑️ Trash icon on row |
| **Save Changes** | WBS Editor (top-right) | Green "Save & Sync" button |
| **Import Fresh Data** | WBS Editor | "Import from Smartsheet" button |
| **Change Status** | WBS table row | Status dropdown |
| **Assign Person** | WBS table row | "Assigned To" dropdown |
| **Set Dates** | WBS table row | Date fields (Start/End) |
| **Flag At Risk** | WBS table row | Checkbox in "At Risk" column |
| **Access Settings** | Top navigation | ⚙️ Settings link |
| **Logout** | User menu (top-right) | Click name → Sign Out |

### Status Meanings

| Status | Meaning | When to Use |
|--------|---------|-------------|
| **Not Started** | Haven't begun work yet | Task created but not active |
| **In Progress** | Currently working on it | Task is your current focus |
| **Complete** | Finished successfully | Work done and verified |
| **Blocked** | Cannot proceed | Waiting on something/someone |

### Color Coding

| Color | Meaning |
|-------|---------|
| **Purple Background** | Header row (skipWbs) |
| **Blue Background** | Phase (top level) |
| **Gray Background** | Task (second level) |
| **White Background** | Subtask (third level) |
| **Green Badge** | Complete or Task type |
| **Blue Badge** | In Progress or Phase type |
| **Gray Badge** | Not Started or Subtask type |
| **Red Badge** | Blocked status |
| **Orange Icon** | At Risk (⚠️) |
| **Red Text** | Overdue date |
| **Yellow Badge** | Unsaved changes |

### Keyboard Tips

| Key | Action |
|-----|--------|
| **Tab** | Move to next field in table |
| **Enter** | Open dropdown/date picker |
| **Esc** | Close dropdown |
| **Ctrl+S** | *(Not implemented)* Use "Save & Sync" button |
| **Type in dropdown** | Filter dropdown options |

---

## PART 16: SUPPORT & CONTACTS

### Getting Help

**For Application Issues:**
1. Check this procedure document first
2. Try "Import from Smartsheet" to refresh data
3. Clear browser cache and retry
4. Contact your IT support or application administrator

**For Smartsheet Form Issues:**
1. Verify form URL is correct
2. Try different browser
3. Contact Smartsheet administrator

**For Project/Process Questions:**
1. Contact your supervisor
2. Check with project approver
3. Coordinate with transmission team

### Application Administrator

**Responsibilities:**
- Managing Smartsheet API tokens
- Adding new users to system
- Troubleshooting sync issues
- Maintaining settings

**Contact:** Your Transmission Department IT contact

### Remember

- 🔄 **SYNC FIRST, SAVE OFTEN**
- 📝 **Use descriptions to communicate with team**
- ⚠️ **Flag at-risk items immediately**
- ✅ **Update statuses as you work**
- 💾 **Always save before closing browser**

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**System:** Transmission Project Orchestrator / WBS Management System  
**Department:** Ohio Valley Electric Corporation - Transmission

