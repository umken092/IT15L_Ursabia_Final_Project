# CMNetwork QA Matrix

> Test coverage checklist for acceptance before any production deployment.
> Each row: test scenario → expected result → status.
> Status: ✅ Pass | ❌ Fail | ⏭ Skip (with reason) | 🔲 Not tested

---

## Module 1 — Authentication & Security

| # | Scenario | Expected | Status |
|---|---|---|---|
| 1.1 | POST `/api/auth/login` with valid credentials | 200, `accessToken` + `refreshToken` returned | 🔲 |
| 1.2 | POST `/api/auth/login` with wrong password | 401 | 🔲 |
| 1.3 | GET any protected endpoint without token | 401 | 🔲 |
| 1.4 | GET any protected endpoint with expired token | 401 | 🔲 |
| 1.5 | POST `/api/auth/refresh-token` with valid refresh token | 200, new `accessToken` | 🔲 |
| 1.6 | POST `/api/auth/refresh-token` with revoked/invalid token | 401 | 🔲 |
| 1.7 | Register a user with a password < 12 chars | 400, password policy error | 🔲 |
| 1.8 | Register a user with password missing uppercase | 400, password policy error | 🔲 |
| 1.9 | Register a user with password missing digit | 400, password policy error | 🔲 |
| 1.10 | Register a user with password missing symbol | 400, password policy error | 🔲 |
| 1.11 | Register a user with strong password | 201 / 200 | 🔲 |
| 1.12 | Access admin endpoint as Accountant role | 403 | 🔲 |
| 1.13 | TOTP MFA — login with valid TOTP code | 200 | 🔲 |
| 1.14 | TOTP MFA — login with invalid TOTP code | 400/401 | 🔲 |
| 1.15 | GET `/api/auth/health` (unauthenticated) | 200 | 🔲 |

---

## Module 2 — User Administration

| # | Scenario | Expected | Status |
|---|---|---|---|
| 2.1 | GET `/api/admin/users` as SuperAdmin | 200, user list | 🔲 |
| 2.2 | PUT `/api/admin/users/{id}` — update existing user | 200 | 🔲 |
| 2.3 | PUT `/api/admin/users/{id}` — non-existent user | 404 `{ "message": "User not found." }` | 🔲 |
| 2.4 | DELETE `/api/admin/users/{id}` — non-existent user | 404 `{ "message": "User not found." }` | 🔲 |
| 2.5 | POST `/api/admin/users/{id}/unlock` — locked user | 200 | 🔲 |
| 2.6 | POST `/api/admin/users/{id}/unlock` — non-existent user | 404 `{ "message": "User not found." }` | 🔲 |
| 2.7 | POST `/api/admin/users/{id}/reset-password` — non-existent user | 404 `{ "message": "User not found." }` | 🔲 |

---

## Module 3 — Dashboard

| # | Scenario | Expected | Status |
|---|---|---|---|
| 3.1 | GET `/api/dashboard/accountant/metrics` | 200, non-empty metrics array | 🔲 |
| 3.2 | GET `/api/dashboard/super-admin/metrics` | 200 | 🔲 |
| 3.3 | GET `/api/dashboard/unknown-role/metrics` | 400 `{ "message": "Unknown role 'unknown-role'..." }` | 🔲 |
| 3.4 | GET `/api/dashboard/charts` | 200 | 🔲 |
| 3.5 | GET `/api/dashboard/approvals` | 200 | 🔲 |
| 3.6 | GET `/api/dashboard/budget-control` | 200 | 🔲 |
| 3.7 | GET `/api/dashboard/health` (unauthenticated) | 200 | 🔲 |

---

## Module 4 — General Ledger

| # | Scenario | Expected | Status |
|---|---|---|---|
| 4.1 | GET `/api/general-ledger/accounts` | 200, account list | 🔲 |
| 4.2 | POST `/api/general-ledger/journals` — balanced entry (debit = credit) | 201 | 🔲 |
| 4.3 | POST `/api/general-ledger/journals` — unbalanced entry (debit ≠ credit) | 400 `{ "message": "Journal entry is not balanced..." }` | 🔲 |
| 4.4 | POST `/api/general-ledger/journals` — only 1 line | 400 `{ "message": "At least two journal lines are required." }` | 🔲 |
| 4.5 | POST `/api/general-ledger/journals` — line with both debit and credit | 400 | 🔲 |
| 4.6 | POST `/api/general-ledger/journals` — line with negative amount | 400 | 🔲 |
| 4.7 | POST `/api/general-ledger/journals` — entry date outside any open fiscal period | 400 "Entry date must fall within an open fiscal period." | 🔲 |
| 4.8 | POST `/api/general-ledger/journals/{id}/post` — valid draft entry | 200 | 🔲 |
| 4.9 | GET `/api/general-ledger/trial-balance` | 200, `isBalanced: true` for seeded data | 🔲 |

---

## Module 5 — AP Invoices

| # | Scenario | Expected | Status |
|---|---|---|---|
| 5.1 | GET `/api/apinvoices` | 200, list | 🔲 |
| 5.2 | POST `/api/apinvoices` — create valid invoice | 201 | 🔲 |
| 5.3 | POST `/api/apinvoices/{id}/approve` — valid invoice | 200 | 🔲 |
| 5.4 | POST `/api/apinvoices/{id}/approve` — already approved | 400 | 🔲 |
| 5.5 | POST `/api/apinvoices/{id}/post` — approved invoice | 200 | 🔲 |
| 5.6 | POST `/api/apinvoices/{id}/post` — non-approved invoice | 400 | 🔲 |
| 5.7 | GET `/api/apinvoices/{id}` — non-existent | 404 | 🔲 |

