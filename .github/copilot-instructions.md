# CMNetwork – Copilot Agent Instructions

## What This Repository Does
CMNetwork is a Centralized Financial Management & Accounting ERP system (academic project IT15L). It covers general ledger, AP/AR invoicing, bank reconciliation, budgets, payroll, expense claims, approvals, and audit logging. Full-stack: .NET 10 REST API backend + React 19 SPA frontend.

## Runtime & Tool Versions
- **Backend:** .NET 10 SDK, ASP.NET Core Web API
- **Frontend:** Node.js (LTS), npm, TypeScript 5, Vite 6, React 19
- **Database:** SQL Server — LocalDB for local dev; MonsterAsp.net SQL Server for production

## Repository Layout
```
CMNetwork.sln                        ← Solution entry point; always build from repo root
src/
  CMNetwork.Domain/                  ← Plain C# entity classes only, no EF/DI references
  CMNetwork.Application/             ← DependencyInjection.cs, thin service-contract layer
  CMNetwork.Infrastructure/          ← EF Core, Identity, Hangfire, seeders, services
    Persistence/
      CMNetworkDbContext.cs          ← IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
      Migrations/                    ← EF Core migrations (apply on startup automatically)
    Identity/                        ← ApplicationUser.cs, JwtTokenService.cs, RefreshToken.cs
    Seeding/DatabaseSeeder.cs        ← Seeds roles + default users on startup
    Data/Seeders/DemoDataSeeder.cs   ← Seeds sample business data
    DependencyInjection.cs           ← Registers EF, Identity, Hangfire, services
  CMNetwork.WebApi/                  ← ASP.NET Core app (entry point)
    Program.cs                       ← All service registration + middleware pipeline
    Controllers/                     ← Auth, Dashboard, Admin, AP/AR Invoices, Budget, etc.
    Middleware/                      ← GlobalExceptionMiddleware, ApiRequestLoggingMiddleware
    Services/                        ← IAuthService, IdentityAuthService, IDashboardService, etc.
    appsettings.json                 ← Production defaults (placeholders for secrets)
    appsettings.Development.json     ← LocalDB connection string, JWT placeholder
    Properties/launchSettings.json   ← HTTP :5128 / HTTPS :7210
  CMNetwork.ClientApp/               ← React + Vite SPA (separate build pipeline)
    src/services/apiClient.ts        ← Axios singleton; attaches JWT, handles refresh
    src/store/                       ← Zustand stores (authStore, currencyStore, etc.)
    src/pages/                       ← Route-level page components
    src/components/                  ← Shared UI components (Kendo React + Tailwind)
    vite.config.ts                   ← Proxy /api → http://localhost:5128
    eslint.config.js                 ← ESLint flat config (TS + react-hooks + react-refresh)
    tsconfig.app.json                ← strict, noUnusedLocals, noUnusedParameters, noEmit
Dockerfile                           ← Multi-stage .NET 10 build (kept for reference)
render.yaml                          ← Render config (superseded by MonsterAsp deploy)
```

## Building

### Backend — always run from the repo root
```bash
dotnet build CMNetwork.sln
```
Release publish (used by MonsterAsp GitHub deploy):
```bash
dotnet publish src/CMNetwork.WebApi/CMNetwork.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false
```
**Known issue:** MSB3021/MSB3027 "cannot copy CMNetwork.Infrastructure.dll" means the WebApi process is running and locking the output. Stop it first, then rebuild.

### Frontend — always `npm install` before building
```bash
cd src/CMNetwork.ClientApp
npm install
npm run build    # tsc -b && vite build
npm run lint     # must pass — tsc strict mode also enforces noUnusedLocals/Parameters
```

## Running Locally
1. **Backend:** `cd src/CMNetwork.WebApi && dotnet run` → `http://localhost:5128` (HTTP), `https://localhost:7210` (HTTPS).
2. **Frontend:** `cd src/CMNetwork.ClientApp && npm run dev` → Vite dev server on `http://localhost:5173`; `/api` is proxied to `http://localhost:5128`.
3. Override proxy target via `VITE_API_PROXY_TARGET` env var if needed (see `.env.example`).

## Database

