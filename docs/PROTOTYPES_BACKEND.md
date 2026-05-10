# CMNetwork Backend Prototypes

## Overview

This document describes the major backend prototypes implemented in CMNetwork, including the functionality, APIs, and algorithms that power each subsystem. Each prototype demonstrates core business logic and data flow.

---

## 1. General Ledger & Journal Entry System

### Purpose
The General Ledger module provides double-entry bookkeeping capabilities, allowing Accountants and CFOs to create journal entries, maintain a Chart of Accounts, and generate trial balances for reconciliation and financial reporting.

### Key Features

**Journal Entry Creation:**
- Date-based transaction recording
- Multi-line debit/credit entries (balanced to zero)
- Reference numbers for external tracking
- Support for recurring entries
- Entry status: Draft, Posted, Reversed

**Chart of Accounts Management:**
- Hierarchical account structure (parent/child relationships)
- Account types: Asset, Liability, Equity, Revenue, Expense
- Account codes and descriptive names
- Active/inactive account management

**Trial Balance Calculation:**
- Aggregates all journal entries per account
- Calculates running balances (debit - credit)
- Groups by account type for financial reporting
- Real-time balance updates

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| API Controller | [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) | HTTP endpoints for journal/account operations |
| Domain Model | [JournalEntry.cs](../src/CMNetwork.Domain/Entities/JournalEntry.cs) | Entity definition |
| Database Context | [CMNetworkDbContext.cs](../src/CMNetwork.Infrastructure/Persistence/CMNetworkDbContext.cs) | EF Core configuration |
| Frontend Module | [AccountantOperationsModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/AccountantOperationsModule.tsx) | React UI for GL operations |

### APIs & Algorithms

#### API: Create Journal Entry
```
POST /api/general-ledger/journals
Authorization: Bearer {token}
Role Required: accountant, cfo, super-admin

Request Body:
{
  "entryDate": "2026-05-10",
  "referenceNo": "CHK-001",
  "description": "Monthly rent payment",
  "lines": [
    {
      "accountId": "guid-asset-1",
      "description": "Rent Expense",
      "debit": 5000.00,
      "credit": 0.00
    },
    {
      "accountId": "guid-liability-1",
      "description": "Bank Account",
      "debit": 0.00,
      "credit": 5000.00
    }
  ]
}

Response: 201 Created
{
  "id": "journal-guid",
  "entryNumber": "JE-00123",
  "status": "Draft",
  "createdBy": "user-email",
  "createdAt": "2026-05-10T14:30:00Z"
}
```

**Validation Algorithm:**
1. Check user authorization (must have accountant+ role)
2. Validate entry date is within active fiscal period
3. Verify all line account IDs exist and are active
4. Ensure total debits == total credits (within 0.01 rounding tolerance)
5. Check for duplicate reference numbers in same period
6. Validate description is not empty
7. Create audit log entry before persisting

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `CreateJournal()` method

---

#### Algorithm: Trial Balance Calculation

**Purpose:** Generates a real-time snapshot of account balances across all posted journal entries.

**Process Flow:**

```
1. Query all JournalEntry records where Status == Posted
2. For each JournalEntry, iterate its JournalLines
3. Aggregate lines by AccountId:
   - Sum all Debit amounts
   - Sum all Credit amounts
4. For each Account in Chart of Accounts:
   - Calculate Balance = TotalDebit - TotalCredit
   - Determine account class (Asset, Liability, etc.)
5. Group results by account type for reporting
6. Validate: Total Assets = Total (Liabilities + Equity)
```

**Complexity:** O(n) where n = total journal lines  
**Caching:** Trial balance cached for 5 minutes (configurable) to avoid recalculation on every request

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `GetTrialBalance()` method

---

#### API: Post Journal Entry
```
POST /api/general-ledger/journals/{journalId}/post
Authorization: Bearer {token}
Role Required: cfo, super-admin

Response: 200 OK
{
  "id": "journal-guid",
  "status": "Posted",
  "postedBy": "admin-email",
  "postedAt": "2026-05-10T14:35:00Z"
}
```

**Post Logic:**
- Only Draft entries can be posted
- Once posted, entry becomes immutable (no edits)
- Reversal available for corrections (creates reversing entry)
- Audit log records who posted and when
- Trial balance automatically updated

