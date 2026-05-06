# CMNetwork ERP — 6-Phase Implementation Plan

**Date:** May 7, 2026  
**Status:** Approved for execution  
**Tracking:** Each task maps to one atomic commit per [CONTRIBUTING.md](CONTRIBUTING.md) conventions.

---

## Understanding

CMNetwork is a deployed, live-data ERP on MonsterAsp. The codebase has completed a first stabilization pass (API error schema, expense claim fields, self-approval prohibition, governance docs). This plan addresses the remaining technical debt and operational gaps in six ordered phases:

1. **Database structure improvements** — indexes, precision, FK integrity, password policy
2. **Codebase refactor targets** — remaining non-conforming error returns, redundant try/catch, frontend error reading
3. **API reliability testing and fixes** — double-entry enforcement verification, ModelState serialization, smoke test coverage
4. **Production-safe live data strategy** — migration runbook, DB mode switching, rollback procedure
5. **MonsterAsp deployment runbook** — step-by-step deploy, verification, rollback
6. **Full UI + transaction QA matrix and git cleanup**

---

## Assumptions

- `main` branch is the single deploy branch — no GitFlow.
- Production DB is `db49851.databaseasp.net`; LocalDB is used for all development.
- No test project exists; "testing" means manual smoke tests + documented QA matrix.
- MonsterAsp deploys by pushing to the linked GitHub branch (push-to-deploy).
- All monetary values are PHP, single-currency.
- Migrations apply automatically on startup via `DatabaseSeeder.MigrateAsync`.

---

## Phase Gate Definitions

A phase is **complete** when every task in it is done AND the phase gate passes.

| Gate | Criteria |
|---|---|
| **G1** (DB) | `dotnet build CMNetwork.sln` → 0 errors; migration applies cleanly on LocalDB |
| **G2** (Refactor) | `dotnet build` → 0 errors; `npm run lint` → 0 errors; `npm run build` → 0 errors |
| **G3** (API reliability) | All smoke-test paths in the QA matrix return expected status codes locally |
| **G4** (Live data strategy) | Deploy runbook executed on staging/LocalDB; production migration plan documented and reviewed |
| **G5** (Deployment) | MonsterAsp deploy succeeds; `GET /api/auth/health` → 200; SPA bundle freshness check passes |
| **G6** (QA + Git) | QA matrix fully executed; all items pass or are tracked as known issues; git history is clean |

---

## Dependency Graph

```
Phase 1 (DB)
  └─→ Phase 2 (Refactor) — refactor targets backend fixes that build on schema
        └─→ Phase 3 (API reliability) — verify correctness after refactor
              ├─→ Phase 4 (Live data strategy) — pre-deploy safety work
              │     └─→ Phase 5 (Deployment) — uses runbook produced in Phase 4
              └─→ Phase 6 (QA + Git) — can begin after Phase 3; git cleanup is independent
```

**Parallelization:**
- Phase 6 git cleanup tasks (T6.1–T6.3) are independent and can run at any point after Phase 2.
- Phase 6 QA matrix can begin in parallel with Phase 4 (the matrix documents what to test; execution requires Phase 5 to be deployed).

---

## Phase 1 — Database Structure Improvements

**Goal:** Ensure every financial entity has correct column types, appropriate indexes, and no schema integrity gaps.

**Estimated total:** ~3 hours

### Tasks

