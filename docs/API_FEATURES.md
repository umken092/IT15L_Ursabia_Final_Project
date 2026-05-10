# CMNetwork API Functions & Features

## Overview

This document provides comprehensive documentation of CMNetwork's REST API endpoints, organized by module. Each endpoint describes its purpose, request/response format, role-based access control, and business logic workflow.

**Base URL:** `https://it15l-ursabia-final-project.onrender.com` (production)  
**Local Dev:** `http://localhost:5128` (HTTP) or `https://localhost:7210` (HTTPS)

---

## Authentication & Authorization

### Authentication Flow

All API endpoints (except `/api/auth/health` and `/api/auth/login`) require a Bearer JWT token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**JWT Token Structure:**
- **Issued by:** [JwtTokenService.cs](../src/CMNetwork.Infrastructure/Identity/JwtTokenService.cs)
- **Lifespan:** 15 minutes (configurable via `Jwt:AccessTokenMinutes` setting)
- **Payload includes:**
  - `sub` (Subject): User ID (GUID)
  - `email`: User email address
  - `fullName`: User full name
  - `role`: Primary role (e.g., "accountant")
  - `roles` (array): All roles assigned to user (as claims)
  - `departmentId`: Department assignment (if any)
  - `jti`: JWT ID (for revocation tracking)

**Token Refresh:**
- Expired access tokens can be refreshed using a refresh token
- Refresh tokens are 64-byte random strings, valid for 7 days
- Single-use: cannot be reused after refresh

### Role-Based Access Control (RBAC)

**Available Roles:**
| Role | Display Name | Permissions |
|------|--------------|-------------|
| `super-admin` | Super Admin | Full system access; admin functions |
| `cfo` | Chief Financial Officer | GL posting, invoice approval, budget decisions |
| `accountant` | Accountant | Journal creation, invoice registration, reconciliation |
| `faculty-admin` | Faculty Admin | Department budgets, payroll |
| `budget-manager` | Budget Manager | Budget approvals, reallocation processing |
| `budget-officer` | Budget Officer | Budget tracking, variance reports |
| `auditor` | Auditor | Read-only access; audit logs and reports |
| `employee` | Employee | Expense claim submission, payroll view |
| `authorized-viewer` | Authorized Viewer | Limited read-only dashboard |
| `customer` | Customer | Portal access; view own invoices |

**Authorization at Controller Level:**
```csharp
[Authorize(Roles = "accountant,cfo,super-admin")]
public class GeneralLedgerController : ControllerBase { }
```

---

## Core API Modules

### 1. Authentication Module

#### `POST /api/auth/login`
**Purpose:** Authenticate user and issue access + refresh tokens  
**Rate Limited:** 10 attempts per 15 minutes per IP address  
**Requires:** None (public endpoint)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SuperSecure!Password123"
}
```

**Response (Success): 200 OK**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "accountant",
    "departmentId": "dept-guid"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "rGVsb2NpbGhvc3Q6NTEyOA...",
  "expiresIn": 900,
  "requiresMfa": false
}
```

**Response (MFA Required): 200 OK**
```json
{
  "requiresMfa": true,
  "mfaSessionToken": "temp-session-guid",
  "email": "user@example.com"
}
```

**Response (Failure): 401 Unauthorized**
```json
{
  "message": "Invalid credentials or account locked."
}
```

**Process Flow:**
1. Validate email format and password non-empty
2. Query ApplicationUser by email (case-insensitive)
3. Check if account is locked (5 failed attempts, 15-minute lockout)
4. Compare password hash using `UserManager.CheckPasswordAsync()`
5. If password mismatch: Increment failed attempt counter
6. If successful and MFA enabled:
   - Generate temp session token
   - Return `requiresMfa: true`
7. If successful and no MFA:
   - Generate access token (15 min expiry)
   - Generate refresh token (7 day expiry)
   - Audit log: "LoginSucceeded"
   - Return tokens

**Location:** [AuthController.cs](../src/CMNetwork.WebApi/Controllers/AuthController.cs) → `Login()` method

---

