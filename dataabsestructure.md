# CMNetwork Database Structure and Data Dictionary

Generated: May 5, 2026

This document describes the CMNetwork database structure based on the EF Core model and migrations in the system. It contains:

- A visual Entity Relationship Diagram (ERD)
- A complete data dictionary for application, finance, audit, identity, and workflow tables
- Enum/value mappings used by integer status/type fields

## Entity Relationship Diagram

```mermaid
erDiagram
    Departments ||--o{ BudgetReallocationRequests : "source department"
    Departments ||--o{ BudgetReallocationRequests : "target department"
    Departments ||..o{ AspNetUsers : "logical department"

    AspNetUsers ||--o{ RefreshTokens : "owns"
    AspNetUsers ||--o{ AspNetUserClaims : "has claims"
    AspNetUsers ||--o{ AspNetUserLogins : "has logins"
    AspNetUsers ||--o{ AspNetUserTokens : "has tokens"
    AspNetUsers ||--o{ AspNetUserRoles : "assigned roles"
    AspNetRoles ||--o{ AspNetUserRoles : "assigned users"
    AspNetRoles ||--o{ AspNetRoleClaims : "has claims"

    ChartOfAccounts ||--o{ ChartOfAccounts : "parent account"
    ChartOfAccounts ||--o{ JournalEntryLines : "posting account"
    JournalEntries ||--o{ JournalEntryLines : "contains lines"
    FiscalPeriods ||--o{ BankStatements : "period statements"
    BankStatements ||--o{ BankTransactions : "contains transactions"
    BankStatements ||--|| BankReconciliations : "has reconciliation"
    JournalEntryLines ||--o{ BankTransactions : "matched transaction"

    Vendors ||--o{ APInvoices : "vendor invoices"
    APInvoices ||--o{ APInvoiceLines : "contains lines"
    ChartOfAccounts ||--o{ APInvoiceLines : "expense account"

    Customers ||--o{ ARInvoices : "customer invoices"
    ARInvoices ||--o{ ARInvoiceLines : "contains lines"
    ChartOfAccounts ||--o{ ARInvoiceLines : "revenue account"

    AuditLogs ||..o{ EvidenceArchives : "included audit ids json"
    ApprovalQueue }o..|| APInvoices : "polymorphic entity"
    ApprovalQueue }o..|| ExpenseClaims : "polymorphic entity"

    Departments {
        uniqueidentifier Id PK
        nvarchar Code UK
        nvarchar Name
        nvarchar Description
        decimal BudgetAmount
    }

    AspNetUsers {
        uniqueidentifier Id PK
        nvarchar FirstName
        nvarchar LastName
        uniqueidentifier DepartmentId
        nvarchar Email
        bit IsActive
    }

    AspNetRoles {
        uniqueidentifier Id PK
        nvarchar Name
        nvarchar NormalizedName UK
    }

    RefreshTokens {
        uniqueidentifier Id PK
        uniqueidentifier UserId FK
        nvarchar Token
        datetime2 ExpiresUtc
        bit IsRevoked
    }

    ChartOfAccounts {
        uniqueidentifier Id PK
        nvarchar AccountCode UK
        nvarchar Name
        int Type
        uniqueidentifier ParentAccountId FK
    }

    FiscalPeriods {
        uniqueidentifier Id PK
        nvarchar Name UK
        date StartDate
        date EndDate
        bit IsClosed
    }

    JournalEntries {
        uniqueidentifier Id PK
        nvarchar EntryNumber UK
        date EntryDate
        int Status
    }

    JournalEntryLines {
        uniqueidentifier Id PK
        uniqueidentifier JournalEntryId FK
        uniqueidentifier AccountId FK
        decimal Debit
        decimal Credit
    }

    Vendors {
        uniqueidentifier Id PK
        nvarchar VendorCode UK
        nvarchar Name
    }

    Customers {
        uniqueidentifier Id PK
        nvarchar CustomerCode UK
        nvarchar Name
    }

    APInvoices {
        uniqueidentifier Id PK
        uniqueidentifier VendorId FK
        nvarchar InvoiceNumber UK
        decimal TotalAmount
        int Status
    }

    APInvoiceLines {
        uniqueidentifier Id PK
        uniqueidentifier APInvoiceId FK
        uniqueidentifier ChartOfAccountId FK
        decimal Amount
    }

    ARInvoices {
        uniqueidentifier Id PK
        uniqueidentifier CustomerId FK
        nvarchar InvoiceNumber UK
        decimal TotalAmount
        int Status
    }

    ARInvoiceLines {
        uniqueidentifier Id PK
        uniqueidentifier ARInvoiceId FK
        uniqueidentifier ChartOfAccountId FK
        decimal Amount
    }

    BankStatements {
        uniqueidentifier Id PK
        uniqueidentifier FiscalPeriodId FK
        nvarchar BankAccountName
        decimal OpeningBalance
        decimal ClosingBalance
    }

    BankTransactions {
        uniqueidentifier Id PK
        uniqueidentifier BankStatementId FK
        uniqueidentifier MatchedJournalEntryLineId FK
        decimal Amount
    }

    BankReconciliations {
        uniqueidentifier Id PK
        uniqueidentifier BankStatementId FK_UK
        int Status
        decimal Difference
    }

    ExpenseClaims {
        uniqueidentifier Id PK
        nvarchar ClaimNumber UK
        uniqueidentifier EmployeeId
        decimal Amount
        int Status
    }

    ApprovalQueue {
        uniqueidentifier Id PK
        nvarchar EntityType
        uniqueidentifier EntityId
        int Status
    }

    Payslips {
        uniqueidentifier Id PK
        nvarchar PayslipNumber UK
        uniqueidentifier EmployeeId
        decimal GrossPay
        decimal NetPay
    }

    BudgetReallocationRequests {
        uniqueidentifier Id PK
        nvarchar RequestNumber UK
        uniqueidentifier SourceDepartmentId FK
        uniqueidentifier TargetDepartmentId FK
        decimal Amount
        int Status
    }
```