**Location:** [GeneralLedgerController.cs](../src/CMNetwork.WebApi/Controllers/GeneralLedgerController.cs) → `PostJournal()` method

---

## 2. Accounts Payable (AP) Invoice Processing

### Purpose
AP module manages vendor invoices, supports 3-way matching (PO/Receipt/Invoice), tracks aging, and orchestrates approval workflows.

### Key Features

**Invoice Registration:**
- Vendor selection from database
- Amount, terms, and due date entry
- Line-item details (account coding, quantity, unit price)
- Document attachment support
- Status tracking: Draft → Registered → Matched → Approved → Paid

**Three-Way Matching:**
- Validates invoice quantity matches purchase order (PO)
- Validates received quantity matches purchase receipt (PR)
- Flags discrepancies for manual review
- Calculates variance percentages (price, quantity)

**Aging Analysis:**
- Tracks invoice age from creation date
- Categories: Current (0-30 days), 31-60 days, 61-90 days, 90+ days
- Computes total AP by aging bucket for cash flow planning

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| API Controller | [APInvoicesController.cs](../src/CMNetwork.WebApi/Controllers/APInvoicesController.cs) | AP invoice endpoints |
| Invoice Entity | [APInvoice.cs](../src/CMNetwork.Domain/Entities/APInvoice.cs) | Domain model |
| Frontend UI | [APInvoicesModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/APInvoicesModule.tsx) | React AP UI |

### APIs & Algorithms

#### API: Create AP Invoice
```
POST /api/ap-invoices
Authorization: Bearer {token}
Role Required: accountant, cfo, super-admin

Request Body:
{
  "vendorId": "vendor-guid",
  "invoiceNumber": "INV-2026-00456",
  "invoiceDate": "2026-05-01",
  "dueDate": "2026-05-31",
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

Response: 201 Created
{
  "id": "ap-invoice-guid",
  "status": "Draft",
  "createdAt": "2026-05-10T10:00:00Z"
}
```

**Validation:**
1. Vendor exists and is active
2. Invoice amount > 0
3. Invoice date ≤ current date
4. Due date ≥ invoice date
5. Each line amount = quantity × unit price (±0.01)
6. Sum of line amounts = total invoice amount
7. All account codes are valid

#### Algorithm: Three-Way Matching

**Purpose:** Ensures invoice, PO, and receipt quantities and amounts align before payment.

**Process Flow:**

```
1. Get Invoice by ID
2. Fetch associated PurchaseOrder by PO ID
3. Fetch associated PurchaseReceipt by PR ID

4. Quantity Matching:
   - If Invoice Qty != PO Qty:
     - Calculate Variance% = |Invoice Qty - PO Qty| / PO Qty * 100
     - If Variance% > Tolerance (e.g., 5%):
       - Flag "Quantity Mismatch" with severity HIGH
     - Else: Flag "Quantity Variance" with severity LOW
   
   - If Invoice Qty != Receipt Qty:
     - Similar variance calculation
     - Possible scenarios:
       * Partial receipt (invoice exceeds receipt): Flag pending receipt
       * Over-receipt (receipt exceeds invoice): Flag investigation needed

5. Price Matching:
   - If Invoice UnitPrice != PO UnitPrice:
     - Calculate Price Variance% = |Invoice Price - PO Price| / PO Price * 100
     - If Variance% > Tolerance (e.g., 3%):
       - Flag "Price Mismatch" with severity HIGH
     - Else: Flag "Price Variance" with severity LOW

6. Amount Matching:
   - If Invoice Amount != (Receipt Qty × Invoice UnitPrice):
     - Flag "Amount Mismatch"

7. Determine Match Status:
   - 2-way match: Invoice matches either PO or Receipt
   - 3-way match: All three documents aligned (within tolerance)
   - No match: Significant discrepancies detected
```

**Location:** [APInvoicesController.cs](../src/CMNetwork.WebApi/Controllers/APInvoicesController.cs) → `MatchInvoiceAsync()` method

**Tolerance Configuration:** Customizable via [SecurityPolicyModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/SecurityPolicyModule.tsx)

---

