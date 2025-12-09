# EO WBS Task Manager

Work Breakdown Structure (WBS) Management System for Ohio Valley Electric - A focused tool for managing assigned WBS tasks that sync with your existing Smartsheet setup.

## 🚀 Features

- **Real Smartsheet Integration**: Direct sync with your actual Smartsheet sheets - no mock data
- **WBS Task Management**: Focused interface for managing assigned WBS tasks
- **User-Specific Filtering**: Users only see tasks assigned to them by email/last name
- **Assignee-Only Access**: All users are assignees by default (no mock roles)
- **Live Data Sync**: Changes sync directly to your Smartsheet sheets
- **Progress Tracking**: Visual progress indicators and status updates
- **Mobile Responsive**: Works on all devices for field updates
- **Simple Authentication**: Name-based login system with email matching

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Smartsheet API Access Token
- Azure AD App Registration (optional, can use local demo)

## 🛠️ Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd eo-orchestrator
npm install
```

### 2. Environment Setup

Copy the example environment file:
```bash
cp env.example .env.local
```

Configure your environment variables:
```env
# Database
DATABASE_URL=postgres://eo_app:password@localhost:5432/eo_orchestrator

# Authentication
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000

# Smartsheet Integration
SMARTSHEET_ACCESS_TOKEN=your_smartsheet_access_token

# Optional: Default Sheet IDs for quick sync
DEFAULT_PROJECTS_SHEET_ID=your_projects_sheet_id
DEFAULT_WBS_SHEET_ID=your_wbs_sheet_id
SMARTSHEET_PORTFOLIO_SHEET_ID=6732698911461252
SMARTSHEET_WBS_TEMPLATE_SHEET_ID=2074433216794500
SMARTSHEET_WBS_FOLDER_ID=4414766191011716

# Demo Mode (for development)
AUTH_LOCAL_DEMO=1
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma db push

# Seed with demo data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with demo credentials.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `NEXTAUTH_SECRET` | Random secret for JWT | Yes | - |
| `NEXTAUTH_URL` | App base URL | Yes | - |
| `APP_BASE_URL` | Public app URL | Yes | - |
| `SMARTSHEET_ACCESS_TOKEN` | Smartsheet API token | Yes | - |
| `SMARTSHEET_PORTFOLIO_SHEET_ID` | Portfolio sheet ID | Yes | - |
| `SMARTSHEET_WBS_TEMPLATE_SHEET_ID` | WBS template sheet ID | Yes | - |
| `SMARTSHEET_WBS_FOLDER_ID` | WBS folder ID | Yes | - |
| `AUTH_LOCAL_DEMO` | Enable local demo auth | No | `0` |
| `AAD_TENANT_ID` | Azure AD tenant ID | No* | - |
| `AAD_CLIENT_ID` | Azure AD client ID | No* | - |
| `AAD_CLIENT_SECRET` | Azure AD client secret | No* | - |
| `SMTP_HOST` | Email SMTP host | No | - |
| `SMTP_USER` | Email SMTP user | No | - |
| `SMTP_PASS` | Email SMTP password | No | - |
| `TEAMS_WEBHOOK_URL` | Teams webhook URL | No | - |

*Required if not using demo auth

## 📊 Demo Accounts

When `AUTH_LOCAL_DEMO=1`, use these accounts:

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| `admin@demo.com` | `admin123` | EO Engineer | Full access |
| `manager@demo.com` | `manager123` | Manager | Project management |
| `assignee@demo.com` | `assignee123` | Assignee | Task execution |
| `approver@demo.com` | `approver123` | Approver | Approval workflows |
| `creator@demo.com` | `creator123` | Creator | Project creation |

## 🏗️ Architecture

### Core Components

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with Prisma ORM
- **Database**: PostgreSQL with Prisma schema
- **Authentication**: NextAuth.js with Azure AD + local fallback
- **External APIs**: Smartsheet API with retry logic
- **Notifications**: Nodemailer + Microsoft Graph API

### Database Schema

```sql
-- Users with RBAC
users (id, email, name, role, createdAt)

-- Projects with full metadata
projects (id, portfolioRowId, projectCode, title, description, category, approverEmail, assigneeEmail, approvalStatus, status, wbsSheetId, wbsSheetUrl, wbsAppUrl, requiresWbs, lastUpdateAt, createdAt, updatedAt)

-- WBS cache for offline editing
wbs_cache (id, projectId, smartsheetRowId, parentRowId, name, description, ownerEmail, status, startDate, endDate, atRisk, budget, actual, variance, notes, skipWbs, orderIndex, lastSyncedAt)

-- Complete audit trail
audit (id, actorEmail, action, targetType, targetId, payload, createdAt)
```

