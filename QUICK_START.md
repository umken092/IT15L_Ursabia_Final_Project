# 🚀 CMNetwork ERP - Quick Start Guide

## System Architecture

```
Browser (http://localhost:5173)
    ↓
React Frontend (Vite)
    ↓
Axios HTTP Client + Auth Interceptors
    ↓
.NET Core Web API (https://localhost:7210/api)
    ↓
Application + Infrastructure + EF Core + Hangfire
    ↓
SQL Server / LocalDB (CMNetwork)
```

## Solution Structure

```text
CMNetwork.sln
src/
  CMNetwork.Domain/
  CMNetwork.Application/
  CMNetwork.Infrastructure/
  CMNetwork.WebApi/
  CMNetwork.ClientApp/
```

## Database Structure (Compact ERD Text Map)

Target instance for this project:

```text
Server: (localdb)\MSSQLLocalDB
Database: CMNetwork
```

Core business/auth tables:

```text
Departments
    PK: Id
    Key columns: Code, Name, BudgetAmount, Description
    Relationships: none (current schema)

AspNetUsers
    PK: Id
    Key columns: Email, FirstName, LastName, DepartmentId, IsActive, JoinDate
    Relationships: referenced by RefreshTokens.UserId, AspNetUserRoles.UserId

RefreshTokens
    PK: Id
    Key columns: UserId, Token, ExpiresUtc, IsRevoked
    Relationships:
        RefreshTokens.UserId -> AspNetUsers.Id

ChartOfAccounts
    PK: Id
    Key columns: AccountCode, Name, Type, ParentAccountId, IsActive
    Relationships:
        ChartOfAccounts.ParentAccountId -> ChartOfAccounts.Id (self hierarchy)

FiscalPeriods
    PK: Id
    Key columns: Name, StartDate, EndDate, IsClosed
    Relationships: none (current schema)

JournalEntries
    PK: Id
    Key columns: EntryNumber, EntryDate, Description, ReferenceNo, Status, CreatedBy, PostedBy
    Relationships: referenced by JournalEntryLines.JournalEntryId

JournalEntryLines
    PK: Id
    Key columns: JournalEntryId, AccountId, Description, Debit, Credit
    Relationships:
        JournalEntryLines.JournalEntryId -> JournalEntries.Id
        JournalEntryLines.AccountId -> ChartOfAccounts.Id

AuditLogs
    PK: Id
    Key columns: EntityName, Action, PerformedBy, DetailsJson, CreatedUtc
    Relationships: none (current schema)

BackupRecords
    PK: Id
    Key columns: StartedUtc, Status, SizeInMb, DurationSeconds
    Relationships: none (current schema)

SecurityPolicies
    PK: Id
    Key columns: Name, Description, IsEnabled, Value
    Relationships: none (current schema)

IntegrationSettings
    PK: Id
    Key columns: Name, Status, Endpoint, LastSyncUtc
    Relationships: none (current schema)
```

Identity link tables:

```text
AspNetUserRoles
    Composite PK: UserId + RoleId
    Relationships:
        AspNetUserRoles.UserId -> AspNetUsers.Id
        AspNetUserRoles.RoleId -> AspNetRoles.Id
```

Runtime support tables:

```text
__EFMigrationsHistory (EF Core migration tracking)
HangFire.* (background job processing)
```

## Code Module Dependency Map (Controller -> Service -> Data)

```text
AuthController (api/auth)
    -> IAuthService (IdentityAuthService)
    -> UserManager<ApplicationUser>, SignInManager<ApplicationUser>, JwtTokenService, CMNetworkDbContext
    -> Tables: AspNetUsers, AspNetUserRoles, AspNetRoles, RefreshTokens

DashboardController (api/dashboard)
    -> IDashboardService (DashboardService)
    -> Currently returns role-based dashboard data from service logic
    -> No direct DbContext dependency in current implementation

GeneralLedgerController (api/general-ledger)
    -> Direct dependency: CMNetworkDbContext
    -> Tables: ChartOfAccounts, FiscalPeriods, JournalEntries, JournalEntryLines
    -> Features: accounts, fiscal periods, month-end checklist/close, journal create/post/list/export, trial balance

Global middleware
    -> GlobalExceptionMiddleware
    -> Cross-cutting error handling for API pipeline
```