#### API: Get AP Aging Report
```
GET /api/ap-invoices/aging
Authorization: Bearer {token}
Role Required: accountant, cfo, super-admin

Query Parameters:
  - asOfDate=2026-05-10 (optional, defaults to today)

Response: 200 OK
{
  "asOfDate": "2026-05-10",
  "summary": {
    "current": { "count": 25, "amount": 125000.00 },
    "overdue_0_30": { "count": 10, "amount": 50000.00 },
    "overdue_30_60": { "count": 5, "amount": 25000.00 },
    "overdue_60_90": { "count": 3, "amount": 15000.00 },
    "overdue_90plus": { "count": 2, "amount": 10000.00 }
  },
  "totalAP": 225000.00
}
```

**Aging Calculation Algorithm:**

```
For each AP Invoice where Status != Paid and Status != Cancelled:
  - daysOverdue = (asOfDate - InvoiceDueDate).Days
  - If daysOverdue < 0: Bucket = "Current"
  - Else if daysOverdue <= 30: Bucket = "0-30 days"
  - Else if daysOverdue <= 60: Bucket = "30-60 days"
  - Else if daysOverdue <= 90: Bucket = "60-90 days"
  - Else: Bucket = "90+ days"
  - Add Amount to Bucket
```

**Location:** [APInvoicesController.cs](../src/CMNetwork.WebApi/Controllers/APInvoicesController.cs) → `GetAgingReport()` method

---

## 3. Accounts Receivable (AR) Invoice & Customer Portal

### Purpose
AR module tracks customer invoices and provides a Customer Portal where customers can view their invoice history and download PDF statements.

### Key Features

**Invoice Creation & Tracking:**
- Customer assignment
- Invoice line items with account coding
- Status workflow: Draft → Issued → Partially Paid → Paid → Credited
- Tax calculation support
- Payment tracking

**Customer Portal:**
- View all issued invoices for authenticated customer
- Download PDF account statement
- Track payment history
- View aging information

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| AR Controller | [ARInvoicesController.cs](../src/CMNetwork.WebApi/Controllers/ARInvoicesController.cs) | AR invoice management |
| Customer Portal | [CustomerPortalController.cs](../src/CMNetwork.WebApi/Controllers/CustomerPortalController.cs) | Customer-facing API |
| Portal Frontend | [CustomerPortalModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/CustomerPortalModule.tsx) | Customer portal UI |

### APIs & Algorithms

#### API: Get Customer Invoices (Portal)
```
GET /api/customer/invoices
Authorization: Bearer {token}
Role Required: customer

Response: 200 OK
{
  "customerName": "ABC Corp",
  "customerCode": "CUST-001",
  "invoices": [
    {
      "id": "ar-invoice-guid",
      "invoiceNumber": "INV-00001",
      "invoiceDate": "2026-04-01",
      "dueDate": "2026-05-01",
      "totalAmount": 50000.00,
      "status": "PartiallyPaid"
    }
  ]
}
```

**Logic:**
1. Extract current user email from JWT claims
2. Find Customer entity matching email
3. Query all AR invoices where CustomerId matches and IsDeleted = false
4. Order by InvoiceDate descending
5. Return only relevant fields for customer visibility

**Location:** [CustomerPortalController.cs](../src/CMNetwork.WebApi/Controllers/CustomerPortalController.cs) → `GetMyInvoices()` method

---

#### API: Generate PDF Statement (QuestPDF)
```
GET /api/customer/statement
Authorization: Bearer {token}
Role Required: customer

Response: 200 OK (Content-Type: application/pdf)
[Binary PDF Document]
```

**PDF Generation Algorithm (QuestPDF Library):**

```
1. Authenticate user and fetch Customer entity
2. Query all AR invoices for customer
3. Build statement structure:
   - Header: Company logo, statement title, date range
   - Customer info section: Name, address, customer code
   - Summary grid:
     * Total Invoiced
     * Total Paid
     * Total Due
   - Aged invoices table:
     * Invoice #, Date, Amount, Status
     * Grouped by aging bucket (0-30, 31-60, etc.)
   - Footer: Terms, payment instructions
4. Use QuestPDF Fluent API to compose layout
5. Render to PDF binary stream
6. Return with Content-Disposition: attachment
```

**Location:** [CustomerPortalController.cs](../src/CMNetwork.WebApi/Controllers/CustomerPortalController.cs) → `GetStatement()` method

