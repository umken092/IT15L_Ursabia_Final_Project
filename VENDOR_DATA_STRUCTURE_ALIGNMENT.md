# Vendor Data Structure Alignment Analysis

## Overview
The CMNetwork loan payment system integrates with PayMongo as a payment vendor. This document outlines the data structure alignment between the system entities, PayMongo integration, and business logic.

## Entity Structure

### CustomerLoanPayment Entity
Located: `src/CMNetwork.Domain/Entities/CustomerLoanPayment.cs`

**Key Fields:**

| Field | Type | Purpose | Vendor Alignment |
|-------|------|---------|------------------|
| `Id` | Guid | Primary key | System-generated |
| `LoanId` | Guid | Foreign key to loan | System-owned |
| `PrincipalAmount` | decimal | Principal portion in PHP | System-calculated |
| `InterestAmount` | decimal | Interest portion in PHP | System-calculated |
| `TotalAmount` | decimal | Total payment amount | System-calculated |
| `PaymentMethod` | string | "PayMongo", "BankTransfer", etc. | Vendor-agnostic field |
| **`PayMongoCheckoutSessionId`** | string | **Vendor-specific session ID** | **PayMongo-only** |
| **`ExternalReference`** | string | **Generic external reference** | **Non-PayMongo payments** |
| `Status` | enum | Scheduled, Completed, Overdue, Waived | System-owned |
| `DueAtUtc` | DateTime | Due date | System-owned |
| `CompletedAtUtc` | DateTime | Actual completion time | System-owned |
| `ProcessedByUserId` | string | Who recorded/processed | System-owned |

**Database Schema:**
```sql
CREATE TABLE [CustomerLoanPayments] (
    [Id] uniqueidentifier NOT NULL,
    [LoanId] uniqueidentifier NOT NULL,
    [PrincipalAmount] decimal(18,2) NOT NULL,
    [InterestAmount] decimal(18,2) NOT NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [PaymentMethod] nvarchar(64) NOT NULL,
    [PayMongoCheckoutSessionId] nvarchar(256) NULL,
    [ExternalReference] nvarchar(256) NULL,
    [Status] int NOT NULL,
    [DueAtUtc] datetime2 NOT NULL,
    [CompletedAtUtc] datetime2 NULL,
    [ProcessedByUserId] nvarchar(450) NULL,
    [CreatedAtUtc] datetime2 NOT NULL,
    [UpdatedAtUtc] datetime2 NULL,
    CONSTRAINT [PK_CustomerLoanPayments] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_CustomerLoanPayments_CustomerLoans_LoanId] 
        FOREIGN KEY ([LoanId]) REFERENCES [CustomerLoans]([Id]) 
        ON DELETE CASCADE
);

CREATE INDEX [IX_CustomerLoanPayments_LoanId] 
    ON [CustomerLoanPayments]([LoanId]);
```

## Payment Status Flow

### Vendor Status vs System Status

The system maintains two separate status fields:

1. **Local Status (`Status` field):**
   - Scheduled (0) - Due in the future
   - Completed (1) - Paid on time
   - Overdue (2) - Payment is past due
   - Waived (3) - Forgiven by SuperAdmin

2. **Provider Status (`providerStatus` in API response):**
   - Retrieved from PayMongo API
   - Possible values: "active", "paid", "failed", etc.
   - Used to detect payment completion without waiting for webhook

### State Transitions

```
[Scheduled] 
    ↓ (User initiates PayMongo checkout)
    → PayMongoCheckoutSessionId = "cs_..."
    ↓ (PayMongo checkout completed by user)
    → providerStatus = "paid" (from PayMongo API)
    ↓ (Webhook or polling detects "paid")
    → Status = Completed
    → CompletedAtUtc = DateTime.UtcNow
    → ExternalReference = PayMongoCheckoutSessionId

[Overdue] 
    ↓ (Payment completed)
    → Status = Completed
    ↓ (If no remaining overdue payments on loan)
    → Loan.Status = Active
    → Loan.OverdueSinceUtc = null
```

## API Response Shape

### GET /api/loan-payments/installments/status

**Response Structure:**
```typescript
{
  paymentId: "ecb78ad4-9951-4ca1-e6c1-08deb573daa0",           // payment.Id
  status: "Scheduled",                                          // payment.Status.ToString()
  providerStatus: "active",                                     // PayMongo API status (if polling)
  isTerminal: false,                                            // Scheduled or Waived?
  completed: false,                                             // status == Completed?
  completedAt: null,                                            // payment.CompletedAtUtc
  amount: 4395.79,                                              // payment.TotalAmount
  referenceNo: "cs_e09afb823e4b63478f1369cf",                  // ExternalReference ?? PayMongoCheckoutSessionId
  loanId: "6126f309-54e7-47a7-57c0-08deb573da59",             // payment.LoanId
  paymentMethod: "PayMongo"                                     // payment.PaymentMethod
}
```

**Field Mapping:**
- `referenceNo = payment.ExternalReference ?? payment.PayMongoCheckoutSessionId`
  - **Before completion:** Shows PayMongo session ID (from `PayMongoCheckoutSessionId`)
  - **After completion:** Shows PayMongo session ID (copied to `ExternalReference`)
  - **For bank transfers:** Shows bank reference (from `ExternalReference`)