#### `POST /api/auth/mfa/verify`
**Purpose:** Complete MFA challenge during login  
**Requires:** MFA session token (from login endpoint)

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "mfaSessionToken": "temp-session-guid"
}
```

**Response: 200 OK**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "rGVsb2NpbGhvc3Q6NTEyOA...",
  "expiresIn": 900
}
```

**Process Flow:**
1. Validate MFA session token is not expired
2. Verify TOTP code using user's authenticator secret
3. Reset failed login attempts counter
4. Generate access + refresh tokens
5. Audit log: "MfaVerified"

**Location:** [AuthController.cs](../src/CMNetwork.WebApi/Controllers/AuthController.cs) → `VerifyMfa()` method

---

#### `POST /api/auth/refresh`
**Purpose:** Obtain new access token using refresh token  
**Requires:** Valid refresh token

**Request Body:**
```json
{
  "refreshToken": "rGVsb2NpbGhvc3Q6NTEyOA..."
}
```

**Response: 200 OK**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "newRefreshTokenValue...",
  "expiresIn": 900
}
```

**Process Flow:**
1. Query RefreshToken by token value
2. Verify token is not expired
3. Verify token is not revoked
4. Fetch associated ApplicationUser
5. Mark old refresh token as used
6. Generate new access token
7. Generate new refresh token
8. Return both tokens

**Location:** [AuthController.cs](../src/CMNetwork.WebApi/Controllers/AuthController.cs) → `Refresh()` method

---

#### `POST /api/auth/logout`
**Purpose:** Invalidate refresh token and end session  
**Authorization:** Required (any authenticated user)

**Request Body (Optional):**
```json
{
  "refreshToken": "rGVsb2NpbGhvc3Q6NTEyOA..."
}
```

**Response: 200 OK**
```json
{
  "message": "Logged out successfully."
}
```

**Process Flow:**
1. Extract user ID from JWT claims
2. If refresh token provided: Mark as revoked in database
3. Audit log: "Logout"

**Location:** [AuthController.cs](../src/CMNetwork.WebApi/Controllers/AuthController.cs) → `Logout()` method

---

#### `GET /api/auth/health`
**Purpose:** Health check endpoint (no authentication required)  
**Used by:** Render deployment monitoring, smoke tests

**Response: 200 OK**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-10T14:30:00Z",
  "version": "1.0.0"
}
```

**Location:** [AuthController.cs](../src/CMNetwork.WebApi/Controllers/AuthController.cs) → `Health()` method

---

### 2. Admin Module

#### `GET /api/admin/users`
**Purpose:** List all users with pagination  
**Authorization:** `super-admin` role only  
**Pagination:** Default 10 per page

**Query Parameters:**
```
GET /api/admin/users?page=1&pageSize=10&search=john
```

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "user-guid",
      "email": "john.doe@cmnetwork.com",
      "fullName": "John Doe",
      "role": "accountant",
      "departmentId": "dept-guid",
      "departmentName": "Finance",
      "isActive": true,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `GetUsers()` method

---

#### `POST /api/admin/users`
**Purpose:** Create new user with auto-generated secure password  
**Authorization:** `super-admin` role only

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@cmnetwork.com",
  "role": "accountant",
  "departmentId": "dept-guid",
  "birthdate": "1990-05-15",
  "gender": "Female",
  "address": "123 Main St"
}
```

**Response: 201 Created**
```json
{
  "id": "new-user-guid",
  "email": "jane.smith@cmnetwork.com",
  "fullName": "Jane Smith",
  "role": "accountant",
  "generatedPassword": "Harbor-slate-lumen-2026-847!",
  "createdAt": "2026-05-10T14:00:00Z"
}
```

**Password Generation Algorithm:**
```
Pattern: Harbor-slate-lumen-{year}-{randomDigits}!
Example: Harbor-slate-lumen-2026-847!

- Meets ASP.NET Identity policy:
  * 12+ characters
  * Uppercase letters (Harbor, slate, lumen)
  * Lowercase letters
  * Digits (year + random 3-digit number: 100-999)
  * Symbol (!)