| # | Task | Acceptance Criteria |
|---|---|---|
| T1.1 | **Add missing composite index on `APInvoices` (VendorId, Status, InvoiceDate)** | Migration created; `EXPLAIN` / EF query plan shows index used on filtered list queries |
| T1.2 | **Add missing composite index on `ARInvoices` (CustomerId, Status, InvoiceDate)** | Same as T1.1 |
| T1.3 | **Add index on `JournalEntries.EntryDate`** | GL date-range queries no longer scan full table |
| T1.4 | **Add index on `ApprovalQueue.Status` + `RequiredApproverRole`** | Approval queue filter query uses index |
| T1.5 | **Verify all `decimal` financial columns use `HasPrecision(18, 2)`** | Search `CMNetworkDbContext.cs` for `decimal` columns lacking explicit precision; add `HasPrecision` for any found; migration created |
| T1.6 | **Harden password policy in `DependencyInjection.cs`** | `RequiredLength = 12`, `RequireUppercase = true`, `RequireDigit = true`, `RequireNonAlphanumeric = true` — matches the `SecurityPolicies` seed data which already states these requirements |
| T1.7 | **Verify FK `ExpenseClaim.EmployeeId` has no orphan risk** | Confirm `AspNetUsers.Id` FK or add `HasForeignKey` config in DbContext; migration if needed |

**Phase 1 Gate (G1):**
- [ ] `dotnet build CMNetwork.sln` → 0 errors
- [ ] Migration applies on fresh LocalDB without error
- [ ] All new indexes visible in `sys.indexes` query or EF migration SQL

**Risks:**
- T1.6 (password policy) will force password resets for existing users on next login attempt. In production, coordinate with all active users or implement a grace-period flag.
- T1.5 may reveal a column that was `decimal` without precision in an old migration — do not edit old migrations; add a corrective migration.

---

## Phase 2 — Codebase Refactor Targets

**Goal:** Eliminate all remaining non-conforming error returns and redundant try/catch blocks. Frontend must consistently read `error.response.data.message`.

**Estimated total:** ~4 hours

### Backend tasks

| # | Task | Location | Acceptance Criteria |
|---|---|---|---|
| T2.1 | **Fix 5 bare `NotFound()` in `AdminController`** | Lines 227, 276, 296, 322, 429 | Each returns `NotFound(new { message = "..." })` with a descriptive resource name |
| T2.2 | **Fix 4 bare `NotFound()` in `ReportsController`** | Lines 508, 512, 592, 620 | Same pattern as T2.1 |
| T2.3 | **Fix 1 raw `BadRequest("string")` in `ARInvoicesController`** | Line 218 | `BadRequest(new { message = "One or more accounts not found or inactive." })` |
| T2.4 | **Remove redundant try/catch blocks in `DashboardController`** | All 5 action methods | Delete try/catch wrappers; let `GlobalExceptionMiddleware` handle exceptions. Actions become clean `return Ok(...)` calls. Verify the middleware's `InvalidOperationException → 400` mapping covers any business errors the dashboard service may throw. |
| T2.5 | **Remove redundant try/catch in `APInvoicesController` and `ARInvoicesController`** | Lines 272, 271 respectively | Delete local catch blocks; middleware handles 500s |

### Frontend tasks

| # | Task | Location | Acceptance Criteria |
|---|---|---|---|
| T2.6 | **Create shared `extractApiError(error): string` utility** | `src/CMNetwork.ClientApp/src/services/apiClient.ts` or new `src/utils/errorUtils.ts` | Function reads `error.response?.data?.message` → falls back to `error.message` → falls back to default string. Returns `string`. |
| T2.7 | **Apply `extractApiError` to all module catch blocks** | All `.tsx` module files that have catch blocks | Replace ad-hoc error reading with the shared utility. `FacultyAdminModule`, `AuthorizedViewerModule`, `UserManagementModule`, `ExtendedRoleOperationsModule` are the primary targets. |
| T2.8 | **Ensure all module toasts show the extracted server message** | Same files as T2.7 | `pushToast('error', extractApiError(error))` is the pattern; hardcoded fallback strings are acceptable as second argument only |

**Phase 2 Gate (G2):**
- [ ] `dotnet build CMNetwork.sln` → 0 errors
- [ ] `grep -r 'BadRequest("' src/CMNetwork.WebApi/Controllers/` → 0 matches (or only approved exceptions documented inline)
- [ ] `grep -r 'return NotFound()' src/CMNetwork.WebApi/Controllers/` → 0 matches
- [ ] `npm run lint` → 0 errors
- [ ] `npm run build` → 0 errors

