# CMNetwork Deployment Runbook

> Audience: developers and administrators deploying CMNetwork to MonsterAsp.net.

---

## Table of Contents

1. [Environment Overview](#environment-overview)
2. [Configuration & Secrets](#configuration--secrets)
3. [Database Mode Switching](#database-mode-switching)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Deployment Process (GitHub → MonsterAsp)](#deployment-process-github--monsterasp)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedure](#rollback-procedure)
8. [Migration Reference](#migration-reference)
9. [Common Issues](#common-issues)

---

## Environment Overview

| Layer | Local Dev | Production |
|---|---|---|
| Runtime | .NET 10 SDK | .NET 10 runtime (MonsterAsp IIS) |
| Database | SQL Server LocalDB | SQL Server on `db49851.databaseasp.net` |
| SPA | Vite dev server `:5173` | Bundled into `wwwroot/` inside publish artifact |
| Auth secret | .NET User Secrets | Env var `Jwt__Secret` on MonsterAsp dashboard |
| DB connection | `appsettings.Development.json` | Env var `ConnectionStrings__MonsterAspConnection` |

---

## Configuration & Secrets

### Required environment variables on MonsterAsp

| Variable | Purpose |
|---|---|
| `Jwt__Secret` | JWT signing secret (min 32 chars, high entropy) |
| `ConnectionStrings__MonsterAspConnection` | Full connection string to `db49851.databaseasp.net` |
| `Database__UseMonsterAsp` | Set to `true` to activate the production connection string |
| `Cors__AllowedOrigins__0` | Primary allowed CORS origin (e.g. `https://cmnetwork.monsterasp.net`) |
| `PayMongo__PublicKey` _(if used)_ | PayMongo public key |
| `PayMongo__SecretKey` _(if used)_ | PayMongo secret key |

> **Never** commit real credentials to `appsettings.json`. Use the MonsterAsp environment variable dashboard or .NET User Secrets locally.

### Local Development override

`src/CMNetwork.WebApi/appsettings.Development.json` must contain:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

The startup guard in `Program.cs` will log a `Critical` warning if the Development environment points to `db49851.databaseasp.net`. **Stop immediately if you see that warning.**

---

## Database Mode Switching

Selection logic in `DependencyInjection.cs`:

```
Database:UseMonsterAsp == true  AND  MonsterAspConnection is non-empty
    → uses MonsterAspConnection  (production)
    
Otherwise
    → uses DefaultConnection  (LocalDB or override)
```

To connect **locally to LocalDB** (normal dev workflow): ensure `appsettings.Development.json` has `DefaultConnection` pointing to LocalDB and do **not** set `Database:UseMonsterAsp=true`.

To connect **locally to production DB** ⚠ (rare, dangerous — read-only verification only):
1. Set `Database__UseMonsterAsp=true` and `ConnectionStrings__MonsterAspConnection=<prod-string>` as environment variables.
2. Never run `dotnet ef database update` in this mode.
3. Confirm the startup Critical log fires and immediately restore local config.

---

## Pre-Deployment Checklist

Run before every deployment, especially those containing migrations.

### Code

- [ ] `dotnet build CMNetwork.sln` → **0 errors**
- [ ] `cd src/CMNetwork.ClientApp && npm run lint` → **0 errors**
- [ ] `cd src/CMNetwork.ClientApp && npm run build` → success

### Database / Migrations

- [ ] Review every new migration's `Up()` — confirm it is reversible
- [ ] Review every new migration's `Down()` — confirm it restores previous state correctly
- [ ] No `DropColumn` or `DropTable` in `Up()` without a data-preservation plan
- [ ] Test `dotnet ef database update` against a LocalDB restore of the last production schema snapshot

### Security

- [ ] No credentials committed to source control (check `git diff --staged`)
- [ ] JWT secret is high-entropy (≥ 32 characters, not a dictionary word)
- [ ] Password policy is enforced in `DependencyInjection.cs` (RequiredLength ≥ 12, upper, lower, digit, non-alphanumeric)
- [ ] CORS `AllowedOrigins` does not contain `*` in production

### Smoke Test

- [ ] Backend running locally: `dotnet run --project src/CMNetwork.WebApi`
- [ ] `.\smoke-test.ps1 -Password <accountant-password>` → all checks pass
- [ ] `GET /api/auth/health` → 200

---

## Deployment Process (GitHub → MonsterAsp)

### 1. Build frontend

```powershell
cd src/CMNetwork.ClientApp
npm install
npm run lint      # must pass
npm run build     # output → dist/
```

The Vite build output (`dist/`) is not committed to git. MonsterAsp's build process or a pre-deploy script must copy it to `src/CMNetwork.WebApi/wwwroot/` before publish, OR the solution must be published with SPA files already embedded.

> **Current workflow:** `npm run build` output is manually copied to `wwwroot/` before the MonsterAsp GitHub deploy trigger. Verify `src/CMNetwork.WebApi/wwwroot/index.html` exists in the latest published artifact.

### 2. Trigger deploy

Push to the MonsterAsp-linked branch (typically `main`). MonsterAsp runs:

```
dotnet publish src/CMNetwork.WebApi/CMNetwork.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false
```

### 3. Automatic migration on startup

`Program.cs` calls `db.Database.MigrateAsync()` on startup. All pending migrations are applied to the production database automatically. No manual `ef database update` step is needed.

---

## Post-Deployment Verification

1. **Health check:** `GET https://<prod-host>/api/auth/health` → `200 OK`
2. **Login:** POST to `/api/auth/login` with a known admin account → receive `accessToken`
3. **Dashboard:** `GET /api/dashboard/accountant/metrics` → `200 OK` with metric list
4. **Run smoke test against production:**
   ```powershell
   .\smoke-test.ps1 -BaseUrl https://<prod-host> -Password <accountant-password>
   ```
5. Check MonsterAsp application logs for any `Critical` or `Error` entries within the first 2 minutes of startup.

---

## Rollback Procedure

### Code rollback

MonsterAsp does not have one-click rollback. To revert:

1. `git revert HEAD` (creates a new commit reversing the last change) or `git checkout <previous-commit>` on a new branch.
2. Push the revert branch as the new deploy branch.

### Database rollback

EF Core migration rollback targets the last known-good migration name.

**From a local environment connected to the production DB (extreme caution):**

```powershell
dotnet ef database update <PreviousMigrationName> \
  --project src/CMNetwork.Infrastructure/CMNetwork.Infrastructure.csproj \
  --startup-project src/CMNetwork.WebApi/CMNetwork.WebApi.csproj
```

> This calls each migration's `Down()` method in reverse order. Verify `Down()` is correct before deploying the migration.

**Migration names (most recent first):**

| # | Name |
|---|---|
| 14 | `AddIndexesAndFkHardening` |
| 13 | _(previous — run `dotnet ef migrations list` to view all)_ |

To view all applied migrations on the production DB:

```sql
SELECT MigrationId, ProductVersion FROM [__EFMigrationsHistory] ORDER BY MigrationId DESC;
```

---

## Migration Reference

### AddIndexesAndFkHardening (Migration 14)

**Up:** Adds composite indexes on AP/AR/GL/Approvals, adds explicit FK from `ExpenseClaims.EmployeeId` → `AspNetUsers.Id` with Restrict delete.

**Down:** Drops the new indexes, reinstates original 2-column AP/AR indexes, drops the FK constraint.

**Risk level:** Low — index additions are non-destructive. FK addition is safe if `ExpenseClaims.EmployeeId` already references a valid user (which it must — seeded data is valid).

---

## Common Issues

### MSB3021/MSB3027: Cannot copy CMNetwork.Infrastructure.dll

The WebApi process is locking the output DLL. Stop the running process then rebuild.

### "⚠ DANGER: The Development environment is connected to the PRODUCTION database"

`appsettings.json` `DefaultConnection` points to `db49851.databaseasp.net` and `appsettings.Development.json` is missing or overridden. Fix `appsettings.Development.json` to use LocalDB.

### Hangfire dashboard returns 404

Only accessible at `/hangfire` and only when the WebApi is running. Verify `UseHangfireDashboard("/hangfire")` is in the middleware pipeline.

### JWT 401 after deployment

The `Jwt__Secret` environment variable is not set on MonsterAsp, or it changed between deployments (invalidating all existing tokens). Set a stable, high-entropy secret in the MonsterAsp dashboard.

### SPA returns 404 on page refresh

`UseDefaultFiles()` and `UseStaticFiles()` must be in the pipeline, and the catch-all route `app.MapFallbackToFile("index.html")` must be registered. Check `Program.cs`.