Data and domain flow:

```text
Controllers (CMNetwork.WebApi)
    -> Services (CMNetwork.WebApi/Services) and/or CMNetworkDbContext
    -> Infrastructure (CMNetwork.Infrastructure/Persistence, Identity, Seeding)
    -> Domain entities (CMNetwork.Domain/Entities)
```

## Prerequisites

- ✅ **Visual Studio 2022** with ASP.NET and web development workload
- ✅ **Node.js 18+** with npm → Download: https://nodejs.org/
- ✅ **.NET 10.0 SDK** → Download: https://dotnet.microsoft.com/download
- ✅ **SQL Server Management Studio (SSMS)** → Download: https://aka.ms/ssmsfullsetup
- ✅ **Visual Studio Code** (optional) or Visual Studio 2022

## Verify Installation

```powershell
# Check Node.js
node --version    # Should be v18+
npm --version     # Should be 9+

# Check .NET
dotnet --version  # Should be 10.0+
```

---

## 🔥 Quick Start (Recommended)

Before first run, restore the backend and frontend dependencies:

```powershell
cd c:\Users\kennu\CMNetwork
dotnet restore .\CMNetwork.sln
cd .\src\CMNetwork.ClientApp
npm install
```

### Option A: Automated Start (Windows)

Double-click one of these files in File Explorer:

1. **START_CMNETWORK.bat** (Command Prompt)
2. **START_CMNETWORK.ps1** (PowerShell - Right-click → Run with PowerShell)

This will automatically:
- Start the backend API on `https://localhost:7210/api`
- Start the frontend dev server on `http://localhost:5173/`
- Open two terminal windows

### Option B: Manual Start

**Terminal 1 - Backend (.NET Web API)**
```powershell
cd c:\Users\kennu\CMNetwork
dotnet run --launch-profile https --project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
# Output: Now listening on: https://localhost:7210
```

**Terminal 2 - Frontend (React + Vite)**
```bash
cd c:\Users\kennu\CMNetwork\src\CMNetwork.ClientApp
npm run dev
# Output: Local: http://localhost:5173/
```

### Terminal 3 (Optional) - View Logs
```bash
# If you want to monitor both processes in real-time
# Leave terminals 1 and 2 running in the background
```

---

## 🎯 Testing the Full Stack

1. Open browser: **http://localhost:5173/**

2. Click **"Get Started"** on the landing page → Redirects to login

3. Enter credentials:
   - **Email:** `accountant@cmnetwork.com`
    - **Password:** `Demo123!`

4. Click **Login** → You should see:
   - JWT token generated by backend
   - Redirect to Accountant dashboard
   - Real API data loaded (not mock)

5. **Test Role Switcher** (if multi-role):
   - Login with: `multi-cfo-accountant@cmnetwork.com`
   - Look for **role switcher dropdown** in sidebar footer
   - Switch between CFO and Accountant roles
   - Dashboard and menu update instantly

6. **Monitor Network** (DevTools):
   - Press **F12** → Network tab
   - Login → See POST `/api/auth/login` request
   - Switch dashboards → See GET `/api/dashboard/{role}/metrics` request
    - Verify requests go to `https://localhost:7210/api`

---

## 📚 Detailed Guides

- **[BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)** - Comprehensive backend setup, API endpoints, architecture
- **[src/CMNetwork.ClientApp/README.md](./src/CMNetwork.ClientApp/README.md)** - Frontend architecture, components, running instructions
- **[src/CMNetwork.ClientApp/.env.example](./src/CMNetwork.ClientApp/.env.example)** - Frontend environment configuration template

---

## 🧱 Next Step Setup