## Relationship Summary

| Relationship | Type | Description |
|---|---:|---|
| Departments to BudgetReallocationRequests | 1 to many | A department can be the source of many budget reallocation requests. |
| Departments to BudgetReallocationRequests | 1 to many | A department can be the target of many budget reallocation requests. |
| Departments to AspNetUsers | Logical 1 to many | Users contain DepartmentId, but the current EF snapshot does not define a database FK constraint for it. |
| AspNetUsers to RefreshTokens | 1 to many | A user can have many refresh tokens. Tokens cascade delete with the user. |
| AspNetUsers to AspNetUserClaims | 1 to many | A user can have many identity claims. |
| AspNetUsers to AspNetUserLogins | 1 to many | A user can have many external login records. |
| AspNetUsers to AspNetUserTokens | 1 to many | A user can have many identity token records. |
| AspNetUsers to AspNetRoles | many to many | Implemented through AspNetUserRoles. |
| AspNetRoles to AspNetRoleClaims | 1 to many | A role can have many claims. |
| ChartOfAccounts to ChartOfAccounts | self 1 to many | An account can have child/sub accounts through ParentAccountId. |
| ChartOfAccounts to JournalEntryLines | 1 to many | A GL account can be used by many journal lines. |
| JournalEntries to JournalEntryLines | 1 to many | A journal entry owns multiple debit/credit lines. Lines cascade delete with the journal entry. |
| FiscalPeriods to BankStatements | 1 to many optional | A fiscal period can contain bank statements. If a period is deleted, statements keep a null period. |
| BankStatements to BankTransactions | 1 to many | A bank statement owns multiple transactions. Transactions cascade delete with the statement. |
| BankStatements to BankReconciliations | 1 to 1 | One statement can have one reconciliation. Reconciliation cascades with the statement. |
| JournalEntryLines to BankTransactions | 1 to many optional | Bank transactions can optionally match a journal entry line. If the line is deleted, match is set null. |
| Vendors to APInvoices | 1 to many | A vendor can have many AP invoices. Vendor delete is restricted when invoices exist. |
| APInvoices to APInvoiceLines | 1 to many | An AP invoice owns multiple lines. Lines cascade delete with the invoice. |
| ChartOfAccounts to APInvoiceLines | 1 to many | AP invoice lines are mapped to GL accounts. Account delete is restricted. |
| Customers to ARInvoices | 1 to many | A customer can have many AR invoices. Customer delete is restricted when invoices exist. |
| ARInvoices to ARInvoiceLines | 1 to many | An AR invoice owns multiple lines. Lines cascade delete with the invoice. |
| ChartOfAccounts to ARInvoiceLines | 1 to many | AR invoice lines are mapped to GL accounts. Account delete is restricted. |
| ApprovalQueue to business entities | Polymorphic | EntityType and EntityId point to records such as APInvoice or ExpenseClaim by convention, not by FK. |
| EvidenceArchives to AuditLogs | Logical many | IncludedAuditLogIdsJson stores a JSON list of included AuditLogs.Id values, not an FK table. |

## Data Dictionary

### Departments

Purpose: Stores organization units and department budget amounts.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique department identifier. |
| Code | nvarchar | 32 | Required unique department code, such as FIN, HR, or OPS. |
| Name | nvarchar | 128 | Required department name. |
| Description | nvarchar | 512 | Optional department description. |
| BudgetAmount | decimal | 18,2 | Department budget amount. |

### SecurityPolicies

Purpose: Stores configurable system security policies.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique security policy identifier. |
| Name | nvarchar | 128 | Required policy name. |
| Description | nvarchar | 256 | Required policy description. |
| IsEnabled | bit | 1 | Indicates whether the policy is active. |
| Value | nvarchar | 4000 | Required policy value or rule text. |