**Risks:**
- T2.4 (DashboardController try/catch removal): if `IDashboardService` throws a domain-specific exception type not mapped in `GlobalExceptionMiddleware`, that error will become a 500 instead of a 400. Audit `DashboardService` throw sites before removing try/catch.
- T2.6/T2.7 frontend utility: keep backward-compatible fallback to `error.message` so existing working modules are not broken.

---

## Phase 3 — API Reliability Testing and Fixes

**Goal:** Verify that all endpoints behave according to the API design reference. Fix any gaps found.

**Estimated total:** ~5 hours

### Tasks

| # | Task | Acceptance Criteria |
|---|---|---|
| T3.1 | **Verify GL double-entry enforcement on `POST /api/general-ledger/journal-entries`** | Read the full `CreateJournalEntry` action; confirm the balance check string (line 657) is actually returned as `BadRequest` — not silently ignored. If the helper is called but its result is discarded, add the guard: `if (!string.IsNullOrEmpty(balanceError)) return BadRequest(new { message = balanceError });` |
| T3.2 | **Standardize `BadRequest(ModelState)` returns** | All `ModelState`-based returns currently produce ASP.NET's default validation ProblemDetails format, not `ApiError`. Either: (a) configure `InvalidModelStateResponseFactory` in `Program.cs` to emit `ApiError`, or (b) document that ModelState 400s intentionally use ProblemDetails. Decision must be recorded in `API_DESIGN_REFERENCE.md`. |
| T3.3 | **Verify AR Invoice `mark-paid` endpoint existence** | Search controllers for `mark-paid` or `MarkPaid`. If missing, add `POST /api/arinvoices/{id}/mark-paid` that transitions `Approved → Paid` with payment reference stored. This is listed in the API design reference as required. |
| T3.4 | **Verify Expense Claim self-approval prohibition for inline approvals** | The fix in `ApprovalsController` covers the queue. Check `ExpenseClaimsController` `approve` action — does it also have a self-approval check? Add if missing. |
| T3.5 | **Write the smoke test script** | Create `smoke-test.ps1` at repo root. Script authenticates as `accountant@cmnetwork.com`, then calls: health, dashboard metrics, expense claims list, AP invoice list, AR invoice list, GL accounts, approval queue. Each call checks status code and that `message` field is absent (no error body). Exits non-zero on any failure. |
| T3.6 | **Verify `DashboardController` role guard on `GET /{role}/metrics`** | The `role` path parameter must be validated against known roles before calling `GetMetricsAsync`. If `IDashboardService.GetMetricsAsync` throws on an unknown role, it must return `400`, not `500`. |

**Phase 3 Gate (G3):**
- [ ] `smoke-test.ps1` runs end-to-end locally → all calls return expected codes
- [ ] `POST /api/general-ledger/journal-entries` with unbalanced lines returns `400` with `message` containing "not balanced"
- [ ] `POST /api/approvals/{id}/approve` with own submission returns `400 "You cannot approve your own submission."`
- [ ] `GET /api/dashboard/unknown-role/metrics` returns `400`, not `500`

**Risks:**
- T3.3 (mark-paid): if AR invoices are currently paid through a manual DB update in production, adding the endpoint will change workflow. Coordinate with users before deploying.
- T3.2 (ModelState format): changing `InvalidModelStateResponseFactory` will change the shape of all 400 validation responses — this is potentially a breaking change for any frontend code that reads the existing ProblemDetails `errors` array format.

---

## Phase 4 — Production-Safe Live Data Strategy

**Goal:** Ensure no migration, deploy, or test run can corrupt or permanently alter production data unexpectedly.

**Estimated total:** ~3 hours

### Tasks

