# CMNetwork API Design Reference

Ground rules for every endpoint in this codebase. All new endpoints must conform; any deviation requires a written justification in the PR.

---

## Table of Contents

1. [Standardized Error Model](#1-standardized-error-model)
2. [Endpoint Contract Checklist](#2-endpoint-contract-checklist)
3. [Backward-Compatibility Policy and Deprecation Rules](#3-backward-compatibility-policy-and-deprecation-rules)
4. [Server-Side Accounting Validation Requirements](#4-server-side-accounting-validation-requirements)

---

## 1. Standardized Error Model

### Shape

All error responses — validation, business logic, auth, or unhandled exceptions — use this JSON shape:

```json
{
  "status":  400,
  "message": "Human-readable sentence describing the problem.",
  "errors":  { "fieldName": ["Reason A", "Reason B"] },
  "traceId": "00-4a8b9c1d...-01"
}
```

| Field | Type | Always present? | Meaning |
|---|---|---|---|
| `status` | `int` | Yes | Mirrors the HTTP status code |
| `message` | `string` | Yes | One sentence, safe to display in the UI |
| `errors` | `object \| null` | Only on 400/422 | Field-level validation failures |
| `traceId` | `string \| null` | Yes (except middleware may omit on simple returns) | Links to server log |

Implemented in `src/CMNetwork.WebApi/Models/ErrorViewModel.cs` (`ApiError` class) and produced automatically by `GlobalExceptionMiddleware` for unhandled exceptions.

### Status Code Matrix

| Scenario | HTTP status | `message` guidance |
|---|---|---|
| Input fails `[Required]` / model binding | **400** | `"Invalid request."` + populate `errors` from ModelState |
| Business rule violation (e.g. wrong status, inactive vendor) | **400** | Specific sentence: `"Vendor not found or inactive."` |
| Duplicate unique key (invoice number, account code) | **409** | `"Invoice number already exists."` |
| Record not found | **404** | `"<Resource> not found."` e.g. `"AP invoice not found."` |
| Not authenticated (no/bad JWT) | **401** | `"You are not authorized to perform this action."` — from middleware |
| Authenticated but wrong role | **403** | `"Forbidden."` — from ASP.NET authorization pipeline |
| Unhandled server exception | **500** | `"An unexpected error occurred. Please try again later."` — **never** expose stack trace or internal path |
| Field-level validation with multiple fields | **422** | `"Validation failed."` + populate `errors` |

### How to return errors in controllers

```csharp
// 400 — business rule
return BadRequest(new { message = "Vendor not found or inactive." });

// 400 — model state (gives errors dict automatically via ApiError-aware client)
if (!ModelState.IsValid)
    return BadRequest(ModelState);

// 404
return NotFound(new { message = "AP invoice not found." });

// 409
return Conflict(new { message = "Invoice number already exists." });

// 422 with field details
return UnprocessableEntity(new ApiError
{
    Status  = 422,
    Message = "Validation failed.",
    Errors  = new Dictionary<string, string[]>
    {
        { "dueDate", ["Due date must be after invoice date."] }
    }
});
```

**Never** return:
- `BadRequest("raw string")` — the frontend cannot read a bare string body reliably.
- Bare `NotFound()` with no body.
- `Ok(new { error = "..." })` — wrong status code defeats HTTP semantics.
- Stack traces, file paths, or connection strings in any response.

### `GlobalExceptionMiddleware` coverage

The middleware catches:

| Exception type | Maps to |
|---|---|
| `KeyNotFoundException` | 404 |
| `UnauthorizedAccessException` | 401 |
| `InvalidOperationException` | 400 |
| Everything else | 500 |

Throw these exception types from services when appropriate rather than bubbling raw exceptions.

---

## 2. Endpoint Contract Checklist

For each controller family below, the checklist covers: route, HTTP method, required auth/role, request shape, success response, and known error paths. Use this as a review gate when adding or changing endpoints.

---

### 2a. Auth (`/api/auth`)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/auth/health` | GET | None | Must return `200 OK` always — used as smoke test |
| `/api/auth/login` | POST | None, rate-limited | Returns `{ accessToken, refreshToken, user }` or `{ requiresMfa, mfaSessionToken }` on MFA challenge |
| `/api/auth/logout` | POST | Bearer | Revokes refresh token; always returns `200` |
| `/api/auth/refresh` | POST | None (uses refresh token in body) | Returns new `{ accessToken, refreshToken }` or `401` |
| `/api/auth/validate` | POST | None | Returns `{ isValid, claims }` — internal use by `apiClient.ts` |
| `/api/auth/mfa/verify` | POST | None | Completes MFA challenge; returns full auth response |
| `/api/auth/mfa/setup` | POST | Bearer | Returns TOTP secret + QR URI |
| `/api/auth/mfa/disable` | POST | Bearer | Disables MFA after password confirmation |

**Checklist for any Auth change:**
- [ ] `login` and `mfa/verify` remain rate-limited (`[EnableRateLimiting("login")]`)
- [ ] Failed login **always** returns `401` — never `200` with `{ success: false }` body
- [ ] MFA challenge returns `200` with `requiresMfa: true` (not `401`) — client must distinguish challenge from failure
- [ ] Refresh token rotation: old token is invalidated the moment a new one is issued
- [ ] `logout` succeeds even if the refresh token is already expired (idempotent revocation)
- [ ] IP address is captured in audit log for login/logout/refresh

---

### 2b. Expense Claims (`/api/expense-claims`)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `GET /` | GET | Bearer | Employees see own claims; approvers see all |
| `GET /{id}` | GET | Bearer | 404 if not found or not visible to caller |
| `POST /` | POST | Bearer | Creates claim in `Draft` status; returns `201 Created` |
| `POST /{id}/submit` | POST | Bearer | `Draft → Submitted`; only owner can submit |
| `POST /{id}/approve` | POST | Approver roles | `Submitted → Approved`; enqueues ApprovalQueue entry |
| `POST /{id}/reject` | POST | Approver roles | `Submitted → Rejected` |
| `GET /monitoring-summary` | GET | `faculty-admin,cfo,super-admin,accountant` | Aggregate read — no state mutation |

**Checklist for any Expense Claim change:**
- [ ] Status transitions validated server-side — client cannot POST to `approve` a `Draft` claim
- [ ] `EmployeeId` on the claim is always set from JWT claims (`sub`), never from the request body
- [ ] `ClaimNumber` generated server-side (timestamp+GUID) — never accepted from client
- [ ] `Amount` must be positive (`> 0`)
- [ ] `MerchantName` and `ProjectCode` optional, trimmed before save, max 256 / 64 chars
- [ ] `ReceiptUrl`, if present, must be a valid absolute URI (validate before save)
- [ ] Approver cannot approve their own claim (self-approval check)
- [ ] `GET /` applies visibility filter — employee never sees other employees' claims

---

### 2c. AP Invoices (`/api/apinvoices`)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `GET /` | GET | `accountant,cfo,super-admin` | Filter by `vendorId`, `status`, `fromDate`, `toDate` |
| `GET /{id}` | GET | `accountant,cfo,super-admin` | Includes vendor + line items + account codes |
| `POST /` | POST | `accountant,cfo,super-admin` | Creates in `Draft`; returns `201 Created` |
| `PUT /{id}` | PUT | `accountant,cfo,super-admin` | Full replace; only allowed in `Draft` or `PendingApproval` |
| `POST /{id}/approve` | POST | `accountant,cfo,super-admin` | `Draft/PendingApproval → Approved` |
| `POST /{id}/void` | POST | `accountant,cfo,super-admin` | Cannot void `Paid` invoices |

**Checklist for any AP Invoice change:**
- [ ] `InvoiceNumber` uniqueness checked against non-deleted records only
- [ ] All `ChartOfAccountId` values in lines must exist and be `IsActive = true`
- [ ] `TotalAmount` computed server-side: `SUM(line.Amount + line.TaxAmount ?? 0)` — never accepted from client
- [ ] Soft-delete only (`IsDeleted = true`) — no `DELETE` statements
- [ ] Status guard: `PUT` / `approve` / `void` return `400` when status prohibits the action
- [ ] `VendorId` must resolve to an active vendor (`IsActive = true`)
- [ ] Line items: at least one line required; each line must have `Amount > 0`

---

### 2d. AR Invoices (`/api/arinvoices`)

Mirrors AP Invoices with `CustomerId` instead of `VendorId`. All AP checklist items apply with these additions:

- [ ] `CustomerId` must resolve to an active customer
- [ ] `GET /` visibility: accountant/cfo/super-admin see all; other roles see only invoices for their own organization if applicable
- [ ] `POST /{id}/mark-paid` transitions `Approved → Paid`; requires payment reference in body

---

### 2e. General Ledger / Journal Entries (`/api/general-ledger`)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `GET /accounts` | GET | `accountant,cfo,super-admin,auditor` | Full chart of accounts |
| `POST /accounts` | POST | `accountant,cfo,super-admin` | Validates account code uniqueness + parent exists |
| `GET /journal-entries` | GET | `accountant,cfo,super-admin,auditor` | Paginated; filter by date range, account |
| `POST /journal-entries` | POST | `accountant,cfo,super-admin` | Creates posted entry; enforces double-entry |
| `GET /journal-entries/{id}` | GET | `accountant,cfo,super-admin,auditor` | Includes all debit/credit lines |
| `GET /export` | GET | `accountant,cfo,super-admin,auditor` | Returns Excel file |

**Checklist for any GL / Journal change:**
- [ ] **Double-entry invariant enforced server-side**: `SUM(debits) == SUM(credits)` — return `400` if not balanced, with `{ message: "Journal entry is not balanced. Debits: X, Credits: Y." }`
- [ ] All account IDs in lines must exist and be `IsActive = true`
- [ ] Journal entries are **immutable after posting** — no `PUT` or `PATCH` on a posted entry; corrections via a reversing entry only
- [ ] `AccountCode` uniqueness is case-insensitive (`UPPER(code)`)
- [ ] Parent account (if set) must exist before child account can be created
- [ ] Export endpoint streams file — does not load entire GL into memory

---

### 2f. Approvals (`/api/approvals`)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `GET /queue` | GET | Bearer | Returns `Pending` items matching caller's role |
| `GET /history` | GET | Bearer | Returns processed items |
| `POST /{id}/approve` | POST | `faculty-admin,cfo,super-admin,accountant` | Sets `Approved`; cascades to source entity |
| `POST /{id}/reject` | POST | `faculty-admin,cfo,super-admin,accountant` | Sets `Rejected`; cascades to source entity |

**Checklist for any Approvals change:**
- [ ] Idempotency: approving an already-approved item returns `400` with `"This approval item has already been processed."` — not `200`
- [ ] Role filter on `GET /queue` is server-enforced — super-admin sees all; others see only items requiring their role
- [ ] `ProcessedByUserId` and `ProcessedByName` set from JWT claims — never from request body
- [ ] `ProcessedAtUtc` is `DateTime.UtcNow` — never from request body
- [ ] Cascade to source entity (`ExpenseClaim`, AP Invoice, etc.) is atomic — use a DB transaction
- [ ] `Notes` trimmed and stored; nullable

---

### 2g. Dashboards (`/api/dashboard`)

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `GET /{role}/metrics` | GET | Bearer | Role validated server-side; unknown role returns `400` |
| `GET /charts` | GET | Bearer | Returns time-series data; all amounts from DB |
| `GET /approvals` | GET | Bearer | Pending approval count + list; mirrors `/api/approvals/queue` |

**Checklist for any Dashboard change:**
- [ ] `role` path parameter is validated against the known role enum — never used to construct a SQL query or file path
- [ ] All monetary aggregates computed in SQL/EF — no arithmetic in controller or service
- [ ] `GET /charts` data is read-only; no side effects
- [ ] Response shape is **additive-only versioned**: adding a new metric key is safe; removing or renaming a key is a breaking change requiring deprecation
- [ ] Dashboard endpoints do not duplicate data that already has a canonical endpoint (prefer linking by ID, not embedding full records)

---

## 3. Backward-Compatibility Policy and Deprecation Rules

### The One-Version Rule

CMNetwork has one frontend and one backend — deployed together. There is no public third-party API. Despite this, the following rules prevent breakage between deployments and keep the codebase maintainable.

### What counts as a breaking change

| Change | Breaking? | Notes |
|---|---|---|
| Removing a response field | **Yes** | Frontend may read it; always deprecate first |
| Renaming a response field | **Yes** | Treat as remove + add |
| Changing a field's type (e.g. `string` → `number`) | **Yes** | |
| Removing an endpoint | **Yes** | |
| Adding a new **required** request field | **Yes** | Existing callers don't send it |
| Changing an HTTP method | **Yes** | |
| Changing a status code for a success case | **Yes** | |
| Adding a new **optional** response field | No | Additive — safe |
| Adding a new **optional** request field | No | Existing callers omit it |
| Adding a new endpoint | No | |
| Tightening validation (stricter rules) | **Conditional** | Breaking if existing valid data would now fail; evaluate per case |
| Changing error message text | No | `message` strings are informational, not machine-parsed |

### Deprecation Process

1. **Mark in code:** Add `[Obsolete("Use /api/new-endpoint instead. Remove after YYYY-MM-DD.")]` to the old controller action.
2. **Mark in response:** Optionally add `"_deprecated": true, "_replacement": "/api/new-endpoint"` to the old response body for one release cycle.
3. **Update frontend:** Update `apiClient.ts` / service files to call the new endpoint in the same PR.
4. **Remove old endpoint:** In the next PR, delete the deprecated action and its `[Obsolete]` annotation.

Since frontend and backend deploy together, the deprecation window is typically **one PR cycle** (mark deprecated + migrate frontend → merge → remove in follow-up).

### Extending without breaking

Prefer adding over changing:

```csharp
// Instead of renaming `totalAmount` to `invoiceTotalAmount`:
// Add the new field, keep the old one, update frontend to use new, then remove old in next PR.
return Ok(new {
    invoice.TotalAmount,            // existing — keep until frontend migrated
    InvoiceTotalAmount = invoice.TotalAmount  // new preferred name
});
```

### URL versioning

URL versioning (`/api/v2/...`) is reserved for true incompatible rewrites affecting multiple endpoints simultaneously. Do not version individual endpoints — use the additive extension pattern above.

---

## 4. Server-Side Accounting Validation Requirements

These validations **must** live in the server. They may also be duplicated in the frontend for UX, but the server is the authority.

### 4a. Double-Entry Invariant

Every journal entry must satisfy:

```
SUM(lines where IsDebit = true, Amount) == SUM(lines where IsDebit = false, Amount)
```

Implementation requirement:

```csharp
var debits  = lines.Where(l => l.IsDebit).Sum(l => l.Amount);
var credits = lines.Where(l => !l.IsDebit).Sum(l => l.Amount);
if (debits != credits)
    return BadRequest(new ApiError
    {
        Status  = 400,
        Message = $"Journal entry is not balanced. Debits: {debits:F2}, Credits: {credits:F2}."
    });
```

Use `decimal` throughout — never `double` or `float` for monetary values.

### 4b. Status Transition Guards

Each financial entity enforces a state machine. Transitions not in the table below must return `400`.

**Expense Claims:**

| From | Allowed transitions | Actor |
|---|---|---|
| `Draft` | → `Submitted` | Claim owner |
| `Submitted` | → `Approved`, `Rejected` | Approver (not owner) |
| `Approved` | → `Paid` (system/accountant) | Accountant/system |
| `Rejected` | → `Draft` (re-edit and resubmit) | Claim owner |
| `Paid` | (terminal — no transitions) | — |

**AP / AR Invoices:**

| From | Allowed transitions |
|---|---|
| `Draft` | → `PendingApproval`, `Void` |
| `PendingApproval` | → `Approved`, `Draft` (recall) |
| `Approved` | → `Paid` |
| `Paid` | (terminal) |
| `Void` | (terminal) |

The `Void` transition from `Paid` is **explicitly prohibited** — return `400 "Cannot void a paid invoice."`.

### 4c. Amount and Monetary Field Rules

| Rule | Implementation note |
|---|---|
| All monetary values stored as `decimal(18,2)` | Enforced in EF config via `HasColumnType("decimal(18,2)")` |
| All amounts must be `> 0` | Validate in controller before save |
| `TotalAmount` always recomputed server-side | Never accepted from request body |
| Line amounts: `Amount = Quantity * UnitPrice` (if both provided) | Validate consistency; allow either pattern |
| Tax amounts: `TaxAmount >= 0` | Non-negative; zero is valid |
| Currency: single-currency system (PHP) | No multi-currency arithmetic; no exchange rate calculations in controllers |

### 4d. Referential Integrity Checks

These must be validated in the controller (or service) before any DB write:

| Field | Check |
|---|---|
| `VendorId` on AP Invoice | Vendor exists AND `IsActive = true` |
| `CustomerId` on AR Invoice | Customer exists AND `IsActive = true` |
| `ChartOfAccountId` on invoice lines / journal lines | Account exists AND `IsActive = true` |
| `ParentAccountId` on new GL account | Parent exists (if provided) |
| `EmployeeId` on Expense Claim | Set from JWT `sub` — never from request body |
| `ApprovalQueue.EntityId` | The referenced entity exists before enqueuing |

### 4e. Audit Trail Requirements

Every write operation on a financial entity must be traceable. `[AuditDbContext]` on `CMNetworkDbContext` captures all EF-tracked changes automatically. Additional requirements:

| Operation | Additional audit action (via `IAuditEventLogger`) |
|---|---|
| Invoice approved | `action: "InvoiceApproved"` with `entityId`, `amount`, `approverUserId` |
| Invoice voided | `action: "InvoiceVoided"` with reason |
| Expense claim approved/rejected | `action: "ExpenseClaimProcessed"` with outcome, `reviewerUserId` |
| Journal entry posted | `action: "JournalEntryPosted"` with entry ID and balance amounts |
| Auth events | Already logged in `AuthController` |

Controllers must not swallow audit failures — if `IAuditEventLogger.LogAsync` throws, let it propagate (the global exception middleware will catch and return 500).

### 4f. Self-Approval Prohibition

No user may approve a financial item they submitted. Enforce in `ApprovalsController.Process`:

```csharp
if (item.RequestedByUserId == User.FindFirstValue(ClaimTypes.NameIdentifier))
    return BadRequest(new { message = "You cannot approve your own submission." });
```

This check must also apply when AP/AR invoices are approved inline (not via the approval queue).

### 4g. Immutability of Posted Records

Once a financial record reaches a terminal status (`Paid`, `Void`, posted Journal Entry), it must not be mutated:

- No `PUT`/`PATCH` on the record itself.
- Corrections are made via a **reversing entry** (journal) or a **new void + replacement invoice** — not by editing the original.
- If a `PUT` arrives for an invoice in `Paid` or `Void` status, return `400 "Cannot update invoice in <status> status."`.