## Webhook Integration

### PayMongoWebhookController Responsibilities

**Webhook Event:** `checkout_session.paid`

**Processing Steps:**

1. **Lookup Payment:**
   - Query by `PayMongoCheckoutSessionId` with row-level lock
   - Load related `Loan` entity

2. **Validate State:**
   - Already completed? → Return OK (idempotent)
   - Not scheduled? → Return OK (invalid state)
   - Loan missing? → Return OK (data integrity check)

3. **Mark Completed:**
   - `payment.Status = Completed`
   - `payment.CompletedAtUtc = DateTime.UtcNow`
   - `payment.PaymentMethod = "PayMongo"`
   - `payment.ExternalReference = PayMongoCheckoutSessionId ?? ExternalReference`

4. **Update Loan Totals:**
   - `Loan.OutstandingPrincipal -= PrincipalAmount`
   - `Loan.TotalInterestAccrued += InterestAmount`

5. **Check Loan Status Transitions:**
   - If `OutstandingPrincipal ≤ 0.01` → `Loan.Status = FullyPaid`
   - Else if `Loan.Status == Overdue` → Check if any remaining overdue payments
     - If none → `Loan.Status = Active`, `Loan.OverdueSinceUtc = null`

6. **Post Accounting Entry:**
   - Call `PostCustomerCashReceiptAsync()` to record GL entry
   - Reference: `ExternalReference ?? PaymentId`

7. **Transaction Commit:**
   - Serializable isolation level
   - All-or-nothing operation

### Data Alignment Issues (Now Fixed)

**Issue #1: Missing Overdue Transition Logic**
- ✅ **Fixed:** Webhook now checks for Overdue → Active transition
- Location: `CompleteLoanInstallmentPaymentAsync()` in `PayMongoWebhookController.cs`

**Issue #2: Missing Accounting Entry**
- ✅ **Fixed:** Webhook now calls `PostCustomerCashReceiptAsync()`
- Ensures GL entries match payment completions
- Location: `CompleteLoanInstallmentPaymentAsync()` in `PayMongoWebhookController.cs`

**Issue #3: ExternalReference Inconsistency**
- ✅ **Fixed:** Using same logic as `ApplyCompletedInstallmentPaymentAsync()`
- `ExternalReference = PayMongoCheckoutSessionId ?? ExternalReference`
- Preserves existing values if present
- Location: `CompleteLoanInstallmentPaymentAsync()` in `PayMongoWebhookController.cs`

## Vendor Abstraction Pattern

### Current Approach
The system uses a **field-based approach** rather than inheritance:
- Generic fields: `PaymentMethod`, `ExternalReference`, `Status`
- Vendor-specific fields: `PayMongoCheckoutSessionId` (PayMongo only), with room for future vendors

### Advantages
✅ Simple to understand and maintain
✅ Single table for all payment types
✅ Easy to extend with new vendors

### Disadvantages
⚠️ Can become complex if many vendor-specific fields are added
⚠️ Requires careful field naming conventions

### Extension Pattern
To support a new vendor (e.g., GCash, Stripe):
1. Add field: `GCashTransactionId`, `StripePaymentIntentId`, etc.
2. Add logic in webhook handler
3. Update response shape to select correct reference field

Example:
```csharp
referenceNo = payment.ExternalReference 
    ?? payment.PayMongoCheckoutSessionId 
    ?? payment.StripePaymentIntentId 
    ?? payment.GCashTransactionId
```

## Data Integrity Safeguards

### Locking Strategy
- **Row-level locks (UPDLOCK, ROWLOCK)** on payment record during webhook processing
- Prevents race conditions if multiple webhooks arrive for same payment

### Idempotency
- Webhook is idempotent (can be called multiple times safely)
- Checks if payment already `Completed` before processing
- Safe retry strategy for failed webhook deliveries

### Transaction Isolation
- **Serializable** isolation level during payment completion
- Ensures loan status transitions are consistent
- Prevents phantom reads when checking for remaining overdue payments

### Data Validation
- Verifies `Loan` exists (no orphaned payments)
- Validates payment status is `Scheduled` before completing
- Confirms payment is associated with current customer

## Testing Considerations

### Webhook Processing
- Test idempotent behavior (replay same webhook)
- Test loan status transitions (Overdue → Active)
- Test concurrent webhook deliveries (locking)
- Test missing/invalid payment scenarios

### Status Polling
- Verify `providerStatus` matches PayMongo API
- Test auto-completion when polling detects "paid"
- Test fallback behavior if PayMongo API fails

### Accounting Integration
- Verify GL entries posted for each completed payment
- Check reference numbers are logged correctly
- Verify amount matches (PHP currency)

## Summary

The CMNetwork loan payment system properly aligns vendor (PayMongo) data with the system data structure through:

1. **Dedicated vendor fields** (`PayMongoCheckoutSessionId`) alongside generic fields
2. **Clear status semantics** (local vs provider status)
3. **Complete webhook processing** including accounting and loan status transitions
4. **Idempotent, locked operations** for data integrity
5. **Room for future vendor expansion** without schema redesign

All vendor data structure issues identified have been addressed in the latest webhook implementation.