| # | Task | Acceptance Criteria |
|---|---|---|
| T4.1 | **Document the DB mode switching procedure** | Expand `CONTRIBUTING.md §8` or create a separate `DEPLOYMENT.md` section: how to set `Database:UseMonsterAsp=true`, what `CMNETWORK_DB_MODE=Local` does, and the risk of running without `appsettings.Development.json` (defaults to prod DB). |
| T4.2 | **Add a startup guard against accidental prod DB writes in Development** | In `Program.cs` or `DependencyInjection.cs`: if `ASPNETCORE_ENVIRONMENT == Development` AND connection string points to `db49851.databaseasp.net`, log a `LogCritical` warning and optionally throw if a new env var `CMNETWORK_ALLOW_PROD_IN_DEV` is not set. |
| T4.3 | **Write pre-migration checklist for production** | Document in the deployment runbook (Phase 5): (1) take a manual backup via MonsterAsp dashboard before applying migrations, (2) verify migration SQL with `dotnet ef migrations script` before pushing, (3) confirm `Down()` method is implemented on all new migrations for rollback. |
| T4.4 | **Verify all new migrations have `Down()` implementations** | Check `AddExpenseClaimMerchantProjectFields.cs` — does it have a correct `Down()` that drops the two columns and removes the index? Fix if missing. |
| T4.5 | **Document rollback procedure** | In the deployment runbook: (1) how to invoke `dotnet ef database update <PreviousMigration>` against production, (2) git revert commit, (3) re-deploy. |

**Phase 4 Gate (G4):**
- [ ] `CMNETWORK_ALLOW_PROD_IN_DEV` guard is active in Development — log warning is visible in console when accidentally connecting to prod DB
- [ ] All migrations since `InitialCreate` have implemented `Down()` methods
- [ ] Pre-migration checklist is written and reviewed

**Risks:**
- T4.2 (prod DB guard): this is a dev-time safety check only. It will not prevent a misconfigured CI/CD from hitting prod. The real safety is in MonsterAsp environment variable isolation.

---

## Phase 5 — MonsterAsp Deployment Runbook

**Goal:** A step-by-step, repeatable runbook that any team member can follow to deploy a production release safely.

**Estimated total:** ~2 hours (document + verification run)

### Tasks

| # | Task | Acceptance Criteria |
|---|---|---|
| T5.1 | **Create `DEPLOYMENT.md` at repo root** | Contains all sections listed below |
| T5.2 | **Execute a full dry-run of the runbook against LocalDB** | Run every step in the runbook with `UseMonsterAsp=false`; document any step that behaves differently in production |
| T5.3 | **Verify `deploy-monsterasp.ps1` bundle freshness check** | The script's `Select-String` check for a known UI string must target a string that actually exists in the current bundle. Update the search string if the bundle has changed. |
| T5.4 | **Add post-deploy verification steps to the script** | After upload, the script should print: (1) the URL to hit for health check, (2) the expected SPA route to open in a browser, (3) reminder to check MonsterAsp application logs for migration errors |

**`DEPLOYMENT.md` must contain these sections:**

```
1. Pre-deploy checklist
   - All PRs merged to main
   - dotnet build → 0 errors
   - npm run lint + npm run build → 0 errors
   - smoke-test.ps1 passes locally
   - Migration SQL reviewed (dotnet ef migrations script)
   - MonsterAsp DB backup taken

2. Build and package
   - Run deploy-monsterasp.ps1
   - Verify output: wwwroot/index.html exists, bundle freshness string found

3. Upload
   - Upload artifacts/monsterasp-api/ via MonsterAsp file manager or deploy hook
   - Or: push to the deploy branch to trigger GitHub-linked auto-deploy

4. Post-deploy verification
   - GET https://cmnetwork.monsterasp.net/api/auth/health → 200
   - Open SPA in browser; confirm login works
   - Check MonsterAsp application logs for migration errors
   - Run one end-to-end transaction (create expense claim → submit → approve)

5. Rollback procedure
   - git revert <commit> and push to trigger re-deploy, OR
   - Restore previous artifacts/ snapshot and re-upload, AND
   - If migration was applied: dotnet ef database update <PreviousMigration> against prod (requires VPN or MonsterAsp SQL tool)

6. DB mode reference
   - Dev: ASPNETCORE_ENVIRONMENT=Development + appsettings.Development.json (LocalDB)
   - Prod: MonsterAsp env var ConnectionStrings__MonsterAspConnection set in dashboard
```