### Development (LocalDB)
- Connection string in `appsettings.Development.json`: `Server=(localdb)\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True`
- Migrations and demo seeding run automatically on startup (`DatabaseSeeder` calls `MigrateAsync` + demo data seeds only in Development).
- To apply migrations manually from `src/CMNetwork.WebApi`:
  ```bash
  dotnet ef database update --project ../CMNetwork.Infrastructure/CMNetwork.Infrastructure.csproj
  ```
- To add a new migration:
  ```bash
  dotnet ef migrations add <Name> \
    --project src/CMNetwork.Infrastructure/CMNetwork.Infrastructure.csproj \
    --startup-project src/CMNetwork.WebApi/CMNetwork.WebApi.csproj
  ```

### Production (MonsterAsp.net)
- Deployed via **MonsterAsp GitHub deploy** (push to the linked branch triggers redeploy).
- Database: MonsterAsp SQL Server (`db49851.databaseasp.net`, database `db49851`).
- Switch to production DB by setting `Database:UseMonsterAsp=true` or env var `CMNETWORK_DB_MODE=MonsterAsp`.
- Connection string is provided as `ConnectionStrings__MonsterAspConnection` in the MonsterAsp environment config — do **not** hard-code credentials in source.
- **Demo data removed:** Migration `20260507000000_RemoveDemoData` cleans up all demo users, departments, and policies. Subsequent deployments skip demo seeding in Production.

## Configuration & Secrets
| Setting | Dev source | Prod source |
|---|---|---|
| JWT secret | .NET User Secrets (`UserSecretsId: c1fd1a7d-5ee0-4e91-b53a-0d8334dbb1d4`) | Env var `Jwt__Secret` |
| DB connection | `appsettings.Development.json` (`DefaultConnection` → LocalDB) | Env var `ConnectionStrings__MonsterAspConnection` (set in MonsterAsp dashboard) |
| PayMongo keys | User Secrets | Env vars `PayMongo__PublicKey` / `PayMongo__SecretKey` |
| CORS origins | `appsettings.json` `Cors:AllowedOrigins` | Env var `Cors__AllowedOrigins__0` etc. |

**DB selection logic (in `DependencyInjection.cs`):** if `Database:UseMonsterAsp=true` AND `MonsterAspConnection` is non-empty → uses `MonsterAspConnection`; otherwise falls back to `DefaultConnection`. In `appsettings.json`, `DefaultConnection` is currently set to the MonsterAsp production DB (`db49851.databaseasp.net`) — meaning a local run without the Development override will connect to the live production database. Use `appsettings.Development.json` (LocalDB) or set `CMNETWORK_DB_MODE=Local` to avoid writing to production data locally.

Never commit real credentials to `appsettings.json`; use environment variables or .NET User Secrets.

## Key Architecture Facts
- **Auth:** ASP.NET Identity + JWT bearer + refresh tokens + optional TOTP MFA. All business endpoints require `[Authorize]`.
- **Roles (seeded):** SuperAdmin, Admin, Accountant, Auditor, BudgetManager, BudgetOfficer, Employee, Vendor.
- **Audit trail:** `Audit.EntityFramework` (`[AuditDbContext]` on `CMNetworkDbContext`) — all DB changes captured automatically; do not remove this attribute.
- **Background jobs:** Hangfire with SQL Server storage (`SystemMaintenanceJobs`).
- **PDF:** QuestPDF. **Excel:** EPPlus — `ExcelPackage.LicenseContext = LicenseContext.NonCommercial` is set in `Program.cs` and must remain.
- **Frontend state:** Zustand stores. All HTTP calls go through `src/CMNetwork.ClientApp/src/services/apiClient.ts` which attaches `Authorization: Bearer <token>` and handles silent token refresh.
- **No test projects** in the solution — there is no `dotnet test` step.

## CI / Validation
No GitHub Actions workflows exist. Validate changes with these steps in order:
1. `dotnet build CMNetwork.sln` — 0 errors required.
2. `cd src/CMNetwork.ClientApp && npm install && npm run lint && npm run build` — 0 errors required (tsc strict).
3. Smoke-test: `GET /api/auth/health` returns HTTP 200 when the backend is running.

## Deployment
- **Production host:** MonsterAsp.net, deployed via GitHub integration (push triggers deploy).
- The `Dockerfile` and `render.yaml` in the repo root are kept for reference but are not the active deployment path.
- Health check endpoint: `GET /api/auth/health`.

---
Trust the information above. Only search the codebase if you need detail not covered here (e.g., the exact signature of a specific controller action or a migration column name).