### 1. Initialize the Solution

The repository now uses a layered solution:

```powershell
cd c:\Users\kennu\CMNetwork
dotnet restore .\CMNetwork.sln
dotnet build .\CMNetwork.sln
```

### 2. Database Setup (SSMS + EF Core)

Install **SSMS**, then verify the `CMNetwork` database exists on your local SQL Server or LocalDB instance.

The initial EF Core migration has already been created and applied in this workspace.

To recreate or apply locally:

```powershell
cd c:\Users\kennu\CMNetwork
dotnet ef migrations add InitialCreate --project .\src\CMNetwork.Infrastructure\CMNetwork.Infrastructure.csproj --startup-project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj --output-dir Persistence\Migrations
dotnet ef database update --project .\src\CMNetwork.Infrastructure\CMNetwork.Infrastructure.csproj --startup-project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
```

Default development connection string:

```text
Server=(localdb)\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true
```

### 3. Tools Install Checklist

Install and verify the following on a development machine:

- **Visual Studio 2022** with ASP.NET and web workload
- **Node.js 18+**
- **Vite** via project local dependency in `src/CMNetwork.ClientApp`
- **KendoReact license activation**
- **Hangfire** backend package references
- **Audit.NET** backend package references
- **EF Core CLI** via `dotnet ef --version`

KendoReact license activation example:

```bash
cd c:\Users\kennu\CMNetwork\src\CMNetwork.ClientApp
npx kendo-ui-license activate
```

### 4. Secrets Management

Development secrets must live in **.NET User Secrets** for the Web API project.

Already configured in this workspace:

```powershell
cd c:\Users\kennu\CMNetwork
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=(localdb)\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true" --project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
dotnet user-secrets set "Jwt:Secret" "dev-cmnetwork-jwt-secret-minimum-32-chars" --project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
dotnet user-secrets set "PayMongo:PublicKey" "pk_test_replace_me" --project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
dotnet user-secrets set "PayMongo:SecretKey" "sk_test_replace_me" --project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
```

Production must use environment variables or secure secret storage, not appsettings:

```powershell
$env:ConnectionStrings__DefaultConnection="<production-connection-string>"
$env:ConnectionStrings__MonsterAspConnection="<monsterasp-connection-string>"
$env:CMNETWORK_DB_MODE="Local" # or "MonsterAsp"
$env:Jwt__Secret="<production-jwt-secret>"
$env:PayMongo__PublicKey="<production-paymongo-public-key>"
$env:PayMongo__SecretKey="<production-paymongo-secret-key>"
```

Database mode selection precedence:

1. `CMNETWORK_DB_MODE` environment variable (`Local` or `MonsterAsp`)
2. `Database:UseMonsterAsp` from appsettings/user-secrets
3. Local connection fallback (`ConnectionStrings:DefaultConnection`)

Quick switch examples (PowerShell):

```powershell
# Use local database
$env:CMNETWORK_DB_MODE="Local"

# Use MonsterAsp database (make sure ConnectionStrings__MonsterAspConnection is set)
$env:CMNETWORK_DB_MODE="MonsterAsp"
```

---

## ✅ Validate & Freeze Scope

Use this section as the final review baseline with **Finance**, **IT**, and **Audit** before accepting additional changes.

### Scope Freeze Baseline

- **Source of truth for roles**: `src/CMNetwork.ClientApp/src/types/auth.ts`
- **Source of truth for navigation**: `src/CMNetwork.ClientApp/src/services/navigationService.ts`
- **Source of truth for guarded access**: `src/CMNetwork.ClientApp/src/components/RoleGuard.tsx`
- **Source of truth for module descriptions**: `src/CMNetwork.ClientApp/src/pages/ModulePlaceholderPage.tsx`

No wireframe, mockup, or Figma artifact is currently present in this repository. The approval baseline for UI/UX should therefore be the implemented dashboards, navigation structure, and module descriptions already in the app.

### Final Role List (7 Roles)