**Phase 5 Gate (G5):**
- [ ] `GET https://<monsterasp-url>/api/auth/health` → 200
- [ ] SPA loads in browser; login succeeds with a valid user
- [ ] MonsterAsp application logs show no migration errors
- [ ] `wwwroot/index.html` timestamp matches the build time of the deploy

**Risks:**
- MonsterAsp auto-deploy may re-deploy the old artifact from `main` if the `artifacts/` folder is committed separately from source changes. Always commit source and artifacts in separate commits so the deploy branch reflects the correct state.
- Migration rollback on a live DB with real data requires careful testing. Never run `migrations remove` against a production DB.

---

## Phase 6 — Full UI + Transaction QA Matrix and Git Cleanup

**Goal:** Document and execute a complete end-to-end QA pass; clean up git history and repository structure.

**Estimated total:** ~6 hours

### 6a — QA Matrix tasks

| # | Task | Acceptance Criteria |
|---|---|---|
| T6.1 | **Create `QA_MATRIX.md`** | Contains all rows in the matrix below |
| T6.2 | **Execute QA matrix against local dev environment** | Every row marked Pass or Fail with notes |
| T6.3 | **Execute QA matrix against production** | Every row marked Pass or Fail; all Fails tracked as GitHub Issues |

**QA Matrix — Transaction Flows**

| # | Flow | Role | Steps | Expected | Pass/Fail |
|---|---|---|---|---|---|
| Q1 | Login — valid credentials | Any | POST `/api/auth/login` with correct creds | 200 + `accessToken` | |
| Q2 | Login — invalid credentials | Any | POST `/api/auth/login` with wrong password | 401 + `{ message }` (no stack trace) | |
| Q3 | Login — account lockout | Any | 5 failed logins | 401 on attempt 6; account locked for 15 min | |
| Q4 | JWT expiry + silent refresh | Any | Wait for token expiry; make authenticated request | `apiClient.ts` silently refreshes; request succeeds | |
| Q5 | Create expense claim | Employee | Fill form → Submit → Verify claim appears in list | 201; claim visible with `Draft` status | |
| Q6 | Submit expense claim | Employee | Select Draft claim → Submit | Claim moves to `Submitted`; approval queue gains entry | |
| Q7 | Self-approve expense claim | Employee + Approver same user | Attempt to approve own submission | 400 `"You cannot approve your own submission."` | |
| Q8 | Approve expense claim | Approver | Approve Submitted claim | Claim status → `Approved`; approver cannot re-approve | |
| Q9 | Reject expense claim | Approver | Reject Submitted claim with notes | Claim status → `Rejected`; notes visible to employee | |
| Q10 | Create AP invoice — duplicate number | Accountant | Submit invoice with existing invoice number | 409 `"Invoice number already exists."` | |
| Q11 | Create AP invoice — inactive vendor | Accountant | Submit with inactive vendor ID | 400 `"Vendor not found or inactive."` | |
| Q12 | Approve AP invoice | Accountant | Approve Draft invoice | Status → `Approved` | |
| Q13 | Void paid AP invoice | Accountant | Attempt to void a Paid invoice | 400 `"Cannot void a paid invoice."` | |
| Q14 | Create AR invoice | Accountant | Fill form with active customer | 201; invoice in AR list | |
| Q15 | Post journal entry — balanced | Accountant | Submit entry where debits = credits | 201; entry appears in GL | |
| Q16 | Post journal entry — unbalanced | Accountant | Submit entry where debits ≠ credits | 400 with "not balanced" message | |
| Q17 | GL trial balance | Auditor | View trial balance report | `balanced: true` in response when all entries are balanced | |
| Q18 | Dashboard metrics — known role | Any | GET `/api/dashboard/accountant/metrics` | 200 with metric payload | |
| Q19 | Dashboard metrics — unknown role | Any | GET `/api/dashboard/unknown-role/metrics` | 400 (not 500) | |
| Q20 | Role-based access — wrong role | Employee | GET `/api/apinvoices` | 403 Forbidden | |
| Q21 | SPA navigation — deep link | Any | Open `https://host/app/expense-claims` directly | SPA loads; auth redirect if not logged in | |
| Q22 | Error toast visibility | Any | Trigger any API error from UI | Toast displays the server `message` string, not a generic "error" | |
| Q23 | MFA setup and verify | Admin | Enable TOTP; log out; log in with TOTP | Login succeeds after TOTP entry | |
| Q24 | Audit log capture | Admin | Create and approve an expense claim | Audit log shows two entries for the claim | |