- Memorable but unique
- Complies with security policy defaults
```

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `CreateUser()` method and `ResolveGeneratedPassword()` helper

**Validation:**
1. Email format valid and unique
2. Required fields non-empty
3. Department exists (if provided)
4. Role is valid and exists
5. Password meets policy requirements

---

#### `PUT /api/admin/users/{id:guid}`
**Purpose:** Update user information  
**Authorization:** `super-admin` role only

**Request Body:**
```json
{
  "fullName": "Jane Marie Smith",
  "email": "jane.smith@cmnetwork.com",
  "role": "accountant",
  "departmentId": "new-dept-guid",
  "isActive": true
}
```

**Response: 200 OK**
```json
{
  "id": "user-guid",
  "email": "jane.smith@cmnetwork.com",
  "fullName": "Jane Marie Smith",
  "role": "accountant",
  "departmentId": "new-dept-guid",
  "isActive": true,
  "updatedAt": "2026-05-10T14:30:00Z"
}
```

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `UpdateUser()` method

---

#### `DELETE /api/admin/users/{id:guid}`
**Purpose:** Soft-delete user (mark inactive)  
**Authorization:** `super-admin` role only  
**Note:** User records are never hard-deleted for audit trail preservation

**Response: 200 OK**
```json
{
  "message": "User deleted successfully."
}
```

**Process Flow:**
1. Query user by ID
2. Set IsActive = false
3. Audit log: "UserDeleted"

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `DeleteUser()` method

---

#### `GET /api/admin/security-policy`
**Purpose:** Retrieve current security policy settings  
**Authorization:** `super-admin` role only

**Response: 200 OK**
```json
{
  "password": {
    "minLength": 12,
    "maxLength": 128,
    "blockedTerms": "password\n123456\n12345678\nqwerty",
    "forbidUserContext": true,
    "forbidCompanyName": true,
    "expireOnlyOnCompromise": true,
    "allowUnicode": true,
    "requireUppercase": false,
    "requireLowercase": false,
    "requireNumbers": false,
    "requireSymbols": false,
    "preventReuse": 0
  },
  "lockout": {
    "maxFailedAttempts": 5,
    "lockoutDurationMinutes": 15,
    "resetCounterAfterMinutes": 30
  },
  "session": {
    "idleTimeoutMinutes": 30,
    "absoluteTimeoutHours": 8,
    "singleSessionPerUser": false
  },
  "mfa": {
    "level": "high-privilege"
  },
  "ip": {
    "mode": "disabled",
    "allowedRanges": ""
  }
}
```

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `GetSecurityPolicySettings()` method

---

#### `PUT /api/admin/security-policy`
**Purpose:** Update security policy with validation and normalization  
**Authorization:** `super-admin` role only

**Request Body:**
```json
{
  "password": {
    "minLength": 14,
    "maxLength": 128,
    "forbidUserContext": true,
    "forbidCompanyName": true
  },
  "session": {
    "idleTimeoutMinutes": 20
  },
  "mfa": {
    "level": "all"
  }
}
```

**Response: 200 OK**
```json
{
  "password": { ... },
  "lockout": { ... },
  "session": { ... },
  "mfa": { ... },
  "ip": { ... }
}
```

**Validation & Normalization Logic:**
```
Password Policy:
  - MinLength clamped to [8, 15]
  - MaxLength clamped to [64, 256], must be >= MinLength
  - BlockedTerms: One term per line, minimum 3 chars
  - Merge custom terms with built-in dangerous terms

Lockout Policy:
  - MaxFailedAttempts clamped to [1, 20]
  - LockoutDurationMinutes clamped to [1, 1440]
  - ResetCounterAfterMinutes clamped to [1, 1440]

Session Policy:
  - IdleTimeoutMinutes clamped to [5, 480]
  - AbsoluteTimeoutHours clamped to [1, 24]
  - SingleSessionPerUser: boolean

MFA Policy:
  - Level must be one of: "none", "high-privilege", "all"

IP Policy:
  - Mode must be one of: "disabled", "allowlist"
  - AllowedRanges: CIDR notation, max 3500 chars