## 🔄 API Endpoints

### Projects
- `GET /api/projects` - List projects with filtering
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `PUT /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

### WBS Management
- `GET /api/projects/[id]/wbs` - Get WBS items (with live sync option)
- `POST /api/projects/[id]/wbs` - Upsert WBS items
- `POST /api/projects/[id]/wbs/sync` - Sync WBS with Smartsheet

### Smartsheet Integration
- `POST /api/webhooks/portfolio` - Smartsheet webhook handler
- `POST /api/portfolio/poll` - Manual portfolio sync
- `GET /api/healthz` - Health check

### Automation
- `POST /api/cron/monday-updates` - Weekly notification cron

## 🚀 Deployment

### Option 1: Azure App Service + PostgreSQL

#### 1. Create Azure Resources

```bash
# Create resource group
az group create --name eo-orchestrator-rg --location eastus

# Create PostgreSQL server
az postgres server create --resource-group eo-orchestrator-rg --name eo-postgres --location eastus --admin-user eo_admin --admin-password <SECURE_PASSWORD> --sku-name B_Gen5_1 --version 13

# Create database
az postgres db create --resource-group eo-orchestrator-rg --server-name eo-postgres --name eo_orchestrator

# Create App Service
az appservice plan create --name eo-app-plan --resource-group eo-orchestrator-rg --location eastus --sku B1
az webapp create --name eo-orchestrator --resource-group eo-orchestrator-rg --plan eo-app-plan --runtime "NODE:18-lts"
```

#### 2. Configure Environment Variables

```bash
az webapp config appsettings set --name eo-orchestrator --resource-group eo-orchestrator-rg --setting WEBSITE_NODE_DEFAULT_VERSION=18.17.1
az webapp config appsettings set --name eo-orchestrator --resource-group eo-orchestrator-rg --settings @env.prod.json
```

#### 3. Deploy

```bash
# Build and deploy
npm run build
az webapp deployment source config-zip --name eo-orchestrator --resource-group eo-orchestrator-rg --src dist.zip
```

### Option 2: On-Premises IIS Reverse Proxy

#### 1. Server Requirements

- Windows Server 2019/2022
- IIS with URL Rewrite module
- Node.js 18+ installed
- PostgreSQL 13+ database

#### 2. IIS Configuration

Install IIS features:
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpErrors, IIS-HttpLogging, IIS-RequestFiltering, IIS-StaticContent, IIS-DefaultDocument, IIS-DirectoryBrowsing, IIS-WebSockets, IIS-ApplicationInit, IIS-ISAPIExtensions, IIS-ISAPIFilter, IIS-ServerSideIncludes, IIS-HealthAndDiagnostics, IIS-HttpTracing, IIS-Security, IIS-RequestFiltering, IIS-URLAuthorization, IIS-IPSecurity, IIS-Performance, IIS-HttpCompressionStatic, IIS-WebServerManagementTools, IIS-ManagementConsole
```

#### 3. Application Setup

```powershell
# Create application directory
New-Item -ItemType Directory -Path "C:\inetpub\eo-orchestrator" -Force

# Set permissions
icacls "C:\inetpub\eo-orchestrator" /grant "IIS_IUSRS:(OI)(CI)F" /T

# Configure IIS site
New-WebSite -Name "EO Orchestrator" -PhysicalPath "C:\inetpub\eo-orchestrator" -Port 80 -ApplicationPool "DefaultAppPool"
```

#### 4. Reverse Proxy Configuration

Create `web.config` in application root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Reverse Proxy to Node.js" stopProcessing="true">
          <match url="(.*)" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="104857600" />
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

#### 5. SSL Configuration (Optional)

```powershell
# Get SSL certificate thumbprint
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*yourdomain.com*" }

# Bind SSL certificate
New-WebBinding -Name "EO Orchestrator" -Protocol https -Port 443 -SslFlags 1
$binding = Get-WebBinding -Name "EO Orchestrator" -Protocol https
$binding.AddSslCertificate($cert.Thumbprint, "my")
```

#### 6. Windows Service Setup