| Role | Primary Scope | Approved Modules |
|------|---------------|------------------|
| Super Admin | Platform administration and configuration | User Management, System Settings |
| Accountant | Core accounting operations | General Ledger, Accounts Payable, Accounts Receivable, Bank Reconciliation, Reports |
| Faculty Admin | Department-level budget and approval oversight | Department Report, Approvals Queue, Budget & Cost Control |
| Employee | Self-service HR/finance actions | Expense Claims, Payslips, Profile |
| Authorized Viewer | Read-only executive visibility | Executive Summary |
| Auditor | Compliance review and evidence gathering | Audit Logs, Reports |
| CFO | Executive approvals and budget oversight | Approval Inbox, Budget Control, Reports |

### Stakeholder Review Checklist

**Finance must confirm:**
- Accountant workflows cover journal entry, AP, AR, bank reconciliation, and reporting.
- CFO scope is limited to executive approvals, budget control, and reporting.
- Faculty Admin and Employee financial self-service boundaries are correct.

**IT must confirm:**
- Super Admin scope covers user management, security policy, backup/restore, and integrations through System Settings.
- Route guards and navigation match the approved role boundaries.
- No additional roles or cross-role module access are required for go-live.

**Audit must confirm:**
- Auditor access is limited to audit evidence and reporting surfaces.
- Audit Logs remain isolated from operational users.
- Export and review flows satisfy compliance review expectations.

### UI/UX Sign-Off Rule

Because there is no separate wireframe package in the repo, UI/UX sign-off should be based on the implemented experience:

- Landing → Login → Role Dashboard flow
- Left navigation per role
- Module titles, summaries, stats, actions, and records
- Dashboard quick actions for Super Admin, Accountant, Faculty Admin, Employee, Authorized Viewer, Auditor, and CFO

### Approval Record

| Stakeholder Group | Area Reviewed | Decision | Date | Notes |
|------------------|---------------|----------|------|-------|
| Finance | Role scope and finance workflows | Pending | ____ | ____ |
| IT | Access control, environment, admin scope | Pending | ____ | ____ |
| Audit | Audit visibility, evidence flow, segregation | Pending | ____ | ____ |

### Freeze Rule

After sign-off, treat the following as frozen unless a change request is approved:

- The 7-role model
- Module-to-role permissions
- Dashboard/menu structure
- Module descriptions and primary user actions
- Super Admin operational scope

---

## 🧪 Test Users

Pre-configured test accounts (password for all users: `Demo123!`):

| Email | Role | Notes |
|-------|------|-------|
| `super-admin@cmnetwork.com` | Super Admin | System configuration access |
| `accountant@cmnetwork.com` | Accountant | Invoice & reconciliation dashboard |
| `faculty-admin@cmnetwork.com` | Faculty Admin | Department budget dashboard |
| `employee@cmnetwork.com` | Employee | Personal payroll & expense claims |
| `viewer@cmnetwork.com` | Authorized Viewer | Read-only analytics dashboard |
| `auditor@cmnetwork.com` | Auditor | Audit log dashboard |
| `cfo@cmnetwork.com` | CFO | Executive dashboard |
| `multi-cfo-accountant@cmnetwork.com` | CFO + Accountant | **Multi-role user** (test role switcher) |

## 🔧 Troubleshooting

### Frontend can't connect to backend

**Symptom:** Login page loads, but login or data requests fail

**Fix:**
1. Verify backend is running: `netstat -ano | findstr :7210`
2. Check frontend `.env.local`: Should have `VITE_API_URL=https://localhost:7210/api`
3. Check browser DevTools **Network** tab for CORS errors
4. Verify `.NET Core SSL certificate is trusted` (should be auto-added by Visual Studio)

### SSL Certificate Error

**Symptom:** `System.Net.Http.HttpRequestException: SSL/TLS connection error`

**Fix:**
```powershell
# Trust local dev certificate
dotnet dev-certs https --trust
```

### Port Already in Use