**Library:** QuestPDF (open-source .NET library)  
**Configuration:** Licensed as NonCommercial in [Program.cs](../src/CMNetwork.WebApi/Program.cs)

---

## 4. Budget Management & Reallocation Workflow

### Purpose
Budget module allows departments to plan expenditures, track actual spending vs. budget, and request budget reallocations with approval workflows.

### Key Features

**Budget Allocation:**
- Annual budget per department
- Categorized by expense type
- Variance tracking (actual vs. budget)
- Budget lock/unlock cycles

**Reallocation Requests:**
- Department heads request budget transfer from source to target department
- Multi-step approval: Budget Officer → Budget Manager → CFO
- Audit trail of all modifications
- Support for partial approvals

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| Budget Controller | [BudgetController.cs](../src/CMNetwork.WebApi/Controllers/BudgetController.cs) | Budget operations |
| Budget Entity | [Department.cs](../src/CMNetwork.Domain/Entities/Department.cs) | Budget allocation model |

### APIs & Algorithms

#### API: Get Budget Status
```
GET /api/budget/departments
Authorization: Bearer {token}
Role Required: any authenticated user

Response: 200 OK
{
  "departments": [
    {
      "id": "dept-guid",
      "code": "FIN",
      "name": "Finance",
      "budgetAmount": 500000.00,
      "allocatedAmount": 350000.00,
      "actualSpent": 280000.00,
      "variance": 70000.00,
      "variancePercent": 20.0
    }
  ]
}
```

**Variance Calculation Algorithm:**

```
For each Department:
  - Variance = BudgetAmount - ActualSpent
  - VariancePercent = (Variance / BudgetAmount) * 100
  - Classification:
    * VariancePercent > 10%: "Under Budget" (green)
    * VariancePercent between -5% and 10%: "On Target" (yellow)
    * VariancePercent < -5%: "Over Budget" (red)
```

**Location:** [BudgetController.cs](../src/CMNetwork.WebApi/Controllers/BudgetController.cs) → `GetDepartmentBudgets()` method

---

#### Algorithm: Budget Reallocation Approval Chain

**Purpose:** Route reallocation requests through appropriate approvers based on amount.

**Process Flow:**

```
1. Department head submits reallocation request:
   - Source Department ID
   - Target Department ID
   - Amount
   - Justification

2. Validation:
   - Source department has sufficient budget
   - Target department exists and is not source
   - Amount > 0
   - Justification non-empty

3. Create ApprovalQueueItem:
   - EntityType = "BudgetReallocation"
   - RequiredApproverRole determined by amount:
     * Amount < $5,000: RequiredApproverRole = "budget-officer"
     * Amount $5,000 - $50,000: RequiredApproverRole = "budget-manager"
     * Amount > $50,000: RequiredApproverRole = "cfo"
   - Status = Pending

4. Route to appropriate approver role

5. On approval:
   - Update source department: BudgetAmount -= Amount
   - Update target department: BudgetAmount += Amount
   - Create journal entry: Debit fund center, Credit fund source
   - Mark ApprovalQueueItem status = Approved
   - Log audit entry

6. On rejection:
   - Mark ApprovalQueueItem status = Rejected
   - Store rejection reason in Notes
   - Notify requester
```

**Location:** [ApprovalsController.cs](../src/CMNetwork.WebApi/Controllers/ApprovalsController.cs) → `Approve()` / `Reject()` methods

---

## 5. Bank Reconciliation

### Purpose
Bank Reconciliation module matches bank statement lines against GL transactions to identify discrepancies and maintain accurate cash records.

### Key Features

**Statement Matching:**
- Upload bank statement (CSV/OFX)
- Automatic matching against GL transactions
- Support for pending transactions
- Reconciling item tracking

**Discrepancy Detection:**
- Amount mismatches
- Date variances (outstanding checks)
- Missing transactions (bank charges, interest)

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| Reconciliation Controller | [BankReconciliationController.cs](../src/CMNetwork.WebApi/Controllers/BankReconciliationController.cs) | Reconciliation API |
| Bank Statement Entity | [BankStatement.cs](../src/CMNetwork.Domain/Entities/BankStatement.cs) | Statement model |

### APIs & Algorithms

#### Algorithm: Automatic Transaction Matching

**Purpose:** Match bank statement lines to GL entries using amount and date proximity.