```

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `UpdateSecurityPolicySettings()` method

---

#### `GET /api/admin/smtp-settings`
**Purpose:** Retrieve current SMTP configuration  
**Authorization:** `super-admin` role only  
**Note:** Secrets (password) are never returned

**Response: 200 OK**
```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "fromEmail": "noreply@cmnetwork.com",
  "useTls": true,
  "isConfigured": true
}
```

---

#### `PUT /api/admin/smtp-settings`
**Purpose:** Configure SMTP server for email notifications  
**Authorization:** `super-admin` role only

**Request Body:**
```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "username": "noreply@cmnetwork.com",
  "password": "app-password-here",
  "fromEmail": "noreply@cmnetwork.com",
  "useTls": true
}
```

**Response: 200 OK**
```json
{
  "message": "SMTP settings updated and test email sent."
}
```

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `UpdateSmtpSettings()` method

---

### 3. General Ledger Module

#### `GET /api/general-ledger/accounts`
**Purpose:** List all Chart of Accounts  
**Authorization:** `accountant`, `cfo`, `super-admin`, `auditor`

**Response: 200 OK**
```json
[
  {
    "id": "account-guid",
    "accountCode": "1010",
    "name": "Cash - Checking Account",
    "type": "Asset",
    "parentAccountId": null,
    "isActive": true,
    "balance": 50000.00
  },
  {
    "id": "account-guid-2",
    "accountCode": "2010",
    "name": "Accounts Payable",
    "type": "Liability",
    "parentAccountId": null,
    "isActive": true,
    "balance": 15000.00
  }
]
```

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `GetAccounts()` method

---

#### `POST /api/general-ledger/journals`
**Purpose:** Create new journal entry (draft state)  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Request Body:**
```json
{
  "entryDate": "2026-05-10",
  "referenceNo": "CHK-001",
  "description": "Monthly office rent",
  "lines": [
    {
      "accountId": "1010-guid",
      "description": "Rent Expense",
      "debit": 5000.00,
      "credit": 0.00
    },
    {
      "accountId": "2010-guid",
      "description": "Bank Account",
      "debit": 0.00,
      "credit": 5000.00
    }
  ]
}
```

**Response: 201 Created**
```json
{
  "id": "journal-entry-guid",
  "entryNumber": "JE-00001",
  "entryDate": "2026-05-10",
  "status": "Draft",
  "createdBy": "accountant@cmnetwork.com",
  "createdAt": "2026-05-10T14:00:00Z"
}
```

**Validation:**
1. All account IDs valid and active
2. Entry date within active fiscal period
3. Total debits == total credits (within 0.01 tolerance)
4. Description non-empty
5. Reference number unique (per fiscal period)
6. User authorized (role check)

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `CreateJournal()` method

---

#### `GET /api/general-ledger/journals/{id:guid}`
**Purpose:** Retrieve specific journal entry details  
**Authorization:** `accountant`, `cfo`, `super-admin`, `auditor`

**Response: 200 OK**
```json
{
  "id": "journal-entry-guid",
  "entryNumber": "JE-00001",
  "entryDate": "2026-05-10",
  "referenceNo": "CHK-001",
  "description": "Monthly office rent",
  "status": "Posted",
  "lines": [
    {
      "id": "line-guid-1",
      "accountId": "1010-guid",
      "accountCode": "1010",
      "accountName": "Cash - Checking",
      "description": "Rent Expense",
      "debit": 5000.00,
      "credit": 0.00
    },
    {
      "id": "line-guid-2",
      "accountId": "2010-guid",
      "accountCode": "2010",
      "accountName": "Accounts Payable",
      "description": "Bank Account",
      "debit": 0.00,
      "credit": 5000.00
    }
  ],
  "createdBy": "accountant@cmnetwork.com",
  "createdAt": "2026-05-10T14:00:00Z",
  "postedBy": "cfo@cmnetwork.com",
  "postedAt": "2026-05-10T15:00:00Z"
}
```

---

#### `POST /api/general-ledger/journals/{id:guid}/post`
**Purpose:** Post journal entry (make immutable and update GL)  
**Authorization:** `cfo`, `super-admin`

**Response: 200 OK**
```json
{
  "id": "journal-entry-guid",
  "status": "Posted",
  "postedBy": "cfo@cmnetwork.com",
  "postedAt": "2026-05-10T15:00:00Z"
}
```

**Process Flow:**
1. Verify entry is Draft
2. Perform final validations
3. Update entry status to Posted
4. Mark entry as immutable
5. Audit log: "JournalPosted"

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `PostJournal()` method

---

#### `GET /api/general-ledger/trial-balance`
**Purpose:** Generate trial balance across all accounts  
**Authorization:** `accountant`, `cfo`, `super-admin`, `auditor`  
**Cached:** 5 minutes

**Query Parameters:**
```
GET /api/general-ledger/trial-balance?asOfDate=2026-05-10
```

**Response: 200 OK**
```json
{
  "asOfDate": "2026-05-10",
  "items": [
    {
      "accountCode": "1010",
      "accountName": "Cash - Checking",
      "type": "Asset",
      "totalDebit": 50000.00,
      "totalCredit": 0.00,
      "balance": 50000.00
    },
    {
      "accountCode": "2010",
      "accountName": "Accounts Payable",
      "type": "Liability",
      "totalDebit": 0.00,
      "totalCredit": 15000.00,
      "balance": -15000.00
    }
  ],
  "totals": {
    "totalDebit": 50000.00,
    "totalCredit": 15000.00,
    "totalBalance": 35000.00
  }
}
```

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `GetTrialBalance()` method

---

### 4. Accounts Payable (AP) Module

#### `GET /api/ap-invoices`
**Purpose:** List AP invoices with filtering and pagination  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Query Parameters:**
```
GET /api/ap-invoices?status=Registered&vendorId=guid&page=1&pageSize=10
```

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "ap-invoice-guid",
      "invoiceNumber": "INV-2026-00001",
      "vendorName": "ABC Supplies Corp",
      "invoiceDate": "2026-05-01",
      "dueDate": "2026-05-31",
      "totalAmount": 15000.00,
      "status": "Registered",
      "daysOverdue": -21,
      "poNumber": "PO-123456"
    }
  ],
  "total": 156,
  "page": 1,
  "pageSize": 10,
  "totalPages": 16
}
```