### 6b — Git cleanup tasks

| # | Task | Acceptance Criteria |
|---|---|---|
| T6.4 | **Remove `.github/agent-skills-main/` tracked deletions** | The 70+ files staged as `D` (deleted) in `git status` are committed as a single `chore(git): remove agent-skills-main subtree` commit — not left as unstaged deletions |
| T6.5 | **Verify `.gitignore` correctness** | `bin/`, `obj/`, `node_modules/`, `dist/`, `.vs/`, `*.user` are all ignored; run `git status` after a clean build — no untracked build outputs appear |
| T6.6 | **Tag the first stable release** | After Phase 5 deploy succeeds and Phase 6 QA passes with no blocking failures: `git tag v1.0.0 -m "First stable production release"` |
| T6.7 | **Archive stale branches** | List all remote branches with `git branch -r`; delete any merged feature branches older than 3 days; push deletes with `git push origin --delete <branch>` (confirm with user before executing) |

**Phase 6 Gate (G6):**
- [ ] `QA_MATRIX.md` exists with every row completed (Pass/Fail/Tracked)
- [ ] No blocking failures (Q-rows marked Fail) in production run
- [ ] `git status` on a clean checkout shows no unexpected untracked or deleted files
- [ ] `git tag` shows `v1.0.0` pointing to the production deploy commit
- [ ] `git branch -r` shows no stale feature branches

---

## Summary Table

| Phase | Focus | Est. | Gate | Parallelizable with |
|---|---|---|---|---|
| 1 | Database structure | 3h | G1 | — |
| 2 | Codebase refactor | 4h | G2 | Phase 6 git tasks (T6.4–T6.5) |
| 3 | API reliability | 5h | G3 | — |
| 4 | Live data strategy | 3h | G4 | Phase 6 QA matrix authoring (T6.1) |
| 5 | Deployment runbook | 2h | G5 | — |
| 6 | QA + git cleanup | 6h | G6 | QA execution starts after G5 |
| **Total** | | **~23h** | | |

---

## Known Risks Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Password policy change (T1.6) forces lockouts | High | Medium | Coordinate with all users; implement in off-peak hours; test on LocalDB first |
| ModelState format change (T3.2) breaks frontend validation display | Medium | Medium | Audit all frontend code reading `errors` field before changing `InvalidModelStateResponseFactory` |
| Migration rollback on prod with real data | Low | High | Always take MonsterAsp DB backup before any migration; test `Down()` on LocalDB first |
| AR `mark-paid` endpoint missing (T3.3) | Medium | High | Verify before Phase 5 deploy; if missing, add in Phase 3 and block deploy on it |
| MonsterAsp auto-deploy using wrong artifact | Medium | High | Use explicit artifact upload path from `deploy-monsterasp.ps1`; do not rely solely on push-to-deploy |
| Q7 self-approval: admin with employee sub-account | Low | Medium | Self-approval check uses `NameIdentifier` claim; ensure users cannot have two simultaneous roles on the same account |

---

## Out of Scope (This Plan)

- Multi-currency support
- Integration with external payment gateways (PayMongo) — exists but not validated here
- Email notifications for approval workflow
- Automated test suite (no test project; all testing is manual this iteration)
- Role-based dashboard customization beyond existing `role` parameter routing