Create a Windows service to run the Node.js application:

```powershell
# Install NSSM (Non-Sucking Service Manager)
# Download from https://nssm.cc/download
# Create service
nssm install EOOrchestrator "C:\Program Files\nodejs\node.exe"
nssm set EOOrchestrator AppParameters "C:\inetpub\eo-orchestrator\server.js"
nssm set EOOrchestrator AppDirectory "C:\inetpub\eo-orchestrator"
nssm set EOOrchestrator AppStdout "C:\inetpub\eo-orchestrator\logs\stdout.log"
nssm set EOOrchestrator AppStderr "C:\inetpub\eo-orchestrator\logs\stderr.log"
nssm set EOOrchestrator Start SERVICE_AUTO_START

# Start service
nssm start EOOrchestrator
```

### Option 3: Cloudflare Tunnel for Webhooks

For secure webhook handling without exposing internal services:

#### 1. Install cloudflared

```bash
# Download and install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### 2. Authenticate

```bash
cloudflared tunnel login
```

#### 3. Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create eo-orchestrator-tunnel

# Create DNS record
cloudflared tunnel route dns eo-orchestrator-tunnel webhooks.yourdomain.com

# Create config file
cat > ~/.cloudflared/config.yml << EOF
tunnel: eo-orchestrator-tunnel
credentials-file: ~/.cloudflared/eo-orchestrator-tunnel.json

ingress:
  - hostname: webhooks.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

#### 4. Start Tunnel

```bash
cloudflared tunnel run eo-orchestrator-tunnel
```

## 🔐 Security

### Authentication & Authorization

- **Azure AD Integration**: Enterprise SSO with fallback to local demo
- **RBAC**: Five distinct roles with granular permissions
- **Session Management**: Secure JWT tokens with proper expiration
- **Audit Logging**: Complete trail of all user actions

### Data Protection

- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Protection**: Next.js built-in sanitization
- **CSRF Protection**: NextAuth.js CSRF tokens

### Network Security

- **HTTPS Enforcement**: SSL/TLS for all connections
- **API Rate Limiting**: Built-in request throttling
- **CORS Configuration**: Proper cross-origin policies
- **Security Headers**: Comprehensive HTTP security headers

## 📈 Monitoring & Observability

### Health Checks

- `GET /api/healthz` - Application health status
- Database connectivity verification
- External API availability checks

### Logging

- **Structured Logging**: Pino logger with JSON output
- **Request IDs**: Correlation IDs for request tracing
- **Error Tracking**: Comprehensive error logging
- **Performance Monitoring**: Response time tracking

### Metrics

- Application performance metrics
- Database query performance
- External API response times
- Error rates and patterns

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Test Coverage

- API route testing
- Component testing
- Integration testing
- Smartsheet API mocking

## 🔧 Development

### Code Quality

- **ESLint**: Code linting and formatting
- **TypeScript**: Type safety and IntelliSense
- **Prettier**: Consistent code formatting
- **Husky**: Git hooks for quality gates

### Database Management

```bash
# View database
npx prisma studio

# Create migration
npx prisma migrate dev --name your_migration_name

# Reset database
npx prisma migrate reset
```

### API Documentation

Interactive API documentation available at `/api/docs` when in development mode.

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check DATABASE_URL
   # Verify PostgreSQL is running
   # Check connection permissions
   ```

2. **Smartsheet API Errors**
   ```bash
   # Verify SMARTSHEET_ACCESS_TOKEN
   # Check sheet IDs are correct
   # Confirm API rate limits
   ```

3. **Authentication Issues**
   ```bash
   # Check NEXTAUTH_SECRET
   # Verify Azure AD configuration
   # Confirm callback URLs
   ```

4. **Build Failures**
   ```bash
   # Clear node_modules: rm -rf node_modules && npm install
   # Clear Next.js cache: rm -rf .next
   # Check TypeScript errors: npm run type-check
   ```

### Logs and Debugging

```bash
# View application logs
tail -f logs/application.log

# View database logs
tail -f logs/database.log

# Enable debug mode
DEBUG=* npm run dev
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Smartsheet API Documentation](https://smartsheet-platform.github.io/api-docs/)
- [Azure AD Integration Guide](https://docs.microsoft.com/en-us/azure/active-directory/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section above

---

**EO Project Orchestrator** - Streamlining enterprise project management with modern web technologies and seamless Smartsheet integration.