---

#### `POST /api/ap-invoices`
**Purpose:** Create new AP invoice  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Request Body:**
```json
{
  "vendorId": "vendor-guid",
  "invoiceNumber": "INV-2026-00456",
  "invoiceDate": "2026-05-01",
  "dueDate": "2026-05-31",
  "poNumber": "PO-123456",
  "totalAmount": 15000.00,
  "lines": [
    {
      "description": "Office Supplies",
      "accountId": "account-guid",
      "quantity": 100,
      "unitPrice": 150.00,
      "amount": 15000.00
    }
  ]
}
```

**Response: 201 Created**
```json
{
  "id": "ap-invoice-guid",
  "invoiceNumber": "INV-2026-00456",
  "status": "Draft",
  "createdAt": "2026-05-10T14:00:00Z"
}
```

---

#### `GET /api/ap-invoices/aging`
**Purpose:** Generate AP aging report for cash flow analysis  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Query Parameters:**
```
GET /api/ap-invoices/aging?asOfDate=2026-05-10
```

**Response: 200 OK**
```json
{
  "asOfDate": "2026-05-10",
  "summary": {
    "current": {
      "count": 25,
      "amount": 125000.00
    },
    "overdue_0_30": {
      "count": 10,
      "amount": 50000.00
    },
    "overdue_30_60": {
      "count": 5,
      "amount": 25000.00
    },
    "overdue_60_90": {
      "count": 3,
      "amount": 15000.00
    },
    "overdue_90plus": {
      "count": 2,
      "amount": 10000.00
    }
  },
  "totalAP": 225000.00
}
```

---

#### `POST /api/ap-invoices/{id:guid}/match`
**Purpose:** Perform 3-way matching against PO and receipt  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Request Body:**
```json
{
  "purchaseOrderId": "po-guid",
  "purchaseReceiptId": "receipt-guid"
}
```