### IntegrationSettings

Purpose: Stores external integration configuration and sync status.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique integration setting identifier. |
| Name | nvarchar | 128 | Required integration name. |
| Status | nvarchar | 64 | Required integration status text. |
| Endpoint | nvarchar | 512 | Required integration endpoint URL or address. |
| LastSyncUtc | datetime2 | 8 bytes | Optional timestamp of the last successful sync. |

### BackupRecords

Purpose: Stores backup execution history.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique backup record identifier. |
| StartedUtc | datetime2 | 8 bytes | Backup start time in UTC. |
| Status | nvarchar | 64 | Required backup status. |
| SizeInMb | decimal | 18,2 | Backup size in megabytes. |
| DurationSeconds | int | 4 bytes | Backup duration in seconds. |

### AspNetUsers

Purpose: Stores application users and employee identity profile data.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique user identifier. |
| FirstName | nvarchar | 64 | Required user first name. |
| LastName | nvarchar | 64 | Required user last name. |
| MiddleName | nvarchar | 64 | Required middle name field; may contain an empty string. |
| Birthdate | date | 3 bytes | Optional birthdate. |
| Gender | nvarchar | 16 | Required gender field; may contain an empty string. |
| Address | nvarchar | 512 | Required address field; may contain an empty string. |
| TIN | nvarchar | 32 | Required tax identification number field; may contain an empty string. |
| SSS | nvarchar | 32 | Required SSS number field; may contain an empty string. |
| DepartmentId | uniqueidentifier | 16 bytes | Optional logical department identifier. Current model does not enforce an FK constraint. |
| IsActive | bit | 1 | Indicates whether the user account is active. |
| JoinDate | date | 3 bytes | User employment or account join date. |
| AuthenticatorKey | nvarchar | 256 | Optional authenticator key for MFA. |
| CreatedUtc | datetime2 | 8 bytes | User creation timestamp in UTC. |
| LastLoginUtc | datetime2 | 8 bytes | Optional last login timestamp in UTC. |
| UserName | nvarchar | 256 | Identity username. |
| NormalizedUserName | nvarchar | 256 | Normalized username. Unique when not null. |
| Email | nvarchar | 256 | User email address. |
| NormalizedEmail | nvarchar | 256 | Normalized email address. Indexed. |
| EmailConfirmed | bit | 1 | Indicates whether email is confirmed. |
| PasswordHash | nvarchar | max | Hashed password value. |
| SecurityStamp | nvarchar | max | Identity security stamp. |
| ConcurrencyStamp | nvarchar | max | Identity concurrency token. |
| PhoneNumber | nvarchar | max | Optional phone number. |
| PhoneNumberConfirmed | bit | 1 | Indicates whether phone number is confirmed. |
| TwoFactorEnabled | bit | 1 | Indicates whether two-factor authentication is enabled. |
| LockoutEnd | datetimeoffset | 10 bytes | Optional lockout end timestamp. |
| LockoutEnabled | bit | 1 | Indicates whether lockout is enabled. |
| AccessFailedCount | int | 4 bytes | Number of failed access attempts. |

### AspNetRoles

Purpose: Stores application roles used by ASP.NET Identity.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique role identifier. |
| Name | nvarchar | 256 | Role name. |
| NormalizedName | nvarchar | 256 | Normalized role name. Unique when not null. |
| ConcurrencyStamp | nvarchar | max | Identity concurrency token. |

### AspNetUserRoles

Purpose: Join table assigning roles to users.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| UserId | uniqueidentifier | 16 bytes | Composite primary key and FK to AspNetUsers.Id. |
| RoleId | uniqueidentifier | 16 bytes | Composite primary key and FK to AspNetRoles.Id. |

### AspNetUserClaims

Purpose: Stores claims assigned directly to users.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | int | 4 bytes | Primary key identity column. |
| UserId | uniqueidentifier | 16 bytes | FK to AspNetUsers.Id. |
| ClaimType | nvarchar | max | Claim type. |
| ClaimValue | nvarchar | max | Claim value. |

### AspNetRoleClaims

Purpose: Stores claims assigned to roles.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | int | 4 bytes | Primary key identity column. |
| RoleId | uniqueidentifier | 16 bytes | FK to AspNetRoles.Id. |
| ClaimType | nvarchar | max | Claim type. |
| ClaimValue | nvarchar | max | Claim value. |

### AspNetUserLogins

Purpose: Stores external login provider records for users.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| LoginProvider | nvarchar | 450 | Composite primary key. External login provider name. |
| ProviderKey | nvarchar | 450 | Composite primary key. Provider-specific user key. |
| ProviderDisplayName | nvarchar | max | Display name for the login provider. |
| UserId | uniqueidentifier | 16 bytes | FK to AspNetUsers.Id. |

### AspNetUserTokens