**Symptom:** `OSError: Address already in use` or `EADDRINUSE`

**Backend (7210):**
```powershell
netstat -ano | findstr :7210
taskkill /PID <PID> /F
```

**Frontend (5173):**
```bash
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Node Modules Not Found

**Fix:**
```bash
cd c:\Users\kennu\CMNetwork\src\CMNetwork.ClientApp
rm -r node_modules package-lock.json
npm install
npm run dev
```

### .NET Build Error

**Fix:**
```powershell
cd c:\Users\kennu\CMNetwork
dotnet clean .\CMNetwork.sln
dotnet build .\CMNetwork.sln
dotnet run --launch-profile https --project .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj
```

---

## 📊 API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/login` | ❌ | User login (returns JWT) |
| POST | `/api/auth/logout` | ✅ | User logout |
| POST | `/api/auth/validate` | ❌ | Validate JWT token |
| GET | `/api/auth/health` | ❌ | Health check |
| GET | `/api/dashboard/{role}/metrics` | ✅ | Role-specific KPIs |
| GET | `/api/dashboard/charts` | ✅ | Chart data (6-month revenue/expenses) |
| GET | `/api/dashboard/approvals` | ✅ | Pending approvals |
| GET | `/api/dashboard/audit-activities` | ✅ | Audit log |
| GET | `/api/dashboard/health` | ❌ | Health check |

---

## 📦 Production Build

### Build Frontend (Vite)
```bash
cd c:\Users\kennu\CMNetwork\src\CMNetwork.ClientApp
npm run build
# Output: dist/ (optimized bundles with code splitting)
```

### Deploy Backend
```powershell
cd c:\Users\kennu\CMNetwork
dotnet publish .\src\CMNetwork.WebApi\CMNetwork.WebApi.csproj -c Release -o .\publish
# Output: .\publish\ (ready for IIS, Docker, or Linux)
```

---

## 🛠️ Development Tips

### Hot Module Replacement (Frontend)
- Edit any React component in `src/`
- Changes auto-reload in browser (no manual refresh needed)
- State persists during HMR

### Backend Auto-Reload (Optional)
Install dotnet-watch:
```powershell
dotnet tool install -g dotnet-watch
cd c:\Users\kennu\CMNetwork
dotnet watch run  # Auto-restarts on file changes
```

### Debug in VS Code
1. Open `c:\Users\kennu\CMNetwork` as root workspace
2. Frontend debugger: `F5` (needs VS Code launch config)
3. Backend debugger: Attach to `dotnet` process via C# extension

### Monitor Network Requests
- Frontend: Browser DevTools → Network tab (F12)
- Backend: Check terminal output for request logs
- Add detailed logging: Edit `Program.cs` to configure Serilog

---

## 📝 Next Steps

1. ✅ **Run both services** using Quick Start above
2. ✅ **Test user login** with test account
3. ✅ **Verify API calls** in browser DevTools
4. ✅ **Test role switcher** (multi-role user)
5. ✅ **Review BACKEND_INTEGRATION.md** for architecture details
6. 🔄 **Tune dashboard metrics** in `src/CMNetwork.WebApi/Services/DashboardService.cs`
7. 🔄 **Address package vulnerability warnings** (NU1903 in Infrastructure dependencies)
8. 🔄 **Generate API documentation** (Swagger/OpenAPI)
9. 🔄 **Add integration tests** for auth, admin, AP/AR, and dashboard endpoints
10. 🚀 **Deploy to production** (IIS, Azure, Docker)

---

## 📞 Quick Support

- **404 Page Not Found:** Check API endpoint URLs match `/api/dashboard/{role}/metrics` pattern
- **401 Unauthorized:** Token expired or invalid; clear localStorage & re-login
- **503 Service Unavailable:** Backend not running; start backend first
- **Mixed Content Warning:** Ensure frontend `.env.local` uses `https://` for backend URL

---

**Happy Coding! 🎉**

Questions? Check [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md) for full documentation.