**Response: 200 OK**
```json
{
  "id": "ap-invoice-guid",
  "matchStatus": "3-way",
  "matchResult": {
    "quantityMatch": true,
    "priceMatch": true,
    "amountMatch": true
  },
  "discrepancies": [],
  "matchConfidence": "high"
}
```

---

### 5. Accounts Receivable (AR) Module

#### `GET /api/ar-invoices`
**Purpose:** List AR invoices with aging analysis  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Query Parameters:**
```
GET /api/ar-invoices?status=Issued&customerId=guid&page=1&pageSize=10
```

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "ar-invoice-guid",
      "invoiceNumber": "INV-AR-00001",
      "customerName": "ABC Corp",
      "invoiceDate": "2026-04-10",
      "dueDate": "2026-05-10",
      "totalAmount": 50000.00,
      "paidAmount": 30000.00,
      "balanceDue": 20000.00,
      "status": "PartiallyPaid",
      "daysOverdue": 0
    }
  ],
  "total": 95,
  "page": 1,
  "pageSize": 10,
  "totalPages": 10
}
```

---

#### `GET /api/ar-invoices/aging`
**Purpose:** Generate receivables aging report  
**Authorization:** `accountant`, `cfo`, `super-admin`

**Query Parameters:**
```
GET /api/ar-invoices/aging?asOfDate=2026-05-10
```

**Response: 200 OK**
```json
{
  "asOfDate": "2026-05-10",
  "summary": {
    "current": {
      "count": 30,
      "amount": 200000.00
    },
    "overdue_0_30": {
      "count": 15,
      "amount": 75000.00
    },
    "overdue_30_60": {
      "count": 8,
      "amount": 40000.00
    },
    "overdue_60_90": {
      "count": 4,
      "amount": 20000.00
    },
    "overdue_90plus": {
      "count": 2,
      "amount": 10000.00
    }
  },
  "totalAR": 345000.00,
  "totalCollectible": 335000.00
}
```

---

### 6. Budget Module

#### `GET /api/budget/departments`
**Purpose:** List all departments with budget allocation and variance  
**Authorization:** Any authenticated user

**Response: 200 OK**
```json
[
  {
    "id": "dept-guid-1",
    "code": "FIN",
    "name": "Finance",
    "budgetAmount": 500000.00,
    "allocatedAmount": 350000.00,
    "actualSpent": 280000.00,
    "variance": 220000.00,
    "variancePercent": 44.0,
    "status": "under-budget"
  },
  {
    "id": "dept-guid-2",
    "code": "OPS",
    "name": "Operations",
    "budgetAmount": 300000.00,
    "allocatedAmount": 280000.00,
    "actualSpent": 310000.00,
    "variance": -10000.00,
    "variancePercent": -3.3,
    "status": "over-budget"
  }
]
```

**Status Classification:**
- "on-target": Variance between -5% and +10%
- "under-budget": Variance > +10%
- "over-budget": Variance < -5%

---

#### `POST /api/budget/reallocations`
**Purpose:** Request budget transfer between departments  
**Authorization:** `faculty-admin` (department head)

**Request Body:**
```json
{
  "sourceDepartmentId": "dept-guid-1",
  "targetDepartmentId": "dept-guid-2",
  "amount": 25000.00,
  "justification": "Operations needs additional headcount due to project expansion."
}
```

**Response: 201 Created**
```json
{
  "id": "reallocation-request-guid",
  "status": "Pending",
  "approvalQueueId": "queue-item-guid",
  "requiredApproverRole": "budget-officer",
  "createdAt": "2026-05-10T14:00:00Z"
}
```

**Routing Logic:**
- Amount < $5,000 → Requires `budget-officer` approval
- Amount $5,000 - $50,000 → Requires `budget-manager` approval
- Amount > $50,000 → Requires `cfo` approval

---

#### `GET /api/budget/reallocations/{id:guid}`
**Purpose:** Retrieve reallocation request with approval history  
**Authorization:** `faculty-admin`, `budget-manager`, `cfo`, `super-admin`

**Response: 200 OK**
```json
{
  "id": "reallocation-request-guid",
  "sourceDepartmentId": "dept-guid-1",
  "sourceDepartmentName": "Finance",
  "targetDepartmentId": "dept-guid-2",
  "targetDepartmentName": "Operations",
  "amount": 25000.00,
  "justification": "Operations needs additional headcount...",
  "status": "Approved",
  "approvalHistory": [
    {
      "approvedBy": "budget-officer@cmnetwork.com",
      "approverRole": "budget-officer",
      "approvedAt": "2026-05-10T16:00:00Z",
      "notes": "Approved. Funding available."
    }
  ],
  "processedAt": "2026-05-10T16:00:00Z"
}
```

---

### 7. Approvals Module

#### `GET /api/approvals/queue`
**Purpose:** List pending approvals for current user's role  
**Authorization:** Any authenticated user

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "queue-item-guid",
      "entityType": "APInvoice",
      "entityId": "ap-invoice-guid",
      "entityDescription": "INV-2026-00456 from ABC Supplies Corp",
      "amount": 15000.00,
      "requestedByName": "John Accountant",
      "requiredApproverRole": "cfo",
      "status": "Pending",
      "createdAt": "2026-05-10T08:00:00Z"
    },
    {
      "id": "queue-item-guid-2",
      "entityType": "BudgetReallocation",
      "entityId": "reallocation-request-guid",
      "entityDescription": "Transfer $25,000 from Finance to Operations",
      "amount": 25000.00,
      "requestedByName": "Jane Faculty Admin",
      "requiredApproverRole": "budget-officer",
      "status": "Pending",
      "createdAt": "2026-05-10T10:00:00Z"
    }
  ],
  "total": 2
}
```