Purpose: Stores identity tokens for users.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| UserId | uniqueidentifier | 16 bytes | Composite primary key and FK to AspNetUsers.Id. |
| LoginProvider | nvarchar | 450 | Composite primary key. Login provider name. |
| Name | nvarchar | 450 | Composite primary key. Token name. |
| Value | nvarchar | max | Token value. |

### RefreshTokens

Purpose: Stores JWT refresh tokens used for authentication sessions.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique refresh token identifier. |
| UserId | uniqueidentifier | 16 bytes | Required FK to AspNetUsers.Id. |
| Token | nvarchar | 512 | Required refresh token string. |
| ExpiresUtc | datetime2 | 8 bytes | Token expiration timestamp in UTC. |
| CreatedUtc | datetime2 | 8 bytes | Token creation timestamp in UTC. |
| IsRevoked | bit | 1 | Indicates whether the token has been revoked. |
| ReplacedByToken | nvarchar | 512 | Optional replacement token string. |
| RevokedReason | nvarchar | 256 | Optional reason for revocation. |
| RevokedUtc | datetime2 | 8 bytes | Optional revocation timestamp. |
| CreatedByIp | nvarchar | 45 | Optional IP address that created the token. |

### AuditLogs

Purpose: Stores immutable audit events. Deletes are blocked. Updates are allowed only for review-tracking fields.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique audit log identifier. |
| EntityName | nvarchar | 128 | Required audited entity name or logical event name. |
| Action | nvarchar | 64 | Required action performed, such as Insert, Update, Delete, Login, or Approve. |
| ActionCategory | nvarchar | 32 | Required high-level action group. Default is DataChange. |
| RecordId | nvarchar | 128 | Optional affected record primary key or correlation id. |
| PerformedBy | nvarchar | 256 | Required user identifier or system actor. |
| UserEmail | nvarchar | 256 | Optional denormalized user email for filtering. |
| IpAddress | nvarchar | 64 | Optional client IP address. |
| UserAgent | nvarchar | 512 | Optional client user agent. |
| DetailsJson | nvarchar | max | Optional JSON payload containing details, before/after values, or request metadata. |
| CreatedUtc | datetime2 | 8 bytes | Audit event creation timestamp in UTC. |
| IsReviewed | bit | 1 | Indicates whether the audit event was reviewed. |
| ReviewedBy | nvarchar | 256 | Optional reviewer identifier/name. |
| ReviewedDate | datetime2 | 8 bytes | Optional review timestamp. |

### EvidenceArchives

Purpose: Stores metadata for audit evidence archive files generated by auditors.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique evidence archive identifier. |
| ArchiveNumber | nvarchar | 64 | Required unique archive number. |
| Title | nvarchar | 256 | Required archive title. |
| Description | nvarchar | 2048 | Optional archive description. |
| FilePath | nvarchar | 512 | Required relative path to the archive file. |
| FileName | nvarchar | 256 | Required archive file name. |
| FileSizeBytes | bigint | 8 bytes | Archive file size in bytes. |
| ContentType | nvarchar | 128 | Required MIME content type. |
| Checksum | nvarchar | 128 | Required checksum, such as SHA-256 hex digest. |
| EntryCount | int | 4 bytes | Number of audit log entries included in the archive. |
| IncludedAuditLogIdsJson | nvarchar | max | Required JSON list of included AuditLogs.Id values. |
| GeneratedBy | nvarchar | 256 | Required user who generated the archive. |
| GeneratedByEmail | nvarchar | 256 | Optional email of generator. |
| GeneratedUtc | datetime2 | 8 bytes | Archive generation timestamp in UTC. |

### ChartOfAccounts

Purpose: Stores the general ledger account master list.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique account identifier. |
| AccountCode | nvarchar | 32 | Required unique account code. |
| Name | nvarchar | 256 | Required account name. |
| Type | int | 4 bytes | Account type enum: 1 Asset, 2 Liability, 3 Equity, 4 Revenue, 5 Expense. |
| ParentAccountId | uniqueidentifier | 16 bytes | Optional self-referencing FK to parent account. |
| IsActive | bit | 1 | Indicates whether account is active. |
| CreatedUtc | datetime2 | 8 bytes | Account creation timestamp in UTC. |

### FiscalPeriods

Purpose: Stores accounting periods.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique fiscal period identifier. |
| Name | nvarchar | 64 | Required unique fiscal period name. |
| StartDate | date | 3 bytes | Period start date. |
| EndDate | date | 3 bytes | Period end date. |
| IsClosed | bit | 1 | Indicates whether the fiscal period is closed. |
| CreatedUtc | datetime2 | 8 bytes | Fiscal period creation timestamp in UTC. |

### JournalEntries

