# EO WBS Task Manager - Enterprise Deployment Guide

## Overview

This guide covers deploying the EO WBS Task Manager for enterprise use at Ohio Valley Electric. The application can be deployed on a network share drive for easy access by all team members.

## Prerequisites

### Server Requirements
- Windows Server 2019/2022 (or Windows 10/11 workstation)
- Node.js 18 or higher
- PostgreSQL 13 or higher
- Network access to Smartsheet API

### Network Requirements
- Port 3005 available (configurable)
- Access to PostgreSQL database server
- Outbound HTTPS to api.smartsheet.com

## Quick Start

### 1. Copy to Share Drive

Copy the entire `EOProj` folder to your network share drive:
```
\\your-server\share\EOProj
```

### 2. Configure Environment

Create `.env.local` in the application folder with your settings:

```env
# Database
DATABASE_URL=postgres://user:password@your-db-server:5432/eo_orchestrator

# Authentication
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3005
AUTH_LOCAL_DEMO=1

# Smartsheet
SMARTSHEET_ACCESS_TOKEN=your-smartsheet-token
SMARTSHEET_PORTFOLIO_SHEET_ID=your-sheet-id
SMARTSHEET_WBS_TEMPLATE_SHEET_ID=your-template-id
SMARTSHEET_WBS_FOLDER_ID=your-folder-id
```

### 3. Initialize Database

Run the database setup (first time only):
```cmd
cd \\your-server\share\EOProj
npx prisma db push
```

### 4. Start the Server

**For Development/Testing:**
```cmd
start-server.bat
```

**For Production:**
```cmd
build-production.bat
start-production.bat
```

## Running as a Windows Service

For always-on availability, install as a Windows service using NSSM:

1. Download NSSM from https://nssm.cc/download
2. Install the service:
```cmd
nssm install EOWBSManager "C:\Program Files\nodejs\node.exe"
nssm set EOWBSManager AppParameters "node_modules\.bin\next start"
nssm set EOWBSManager AppDirectory "\\your-server\share\EOProj"
nssm set EOWBSManager Start SERVICE_AUTO_START
```

3. Start the service:
```cmd
nssm start EOWBSManager
```

## Accessing the Application

Once running, users can access the application at:
- **Local**: http://localhost:3005
- **Network**: http://your-server:3005

Create a desktop shortcut for users pointing to the application URL.

## User Authentication

The application uses a simple name-based authentication system:

1. Users select their name from the dropdown
2. Password format: `lastname123` (lowercase)

### Admin Users (EO Engineers)
The following users have administrative privileges:
- Forster
- Clark
- Huff
- Woodworth
- Privette

### Adding New Users

Edit `src/app/auth/simple/page.tsx` to add users to the `USERS` array:
```typescript
const USERS = [
  'Adams',
  'NewUser',  // Add new users here
  ...
]
```

Also update `src/lib/validation.ts` TEAM_MEMBERS array.

## Smartsheet Integration

### Required Sheet IDs

You need three Smartsheet IDs:

1. **Portfolio Sheet ID**: Master list of all projects
2. **WBS Template Sheet ID**: Template for new WBS sheets
3. **WBS Folder ID**: Folder where new sheets are created

### Getting Sheet IDs

1. Open the sheet in Smartsheet
2. Go to File > Properties
3. Copy the Sheet ID

### API Token

1. Log into Smartsheet
2. Go to Account > Personal Settings > API Access
3. Generate a new access token
4. Copy to `.env.local`

## Health Monitoring

The application exposes a health endpoint at `/api/healthz`:

```bash
curl http://localhost:3005/api/healthz
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": { "status": "pass" },
    "environment": { "status": "pass" },
    "smartsheet": { "status": "pass" }
  }
}
```

Use this endpoint for monitoring and alerting.

## Troubleshooting

### Database Connection Failed
- Verify DATABASE_URL in .env.local
- Check PostgreSQL server is running
- Verify network connectivity to database server
- Check firewall rules

### Smartsheet Sync Issues
- Verify SMARTSHEET_ACCESS_TOKEN is valid
- Check sheet IDs are correct
- Ensure API rate limits aren't exceeded
- Review application logs

### Application Won't Start
- Check Node.js is installed (node --version)
- Verify node_modules exists (run npm install)
- Check .env.local exists with required variables
- Review console output for errors

### Users Can't Login
- Verify user is in the USERS array
- Check password format (lastname123)
- Clear browser cache and cookies

## Support

For support:
1. Check the troubleshooting section above
2. Review application logs
3. Contact IT support

---

**EO WBS Task Manager** - Ohio Valley Electric Corporation