**Queue Filtering Algorithm:**
1. If user is `super-admin`: Show all pending items
2. Else: Show only items where user's roles include `requiredApproverRole`
3. Sort by `createdAt` ascending (oldest first)

---

#### `GET /api/approvals/history`
**Purpose:** List approved/rejected items with processing details  
**Authorization:** Any authenticated user

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "queue-item-guid",
      "entityType": "APInvoice",
      "entityDescription": "INV-2026-00455 from Vendor X",
      "amount": 8000.00,
      "requestedByName": "John Accountant",
      "status": "Approved",
      "processedByName": "cfo@cmnetwork.com",
      "notes": "Approved for payment.",
      "processedAt": "2026-05-09T15:00:00Z",
      "createdAt": "2026-05-09T08:00:00Z"
    }
  ]
}
```

---

#### `POST /api/approvals/{id:guid}/approve`
**Purpose:** Approve pending request  
**Authorization:** User's role must match `requiredApproverRole`

**Request Body:**
```json
{
  "notes": "Approved for payment. Verified budget availability."
}
```

**Response: 200 OK**
```json
{
  "id": "queue-item-guid",
  "status": "Approved",
  "processedByName": "cfo@cmnetwork.com",
  "notes": "Approved for payment. Verified budget availability.",
  "processedAt": "2026-05-10T15:00:00Z"
}
```

**Process Flow:**
1. Validate user has required approver role
2. Validate item status is Pending
3. Validate user cannot approve own requests
4. Update ApprovalQueueItem status = Approved
5. If EntityType = "BudgetReallocation":
   - Deduct amount from source department budget
   - Add amount to target department budget
   - Create GL journal entry for fund transfer
6. Audit log: "ApprovalApproved"

---

#### `POST /api/approvals/{id:guid}/reject`
**Purpose:** Reject pending request  
**Authorization:** User's role must match `requiredApproverRole`

**Request Body:**
```json
{
  "notes": "Invoice does not match PO. Please verify quantities."
}
```

**Response: 200 OK**
```json
{
  "id": "queue-item-guid",
  "status": "Rejected",
  "processedByName": "cfo@cmnetwork.com",
  "notes": "Invoice does not match PO. Please verify quantities.",
  "processedAt": "2026-05-10T15:00:00Z"
}
```

---

### 8. Customer Portal Module

#### `GET /api/customer/invoices`
**Purpose:** List all AR invoices for authenticated customer  
**Authorization:** `customer` role (portal user)

**Response: 200 OK**
```json
{
  "customerName": "ABC Corporation",
  "customerCode": "CUST-00123",
  "invoices": [
    {
      "id": "ar-invoice-guid",
      "invoiceNumber": "INV-00001",
      "invoiceDate": "2026-04-01",
      "dueDate": "2026-05-01",
      "totalAmount": 50000.00,
      "status": "PartiallyPaid"
    },
    {
      "id": "ar-invoice-guid-2",
      "invoiceNumber": "INV-00002",
      "invoiceDate": "2026-05-01",
      "dueDate": "2026-06-01",
      "totalAmount": 35000.00,
      "status": "Issued"
    }
  ]
}
```

**Process Flow:**
1. Extract email from JWT `email` claim
2. Query Customer table by email (case-insensitive match)
3. If no customer found: Return 404
4. Query AR invoices where CustomerId matches and IsDeleted = false
5. Order by InvoiceDate descending
6. Return customer name + invoice list

---

#### `GET /api/customer/statement`
**Purpose:** Generate PDF account statement for customer  
**Authorization:** `customer` role  
**Content-Type:** `application/pdf`

**Response: 200 OK (PDF Binary)**
```
[Binary PDF Stream]
Header: Account Statement for ABC Corporation
Period: April 1, 2026 - May 10, 2026