Purpose: Stores journal entry headers.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique journal entry identifier. |
| EntryNumber | nvarchar | 32 | Required unique journal entry number. |
| EntryDate | date | 3 bytes | Journal entry date. |
| Description | nvarchar | 512 | Required journal entry description. |
| ReferenceNo | nvarchar | 128 | Optional external or internal reference number. |
| Status | int | 4 bytes | Journal status enum: 1 Draft, 2 Posted. |
| CreatedBy | nvarchar | 256 | Required creator identifier/name. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| PostedBy | nvarchar | 256 | Optional posting user identifier/name. |
| PostedUtc | datetime2 | 8 bytes | Optional posting timestamp in UTC. |

### JournalEntryLines

Purpose: Stores debit and credit lines for journal entries.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique journal line identifier. |
| JournalEntryId | uniqueidentifier | 16 bytes | Required FK to JournalEntries.Id. |
| AccountId | uniqueidentifier | 16 bytes | Required FK to ChartOfAccounts.Id. |
| Description | nvarchar | 512 | Optional line description. |
| Debit | decimal | 18,2 | Debit amount. |
| Credit | decimal | 18,2 | Credit amount. |

### Vendors

Purpose: Stores supplier/vendor master records.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique vendor identifier. |
| VendorCode | nvarchar | 32 | Required unique vendor code. |
| Name | nvarchar | 256 | Required vendor name. |
| ContactPerson | nvarchar | 128 | Optional contact person. |
| Email | nvarchar | 256 | Optional email address. |
| PhoneNumber | nvarchar | 32 | Optional phone number. |
| Address | nvarchar | 512 | Optional street/mailing address. |
| City | nvarchar | 128 | Optional city. |
| State | nvarchar | 64 | Optional state/province. |
| PostalCode | nvarchar | 16 | Optional postal code. |
| Country | nvarchar | 128 | Optional country. |
| TaxId | nvarchar | 64 | Optional tax identifier. |
| PaymentTerms | nvarchar | 64 | Optional payment terms. |
| CreditLimit | decimal | 18,2 | Vendor credit limit amount. |
| IsActive | bit | 1 | Indicates whether vendor is active. Default is true. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| LastUpdatedUtc | datetime2 | 8 bytes | Optional last update timestamp in UTC. |

### Customers

Purpose: Stores customer master records.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique customer identifier. |
| CustomerCode | nvarchar | 32 | Required unique customer code. |
| Name | nvarchar | 256 | Required customer name. |
| ContactPerson | nvarchar | 128 | Optional contact person. |
| Email | nvarchar | 256 | Optional email address. |
| PhoneNumber | nvarchar | 32 | Optional phone number. |
| Address | nvarchar | 512 | Optional street/mailing address. |
| City | nvarchar | 128 | Optional city. |
| State | nvarchar | 64 | Optional state/province. |
| PostalCode | nvarchar | 16 | Optional postal code. |
| Country | nvarchar | 128 | Optional country. |
| TaxId | nvarchar | 64 | Optional tax identifier. |
| PaymentTerms | nvarchar | 64 | Optional payment terms. |
| CreditLimit | decimal | 18,2 | Customer credit limit amount. |
| IsActive | bit | 1 | Indicates whether customer is active. Default is true. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| LastUpdatedUtc | datetime2 | 8 bytes | Optional last update timestamp in UTC. |

### APInvoices

Purpose: Stores accounts payable invoice headers.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique AP invoice identifier. |
| VendorId | uniqueidentifier | 16 bytes | Required FK to Vendors.Id. |
| InvoiceNumber | nvarchar | 64 | Required unique AP invoice number. |
| InvoiceDate | datetime2 | 8 bytes | Invoice date. |
| DueDate | datetime2 | 8 bytes | Invoice due date. |
| TotalAmount | decimal | 18,2 | Total AP invoice amount. |
| Status | int | 4 bytes | AP invoice status enum: 1 Draft, 2 Submitted, 3 Approved, 4 Paid, 5 Void. Default is 1. |
| PurchaseOrderId | uniqueidentifier | 16 bytes | Optional purchase order identifier. No FK is currently configured. |
| CreatedByUserId | nvarchar | 256 | Required creator user identifier. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| LastModifiedByUserId | nvarchar | 256 | Optional last modifying user identifier. |
| LastModifiedUtc | datetime2 | 8 bytes | Optional last modification timestamp. |
| IsDeleted | bit | 1 | Soft delete flag. Default is false. |
| DeletedUtc | datetime2 | 8 bytes | Optional soft deletion timestamp. |

### APInvoiceLines

Purpose: Stores line items for accounts payable invoices.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique AP invoice line identifier. |
| APInvoiceId | uniqueidentifier | 16 bytes | Required FK to APInvoices.Id. |
| ChartOfAccountId | uniqueidentifier | 16 bytes | Required FK to ChartOfAccounts.Id. |
| Description | nvarchar | 512 | Required line description. |
| Quantity | decimal | 18,4 | Quantity billed. |
| UnitPrice | decimal | 18,2 | Unit price. |
| Amount | decimal | 18,2 | Line amount. |
| TaxAmount | decimal | 18,2 | Optional tax amount. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |

### ARInvoices

Purpose: Stores accounts receivable invoice headers.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique AR invoice identifier. |
| CustomerId | uniqueidentifier | 16 bytes | Required FK to Customers.Id. |
| InvoiceNumber | nvarchar | 64 | Required unique AR invoice number. |
| InvoiceDate | datetime2 | 8 bytes | Invoice date. |
| DueDate | datetime2 | 8 bytes | Invoice due date. |
| TotalAmount | decimal | 18,2 | Total AR invoice amount. |
| Status | int | 4 bytes | AR invoice status enum: 1 Draft, 2 Sent, 3 Approved, 4 Paid, 5 Void. Default is 1. |
| CreatedByUserId | nvarchar | 256 | Required creator user identifier. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| LastModifiedByUserId | nvarchar | 256 | Optional last modifying user identifier. |
| LastModifiedUtc | datetime2 | 8 bytes | Optional last modification timestamp. |
| IsDeleted | bit | 1 | Soft delete flag. Default is false. |
| DeletedUtc | datetime2 | 8 bytes | Optional soft deletion timestamp. |

### ARInvoiceLines

Purpose: Stores line items for accounts receivable invoices.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique AR invoice line identifier. |
| ARInvoiceId | uniqueidentifier | 16 bytes | Required FK to ARInvoices.Id. |
| ChartOfAccountId | uniqueidentifier | 16 bytes | Required FK to ChartOfAccounts.Id. |
| Description | nvarchar | 512 | Required line description. |
| Quantity | decimal | 18,4 | Quantity billed. |
| UnitPrice | decimal | 18,2 | Unit price. |
| Amount | decimal | 18,2 | Line amount. |
| TaxAmount | decimal | 18,2 | Optional tax amount. |
| CreatedUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |

### BankStatements

Purpose: Stores imported bank statement headers.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique bank statement identifier. |
| BankAccountName | nvarchar | 128 | Required bank account name. |
| BankAccountNumber | nvarchar | 64 | Optional bank account number. |
| StatementDate | date | 3 bytes | Bank statement date. |
| OpeningBalance | decimal | 18,2 | Opening balance. |
| ClosingBalance | decimal | 18,2 | Closing balance. |
| FiscalPeriodId | uniqueidentifier | 16 bytes | Optional FK to FiscalPeriods.Id. |
| ImportedBy | nvarchar | 256 | Required importer identifier/name. |
| ImportedAtUtc | datetime2 | 8 bytes | Import timestamp in UTC. |

### BankTransactions

Purpose: Stores transaction lines imported from bank statements.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique bank transaction identifier. |
| BankStatementId | uniqueidentifier | 16 bytes | Required FK to BankStatements.Id. |
| TransactionDate | date | 3 bytes | Transaction date. |
| Description | nvarchar | 512 | Required transaction description. |
| Reference | nvarchar | 128 | Optional bank/reference number. |
| Amount | decimal | 18,2 | Transaction amount. |
| IsDebit | bit | 1 | Indicates whether transaction is a debit. |
| IsMatched | bit | 1 | Indicates whether transaction has been reconciled/matched. |
| MatchedJournalEntryLineId | uniqueidentifier | 16 bytes | Optional FK to JournalEntryLines.Id. |
| MatchedBy | nvarchar | 256 | Optional user who matched the transaction. |
| MatchedAtUtc | datetime2 | 8 bytes | Optional match timestamp in UTC. |

### BankReconciliations

Purpose: Stores reconciliation records for bank statements.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique bank reconciliation identifier. |
| BankStatementId | uniqueidentifier | 16 bytes | Required unique FK to BankStatements.Id. |
| BankAccountName | nvarchar | 128 | Required bank account name. |
| Status | int | 4 bytes | Reconciliation status enum: 1 Open, 2 Finalized. |
| Difference | decimal | 18,2 | Optional reconciliation difference amount. |
| Notes | nvarchar | 1024 | Optional reconciliation notes. |
| CreatedBy | nvarchar | 256 | Required creator identifier/name. |
| CreatedAtUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| FinalizedBy | nvarchar | 256 | Optional finalizing user identifier/name. |
| FinalizedAtUtc | datetime2 | 8 bytes | Optional finalization timestamp in UTC. |

### ExpenseClaims

Purpose: Stores employee expense claims.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique expense claim identifier. |
| ClaimNumber | nvarchar | 32 | Required unique claim number. |
| EmployeeId | uniqueidentifier | 16 bytes | Employee/user identifier. Current model does not enforce an FK constraint. |
| EmployeeName | nvarchar | 256 | Required employee name snapshot. |
| ClaimDate | date | 3 bytes | Expense claim date. |
| Category | nvarchar | 64 | Required expense category. |
| Description | nvarchar | 512 | Required expense description. |
| Amount | decimal | 18,2 | Claimed amount. |
| ReceiptUrl | nvarchar | 1024 | Optional receipt file or URL. |
| Status | int | 4 bytes | Expense claim status enum: 1 Draft, 2 Submitted, 3 Approved, 4 Rejected. |
| ReviewedBy | nvarchar | 256 | Optional reviewer identifier/name. |
| ReviewNotes | nvarchar | 512 | Optional review notes. |
| ReviewedAtUtc | datetime2 | 8 bytes | Optional review timestamp in UTC. |
| SubmittedAtUtc | datetime2 | 8 bytes | Submission timestamp in UTC. |
| CreatedAtUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |

### ApprovalQueue

Purpose: Stores generic approval workflow items for different business entities.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique approval queue item identifier. |
| EntityType | nvarchar | 64 | Required target entity type, such as ExpenseClaim or APInvoice. |
| EntityId | uniqueidentifier | 16 bytes | Target entity id. Polymorphic reference, not database-enforced. |
| EntityDescription | nvarchar | 512 | Required human-readable entity description. |
| Amount | decimal | 18,2 | Optional amount requiring approval. |
| RequestedByUserId | nvarchar | 256 | Required requester user identifier. |
| RequestedByName | nvarchar | 256 | Required requester name snapshot. |
| RequiredApproverRole | nvarchar | 64 | Required role needed to approve item. |
| Status | int | 4 bytes | Approval status enum: 1 Pending, 2 Approved, 3 Rejected. |
| ProcessedByUserId | nvarchar | 256 | Optional processor/approver user identifier. |
| ProcessedByName | nvarchar | 256 | Optional processor/approver name snapshot. |
| Notes | nvarchar | 512 | Optional processing notes. |
| CreatedAtUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| ProcessedAtUtc | datetime2 | 8 bytes | Optional processing timestamp in UTC. |

### Payslips

Purpose: Stores payroll payslip records.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique payslip identifier. |
| PayslipNumber | nvarchar | 32 | Required unique payslip number. |
| EmployeeId | uniqueidentifier | 16 bytes | Employee/user identifier. Current model does not enforce an FK constraint. |
| EmployeeName | nvarchar | 256 | Required employee name snapshot. |
| PeriodStart | date | 3 bytes | Payroll period start date. |
| PeriodEnd | date | 3 bytes | Payroll period end date. |
| GrossPay | decimal | 18,2 | Gross pay amount. |
| TaxDeduction | decimal | 18,2 | Tax deduction amount. |
| SssDeduction | decimal | 18,2 | SSS deduction amount. |
| PhilHealthDeduction | decimal | 18,2 | PhilHealth deduction amount. |
| PagIbigDeduction | decimal | 18,2 | Pag-IBIG deduction amount. |
| OtherDeductions | decimal | 18,2 | Other deduction amount. |
| NetPay | decimal | 18,2 | Net pay amount. |
| GeneratedBy | nvarchar | 256 | Required generator identifier/name. |
| GeneratedAtUtc | datetime2 | 8 bytes | Generation timestamp in UTC. |

### BudgetReallocationRequests

Purpose: Stores workflow requests to move budget from one department to another.

| Field Name | Datatype | Length | Description |
|---|---|---:|---|
| Id | uniqueidentifier | 16 bytes | Primary key. Unique budget request identifier. |
| RequestNumber | nvarchar | 32 | Required unique request number. |
| SourceDepartmentId | uniqueidentifier | 16 bytes | Required FK to Departments.Id for source department. |
| TargetDepartmentId | uniqueidentifier | 16 bytes | Required FK to Departments.Id for target department. |
| Amount | decimal | 18,2 | Requested transfer amount. |
| Currency | nvarchar | 8 | Required currency code. |
| Justification | nvarchar | 1024 | Required business justification. |
| Status | int | 4 bytes | Budget reallocation status enum: 1 Pending, 2 Approved, 3 Rejected. |
| EffectiveDate | datetime2 | 8 bytes | Effective date for the reallocation. |
| RequestedByUserId | nvarchar | 256 | Required requester user identifier. |
| RequestedByName | nvarchar | 256 | Required requester name snapshot. |
| CreatedAtUtc | datetime2 | 8 bytes | Creation timestamp in UTC. |
| ProcessedByName | nvarchar | 256 | Optional processor/approver name. |
| ProcessedAtUtc | datetime2 | 8 bytes | Optional processing timestamp in UTC. |
| DecisionNotes | nvarchar | 1024 | Optional approval/rejection notes. |

## Enum Reference

| Enum | Stored Datatype | Values |
|---|---|---|
| AccountType | int | 1 Asset, 2 Liability, 3 Equity, 4 Revenue, 5 Expense |
| JournalEntryStatus | int | 1 Draft, 2 Posted |
| APInvoiceStatus | int | 1 Draft, 2 Submitted, 3 Approved, 4 Paid, 5 Void |
| ARInvoiceStatus | int | 1 Draft, 2 Sent, 3 Approved, 4 Paid, 5 Void |
| BankReconciliationStatus | int | 1 Open, 2 Finalized |
| ExpenseClaimStatus | int | 1 Draft, 2 Submitted, 3 Approved, 4 Rejected |
| ApprovalItemStatus | int | 1 Pending, 2 Approved, 3 Rejected |
| BudgetReallocationStatus | int | 1 Pending, 2 Approved, 3 Rejected |