---

## Module 6 — AR Invoices

| # | Scenario | Expected | Status |
|---|---|---|---|
| 6.1 | GET `/api/arinvoices` | 200, list | 🔲 |
| 6.2 | POST `/api/arinvoices` — create valid invoice | 201 | 🔲 |
| 6.3 | POST `/api/arinvoices/{id}/send` — draft invoice | 200 | 🔲 |
| 6.4 | POST `/api/arinvoices/{id}/approve` — sent invoice | 200 | 🔲 |
| 6.5 | POST `/api/arinvoices/{id}/mark-paid` — approved invoice | 200 `{ "message": "Invoice marked as paid." }` | 🔲 |
| 6.6 | POST `/api/arinvoices/{id}/mark-paid` — already paid | 400 "Invoice is already marked as paid." | 🔲 |
| 6.7 | POST `/api/arinvoices/{id}/mark-paid` — voided invoice | 400 "Cannot mark a voided invoice as paid." | 🔲 |
| 6.8 | POST `/api/arinvoices/{id}/mark-paid` — draft invoice | 400 "Cannot mark a draft invoice as paid." | 🔲 |
| 6.9 | POST `/api/arinvoices/{id}/void` — paid invoice | 400 "Cannot void a paid invoice." | 🔲 |
| 6.10 | POST `/api/arinvoices/{id}/void` — non-existent | 404 | 🔲 |

---

## Module 7 — Expense Claims

| # | Scenario | Expected | Status |
|---|---|---|---|
| 7.1 | GET `/api/expense-claims` | 200, list | 🔲 |
| 7.2 | POST `/api/expense-claims` — valid claim | 201 | 🔲 |
| 7.3 | POST `/api/expense-claims/{id}/submit` — draft claim | 200 | 🔲 |
| 7.4 | GET `/api/expense-claims/{id}` — non-existent | 404 | 🔲 |

---

## Module 8 — Approvals

| # | Scenario | Expected | Status |
|---|---|---|---|
| 8.1 | GET `/api/approvals` | 200, queue list | 🔲 |
| 8.2 | POST `/api/approvals/{id}/approve` — valid pending item | 200 | 🔲 |
| 8.3 | POST `/api/approvals/{id}/approve` — item submitted by the approving user (self-approval) | 403 "You cannot approve your own submission." | 🔲 |
| 8.4 | POST `/api/approvals/{id}/reject` — valid pending item with reason | 200 | 🔲 |
| 8.5 | POST `/api/approvals/{id}/reject` — no reason provided | 400 | 🔲 |

---

## Module 9 — Budget

| # | Scenario | Expected | Status |
|---|---|---|---|
| 9.1 | GET `/api/budgets` | 200 | 🔲 |
| 9.2 | POST `/api/budgets` — valid budget | 201 | 🔲 |
| 9.3 | POST `/api/budgets/{id}/approve` — as BudgetManager | 200 | 🔲 |
| 9.4 | GET `/api/dashboard/budget-control?year=<current>` | 200, utilization metrics | 🔲 |

---

## Module 10 — Reports

| # | Scenario | Expected | Status |
|---|---|---|---|
| 10.1 | GET `/api/reports/templates` | 200 | 🔲 |
| 10.2 | DELETE `/api/reports/templates/{id}` — non-existent | 404 `{ "message": "Report template not found." }` | 🔲 |
| 10.3 | PUT `/api/reports/schedules/{id}` — non-existent | 404 `{ "message": "Report schedule not found." }` | 🔲 |
| 10.4 | POST `/api/reports/schedules/{id}/run` — non-existent | 404 `{ "message": "Report schedule not found." }` | 🔲 |

---

## Module 11 — Error Contract Compliance

Every API error response must conform to `{ "message": string }`.

| # | Scenario | Expected | Status |
|---|---|---|---|
| 11.1 | Any 404 response body | `{ "message": "..." }` (never empty body) | 🔲 |
| 11.2 | Any 400 response body | `{ "message": "..." }` (never raw string) | 🔲 |
| 11.3 | Any 500 response body (GlobalExceptionMiddleware) | `{ "message": "An unexpected error occurred." }` | 🔲 |
| 11.4 | Frontend toast on API error | Shows server `message` value (not hardcoded string) | 🔲 |

---

## Module 12 — Database & Infrastructure

| # | Scenario | Expected | Status |
|---|---|---|---|
| 12.1 | Fresh LocalDB start — `dotnet run` | Migrations applied automatically, seeder runs | 🔲 |
| 12.2 | `GET /api/auth/health` after startup | 200 `{ "status": "healthy" }` | 🔲 |
| 12.3 | Dev env with prod DB connection string | Critical log warning fires; app still starts | 🔲 |
| 12.4 | Smoke test script against local backend | All checks pass (`.\smoke-test.ps1 -Password ...`) | 🔲 |

---

## Execution Notes

- Run tests in order within each module (setup depends on prior actions, e.g. create before approve).
- Use `smoke-test.ps1` for a quick automated sweep of high-priority endpoints.
- Modules 1–4, 6 (mark-paid), 8.3 (self-approval), 11 (error contract) are **blocking** — must all be ✅ before a production deployment.
- Modules 5, 7, 9, 10 are **non-blocking** for hotfix deploys.