Summary Section:
  Total Invoiced: $85,000.00
  Total Paid: $30,000.00
  Total Due: $55,000.00

Aging Detail:
  Current (0-30 days): $35,000.00 [1 invoice]
  31-60 days: $20,000.00 [1 invoice]

Invoice Details Table:
  [Detailed line items with dates, amounts, status]
```

**PDF Generation Algorithm:**
1. Authenticate customer
2. Fetch all invoices and transactions
3. Build PDF structure using QuestPDF:
   - Header section (company branding, title, date range)
   - Summary grid (total invoiced, paid, due)
   - Aging bucket breakdown
   - Detailed invoice table
   - Payment terms footer
4. Render to PDF binary
5. Return with `Content-Disposition: attachment; filename="statement-{date}.pdf"`

---

### 9. Audit Logs Module

#### `GET /api/audit-logs`
**Purpose:** Query audit trail of all system changes  
**Authorization:** `auditor`, `super-admin`

**Query Parameters:**
```
GET /api/audit-logs?entityName=APInvoice&action=Created&startDate=2026-05-01&endDate=2026-05-10&page=1&pageSize=50
```

**Response: 200 OK**
```json
{
  "items": [
    {
      "id": "audit-log-guid",
      "entityName": "APInvoice",
      "action": "Created",
      "actionCategory": "Create",
      "recordId": "ap-invoice-guid",
      "performedBy": "accountant@cmnetwork.com",
      "userEmail": "accountant@cmnetwork.com",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "details": {
        "invoiceNumber": "INV-2026-00456",
        "vendorId": "vendor-guid",
        "amount": 15000.00
      },
      "createdUtc": "2026-05-10T14:00:00Z"
    }
  ],
  "total": 1205,
  "page": 1,
  "pageSize": 50,
  "totalPages": 25
}
```

**Audit Categories:**
- `Login` / `Logout` — Authentication events
- `Create` / `Update` / `Delete` — Data changes
- `Post` / `Approve` / `Reject` — Business actions
- `Security` — Password resets, MFA changes
- `System` — Background jobs, migrations

---

## API Response Conventions

### Success Response (2xx)
```json
{
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response (4xx/5xx)
```json
{
  "message": "Human-readable error description",
  "errors": {
    "field1": ["Validation error 1", "Validation error 2"],
    "field2": ["Another error"]
  }
}
```

### Common HTTP Status Codes
| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate, state mismatch) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

**Document Version:** 1.0  
**Last Updated:** May 10, 2026  
**Maintainer:** CMNetwork Development Team
