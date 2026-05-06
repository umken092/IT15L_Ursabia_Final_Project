# Contributing to CMNetwork

CMNetwork is an academic ERP project (IT15L). This document is the single source of truth for how code flows from editor to production.

---

## Table of Contents

1. [Quick Setup](#1-quick-setup)
2. [Branch Naming and Merge Policy](#2-branch-naming-and-merge-policy)
3. [Conventional Commit Standard](#3-conventional-commit-standard)
4. [Definition of Done — Merge Readiness](#4-definition-of-done--merge-readiness)
5. [Accounting-Risk Change Rules](#5-accounting-risk-change-rules)
6. [Review Ownership Matrix](#6-review-ownership-matrix)
7. [Secrets and Artifacts Hygiene](#7-secrets-and-artifacts-hygiene)
8. [Database Changes](#8-database-changes)
9. [API Error Responses](#9-api-error-responses)

---

## 1. Quick Setup

```powershell
# Backend
cd src/CMNetwork.WebApi
dotnet run        # http://localhost:5128

# Frontend (separate terminal)
cd src/CMNetwork.ClientApp
npm install
npm run dev       # http://localhost:5173
```

See [QUICK_START.md](QUICK_START.md) for LocalDB and JWT User Secrets setup.

---

## 2. Branch Naming and Merge Policy

### Branch Names

| Type | Pattern | Example |
|---|---|---|
| Feature / new endpoint | `feat/<short-description>` | `feat/expense-merchant-field` |
| Bug fix | `fix/<short-description>` | `fix/claim-number-race` |
| DB migration only | `migration/<name>` | `migration/add-expense-merchant` |
| Refactor (no behaviour change) | `refactor/<area>` | `refactor/ap-controller-errors` |
| Deployment / infra | `chore/<description>` | `chore/monsterasp-publish-script` |
| Hotfix to production | `hotfix/<description>` | `hotfix/void-invoice-500` |

Rules:
- Lowercase, hyphen-separated — no spaces, no slashes beyond the prefix.
- Maximum lifespan: **3 days**. If a branch lives longer, split the work or use a feature flag.
- Branch from `main`. Never branch from another feature branch.

### Merge Policy

- All merges to `main` go through a **Pull Request** — no direct pushes.
- PRs require the [PR template](.github/PULL_REQUEST_TEMPLATE.md) to be filled in.
- `main` must be **always deployable**. If a build or smoke test fails on `main`, fixing it is the highest priority.
- Use **squash merge** for single-concern features (keeps history linear).
- Use **merge commit** when the branch has multiple meaningful atomic commits that should be preserved (e.g. a migration + implementation pair).
- **Never force-push to `main`.**
- Rebase feature branches on `main` if they fall behind before opening a PR: `git fetch origin && git rebase origin/main`.

---

## 3. Conventional Commit Standard

Format:

```
<type>(<scope>): <imperative description ≤72 chars>

[Optional body: explain WHY, not what. Reference issue numbers.
Acknowledge trade-offs. Max 72 chars per line.]

[Optional footer: BREAKING CHANGE: ..., Fixes #123]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New capability visible to users or API consumers |
| `fix` | Bug fix — corrects unintended behaviour |
| `migration` | EF Core migration (always paired with the feat/fix that required it) |
| `refactor` | Code change with no behaviour change |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `chore` | Build scripts, deployment, tooling, dependencies |
| `ci` | CI/CD pipeline changes |

### Scopes (CMNetwork-specific)

`auth` | `gl` | `ap` | `ar` | `payroll` | `budget` | `expense` | `bank` | `audit` | `ui` | `deploy` | `admin`

### Examples

```
feat(expense): add merchant name and project code to claims

Backend entity, DbContext config, controller, and migration all updated.
Frontend schema already included these optional fields — no UI changes needed.

migration(expense): AddExpenseClaimMerchantProjectFields

fix(ap): standardize error responses to ApiError shape

All raw BadRequest(string) and bare NotFound() replaced.
Fixes frontend inability to read rejection reasons.

chore(deploy): wire SPA build into dotnet publish via BuildSpa MSBuild target

Eliminates the stale-bundle problem on MonsterAsp deployments.
Skip with /p:SkipSpaBuild=true for backend-only CI runs.
```

### Anti-patterns (will be flagged in review)

- `fix bug` / `misc changes` / `WIP` / `update` / `Phase 1`
- Commits that mix unrelated concerns (e.g. a schema change + a UI reskin)
- Commits that do not build or break the smoke test

### Atomic Commit Rule

Each commit must leave the system in a **buildable, testable state**. If the next commit is needed to make the system work, squash them first.

---

## 4. Definition of Done — Merge Readiness

A PR is ready to merge when **all** of the following are true:

### Automated gates (must be green)

```powershell
# From repo root:
dotnet build CMNetwork.sln                   # 0 errors

cd src/CMNetwork.ClientApp
npm run lint                                 # 0 errors (warnings acceptable)
npm run build                                # 0 errors (tsc strict + Vite)
```

### Manual gates

- [ ] PR template is filled in (not left at defaults)
- [ ] Every section of the PR checklist relevant to the change type is ticked
- [ ] Smoke test passed locally: `GET /api/auth/health` → 200
- [ ] Happy path and at least one rejection path tested end-to-end
- [ ] If a DB migration was added: tested against LocalDB (`dotnet run` in Development)
- [ ] If the change touches a [CODEOWNERS](.github/CODEOWNERS) path: owner has reviewed
- [ ] No secrets, connection strings, or API keys in the diff
- [ ] `artifacts/` folder changes are intentional and documented in PR description

### For financial/accounting changes (additional gates)

- [ ] Status transitions tested: confirm a client cannot skip states by calling the API directly
- [ ] Audit trail verified: the changed entity appears in the audit log after save
- [ ] Amount/total fields validated: confirm the UI displays the value from the API, not a locally computed one

---

## 5. Accounting-Risk Change Rules

These rules are non-negotiable for any change touching GL, AP, AR, Payroll, Budgets, or Expense Claims.

| Rule | Rationale |
|---|---|
| All monetary totals come from the API | Prevents rounding/precision drift between client and server |
| Status transitions enforced server-side | A client bypassing the UI must not be able to approve/pay/void |
| Soft-delete only for financial records | Audit trail requires every record to remain queryable |
| `[AuditDbContext]` on `CMNetworkDbContext` must never be removed | All DB writes are captured automatically via Audit.NET |
| Double-entry integrity: every debit has a matching credit | No orphaned GL lines — enforce in the service layer, not just the UI |
| No raw SQL or string-interpolated queries | Parameterized EF LINQ only; prevents SQL injection and audit gaps |
| EF migration required for every schema change | Ensures production DB is never ahead of or behind the codebase |

---

## 6. Review Ownership Matrix

Defined in [.github/CODEOWNERS](.github/CODEOWNERS). Summary:

| Path | Owner | Reason |
|---|---|---|
| `*` (all files) | @kennu | Default reviewer |
| `Controllers/AP*`, `Controllers/AR*` | @kennu | Financial risk |
| `Controllers/PayrollController.cs` | @kennu | Financial risk |
| `Controllers/JournalEntriesController.cs` | @kennu | GL integrity |
| `Controllers/BudgetsController.cs` | @kennu | Budget controls |
| `Controllers/ExpenseClaimsController.cs` | @kennu | Expense workflow |
| `Infrastructure/Persistence/` (incl. Migrations) | @kennu | DB schema authority |
| `Infrastructure/Identity/` | @kennu | Auth/security |
| `Middleware/` | @kennu | Global error + logging |
| `deploy-monsterasp.ps1`, `Dockerfile`, `render.yaml` | @kennu | Deployment safety |
| `.github/` | @kennu | Governance |

A PR touching any of these paths cannot merge without the listed owner's approval.

---

## 7. Secrets and Artifacts Hygiene

### What must never be committed

| Category | Examples | Where it should live instead |
|---|---|---|
| JWT signing secret | `Jwt__Secret` value | .NET User Secrets (dev) / MonsterAsp env var (prod) |
| Database connection strings with credentials | MonsterAsp SQL Server DSN | `ConnectionStrings__MonsterAspConnection` env var |
| Payment gateway keys | PayMongo public/secret keys | User Secrets / env vars |
| `appsettings.Development.json` with real creds | Any non-LocalDB connection string | That file is in `.gitignore` — keep it there |

Run before committing:

```powershell
git diff --staged | Select-String -Pattern "password|secret|apikey|connectionstring" -CaseSensitive:$false
```

If any match looks like a real value (not a placeholder like `<YOUR_SECRET_HERE>`), **do not commit**.

### `artifacts/` folder rules

The `artifacts/` folder holds pre-built publish output used as a deployment reference. Rules:

- **Never commit a new publish output without updating the PR description** to explain why.
- The authoritative build is produced by `deploy-monsterasp.ps1` or `dotnet publish` — the committed artifacts are a snapshot, not the source of truth.
- `artifacts/monsterasp-api/wwwroot/` must contain a fresh SPA bundle matching the current `src/CMNetwork.ClientApp/` source. Verify with:

  ```powershell
  Select-String -Path "artifacts\monsterasp-api\wwwroot\assets\*.js" -Pattern "Create Expense Claim" -Quiet
  ```

- Do not commit `artifacts/` changes in the same commit as source changes. Keep them separate so the diff is readable.

### `.gitignore` hygiene

These paths must remain ignored and must not be force-added:

```
**/bin/
**/obj/
src/CMNetwork.ClientApp/node_modules/
src/CMNetwork.ClientApp/dist/
appsettings.Development.json   # outside the tracked artifact copies
*.user
*.suo
.vs/
```

---

## 8. Database Changes

Always create an EF migration for every model change:

```powershell
dotnet ef migrations add <DescriptiveName> `
  --project src/CMNetwork.Infrastructure/CMNetwork.Infrastructure.csproj `
  --startup-project src/CMNetwork.WebApi/CMNetwork.WebApi.csproj
```

Rules:
- Migration names must be descriptive: `AddExpenseClaimMerchantProjectFields`, not `Update1`.
- Migrations apply automatically on startup in Development and Production.
- **Never drop or rename a column** without a two-phase migration strategy (add new → migrate data → drop old).
- Never edit a committed migration — add a corrective migration instead.
- If you need to undo a local migration before it is committed: `dotnet ef migrations remove`.

---

## 9. API Error Responses

All error responses must use the `ApiError` shape:

```json
{ "status": 400, "message": "Human-readable reason.", "errors": { "field": ["msg"] }, "traceId": "00-..." }
```

In controllers:

```csharp
return BadRequest(new { message = "Vendor not found or inactive." });
return NotFound(new { message = "AP invoice not found." });
return Conflict(new { message = "Invoice number already exists." });
```

The `GlobalExceptionMiddleware` handles unhandled exceptions and wraps them in `ApiError` automatically.

Do **not** return:
- `BadRequest("raw string")` — the frontend cannot parse this reliably.
- Bare `NotFound()` with no body.
- Stack traces or internal paths in production responses.