**Process Flow:**

```
For each BankStatementLine:
  - Search GL transactions for same amount, ±3 days
  - Match confidence scoring:
    * Amount matches exactly: +30 points
    * Amount within 0.01: +25 points (rounding errors)
    * Date matches exactly: +20 points
    * Date within 1 day: +10 points
    * Date within 3 days: +5 points
  
  - If total score >= 50: Auto-match (confidence: HIGH)
  - If total score 30-49: Suggested match (confidence: MEDIUM)
  - If total score < 30: No match (confidence: LOW)

  - For unmatched lines:
    * Check if in "Pending" bucket (outstanding checks/deposits in transit)
    * If age > 30 days: Flag for investigation
```

**Location:** [BankReconciliationController.cs](../src/CMNetwork.WebApi/Controllers/BankReconciliationController.cs) → `ReconcileStatement()` method

---

## 6. Approval Queue & Workflow Orchestration

### Purpose
Centralized approval workflow engine that routes requests (invoices, reallocations, expense claims) to appropriate approvers based on amount and role.

### Key Features

**Queue Management:**
- Tracks all pending approvals
- Filters by user role
- History of processed approvals
- Approval notes and audit trail

**Routing Logic:**
- Amount-based routing
- Role-based assignment
- Escalation for special cases

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| Approvals Controller | [ApprovalsController.cs](../src/CMNetwork.WebApi/Controllers/ApprovalsController.cs) | Approval endpoints |
| Queue Entity | [ApprovalQueueItem.cs](../src/CMNetwork.Domain/Entities/ApprovalQueueItem.cs) | Queue model |

### APIs & Algorithms

#### API: Get Approval Queue
```
GET /api/approvals/queue
Authorization: Bearer {token}
Role Required: any authenticated user

Response: 200 OK
{
  "items": [
    {
      "id": "queue-item-guid",
      "entityType": "APInvoice",
      "entityId": "invoice-guid",
      "entityDescription": "INV-2026-00456 from ABC Corp",
      "amount": 15000.00,
      "requestedByName": "John Doe",
      "requiredApproverRole": "cfo",
      "status": "Pending",
      "createdAt": "2026-05-10T08:00:00Z"
    }
  ]
}
```

**Queue Filtering Algorithm:**

```
1. Get current user's roles
2. Query ApprovalQueueItems where Status = "Pending"
3. Filter items:
   - If user is SuperAdmin: Show all items
   - Else: Show only items where RequiredApproverRole IN user's roles
4. Sort by CreatedAtUtc (ascending)
5. Return paginated results
```

**Location:** [ApprovalsController.cs](../src/CMNetwork.WebApi/Controllers/ApprovalsController.cs) → `GetQueue()` method

---

## 7. Payroll & Expense Claims

### Purpose
Payroll module manages employee compensation, tax deductions, and benefits. Expense Claims handles employee reimbursement requests with multi-level approval.

### Key Features

**Payroll Processing:**
- Salary/hourly wage calculation
- Tax deduction computation
- Benefits management (health insurance, 401k)
- Pay stub generation via PDF

**Expense Claims:**
- Employee submission of out-of-pocket expenses
- Receipt attachment (image/PDF)
- Classification by expense type
- Approval routing based on amount
- Reimbursement tracking

### Source Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| Payroll Controller | [PayslipsController.cs](../src/CMNetwork.WebApi/Controllers/PayslipsController.cs) | Payroll endpoints |
| Expense Claims | [ExpenseClaimsController.cs](../src/CMNetwork.WebApi/Controllers/ExpenseClaimsController.cs) | Claims API |

---

## Summary

All CMNetwork backend prototypes follow a consistent architectural pattern:

1. **API Controller** exposes HTTP endpoints with role-based authorization
2. **Domain Entities** model business data
3. **EF Core Queries** fetch and persist data
4. **Business Algorithms** implement core logic (matching, aging, approvals)
5. **Audit Logging** tracks all state changes automatically via [AuditEventLogger.cs](../src/CMNetwork.Infrastructure/Services/AuditEventLogger.cs)

The system prioritizes **auditability**, **double-entry consistency**, and **workflow orchestration** to support institutional financial governance.

---

**Document Version:** 1.0  
**Last Updated:** May 10, 2026  
**Maintainer:** CMNetwork Development Team