## Index and Key Summary

| Table | Keys and Indexes |
|---|---|
| Departments | PK Id, unique index Code |
| SecurityPolicies | PK Id |
| IntegrationSettings | PK Id |
| BackupRecords | PK Id |
| AspNetUsers | PK Id, unique filtered NormalizedUserName, index NormalizedEmail |
| AspNetRoles | PK Id, unique filtered NormalizedName |
| AspNetUserRoles | Composite PK UserId + RoleId, FK UserId, FK RoleId |
| AspNetUserClaims | PK Id, FK UserId |
| AspNetRoleClaims | PK Id, FK RoleId |
| AspNetUserLogins | Composite PK LoginProvider + ProviderKey, FK UserId |
| AspNetUserTokens | Composite PK UserId + LoginProvider + Name, FK UserId |
| RefreshTokens | PK Id, index UserId |
| AuditLogs | PK Id, indexes CreatedUtc, ActionCategory, UserEmail, EntityName |
| EvidenceArchives | PK Id, unique index ArchiveNumber, index GeneratedUtc |
| ChartOfAccounts | PK Id, unique index AccountCode, index ParentAccountId |
| FiscalPeriods | PK Id, unique index Name |
| JournalEntries | PK Id, unique index EntryNumber |
| JournalEntryLines | PK Id, index JournalEntryId, index AccountId |
| Vendors | PK Id, unique index VendorCode |
| Customers | PK Id, unique index CustomerCode |
| APInvoices | PK Id, unique index InvoiceNumber, index IsDeleted, composite index VendorId + Status |
| APInvoiceLines | PK Id, index APInvoiceId, index ChartOfAccountId |
| ARInvoices | PK Id, unique index InvoiceNumber, index IsDeleted, composite index CustomerId + Status |
| ARInvoiceLines | PK Id, index ARInvoiceId, index ChartOfAccountId |
| BankStatements | PK Id, index FiscalPeriodId |
| BankTransactions | PK Id, index BankStatementId, index MatchedJournalEntryLineId |
| BankReconciliations | PK Id, unique index BankStatementId |
| ExpenseClaims | PK Id, unique index ClaimNumber |
| ApprovalQueue | PK Id |
| Payslips | PK Id, unique index PayslipNumber |
| BudgetReallocationRequests | PK Id, unique index RequestNumber, indexes SourceDepartmentId and TargetDepartmentId |

## Runtime Job Queue Storage

The Job Queue module reads live background job data from Hangfire. Hangfire stores recurring jobs, queued jobs, job states, retry data, server heartbeats, and counters in SQL Server under the `HangFire` schema. These tables are created and maintained by Hangfire at runtime, so they are runtime support tables rather than CMNetwork domain entities.

| Table | Purpose |
|---|---|
| HangFire.Job | Stores background job payloads and creation/expiration metadata. |
| HangFire.State | Stores job lifecycle states such as Scheduled, Processing, Succeeded, Failed, and Deleted. |
| HangFire.JobQueue | Stores queued job ids and queue names for workers. |
| HangFire.Hash | Stores recurring job definitions, cron expressions, last run, next run, and related metadata. |
| HangFire.Set | Stores named sets used by recurring jobs, scheduled jobs, retries, and counters. |
| HangFire.List | Stores list-based runtime values used internally by Hangfire. |
| HangFire.Counter | Stores transient counters used by Hangfire monitoring. |
| HangFire.AggregatedCounter | Stores aggregated counter values used by Hangfire monitoring. |
| HangFire.Server | Stores active Hangfire server heartbeat and worker metadata. |
| HangFire.JobParameter | Stores parameters attached to individual jobs. |
| HangFire.Schema | Stores Hangfire SQL schema version metadata. |

## Notes

- `ApprovalQueue.EntityType` and `ApprovalQueue.EntityId` form a polymorphic reference and are not database-enforced foreign keys.
- `EvidenceArchives.IncludedAuditLogIdsJson` stores related audit log ids as JSON rather than through a join table.
- `AspNetUsers.DepartmentId`, `ExpenseClaims.EmployeeId`, and `Payslips.EmployeeId` are logical references in the domain, but the current EF model snapshot does not enforce all of them with database foreign-key constraints.
- `AuditLogs` is designed as append-only. The DbContext blocks deletes and only permits updates to `IsReviewed`, `ReviewedBy`, and `ReviewedDate`.
- Job Queue data is stored by Hangfire in the `HangFire` schema. It is live runtime data, not static seed content.
