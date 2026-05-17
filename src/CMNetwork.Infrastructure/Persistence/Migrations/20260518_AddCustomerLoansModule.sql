-- ============================================================================
-- CMNetwork Loan Module Migration SQL Script
-- For: MonsterAsp.net SQL Server Database (db49851)
-- Date: May 18, 2026
-- Migration: 20260518_AddCustomerLoansModule
--
-- This script creates the complete loan management schema including:
-- - CustomerLoanApplications (customer applies for loan)
-- - CustomerLoans (approved and disbursed loans)
-- - CustomerLoanPayments (individual payment schedule and history)
-- ============================================================================

-- 1. Create CustomerLoanApplications table
CREATE TABLE [dbo].[CustomerLoanApplications] (
    [Id] [uniqueidentifier] NOT NULL,
    [CustomerId] [uniqueidentifier] NOT NULL,
    [RequestedAmount] [decimal](18, 2) NOT NULL,
    [InterestRate] [decimal](5, 2) NOT NULL,
    [TermMonths] [int] NOT NULL,
    [Purpose] [nvarchar](512) NOT NULL,
    [Status] [int] NOT NULL,
    [AccountantReviewNotes] [nvarchar](1024) NULL,
    [CfoNotes] [nvarchar](1024) NULL,
    [SubmittedAtUtc] [datetime2] NOT NULL,
    [ReviewedAtUtc] [datetime2] NULL,
    [ApprovedOrRejectedAtUtc] [datetime2] NULL,
    [ReviewedByUserId] [nvarchar](450) NULL,
    [ApprovedOrRejectedByUserId] [nvarchar](450) NULL,
    [CreatedAtUtc] [datetime2] NOT NULL,
    [UpdatedAtUtc] [datetime2] NULL,
    CONSTRAINT [PK_CustomerLoanApplications] PRIMARY KEY CLUSTERED ([Id] ASC)
);

-- 2. Create CustomerLoans table
CREATE TABLE [dbo].[CustomerLoans] (
    [Id] [uniqueidentifier] NOT NULL,
    [CustomerId] [uniqueidentifier] NOT NULL,
    [LoanApplicationId] [uniqueidentifier] NOT NULL,
    [PrincipalAmount] [decimal](18, 2) NOT NULL,
    [InterestRate] [decimal](5, 2) NOT NULL,
    [TermMonths] [int] NOT NULL,
    [OutstandingPrincipal] [decimal](18, 2) NOT NULL,
    [TotalInterestAccrued] [decimal](18, 2) NOT NULL,
    [Status] [int] NOT NULL,
    [DisbursedAtUtc] [datetime2] NOT NULL,
    [FullyPaidAtUtc] [datetime2] NULL,
    [OverdueSinceUtc] [datetime2] NULL,
    [StatusNotes] [nvarchar](1024) NULL,
    [DisbursedByUserId] [nvarchar](450) NULL,
    [CreatedAtUtc] [datetime2] NOT NULL,
    [UpdatedAtUtc] [datetime2] NULL,
    CONSTRAINT [PK_CustomerLoans] PRIMARY KEY CLUSTERED ([Id] ASC)
);

-- 3. Create CustomerLoanPayments table
CREATE TABLE [dbo].[CustomerLoanPayments] (
    [Id] [uniqueidentifier] NOT NULL,
    [LoanId] [uniqueidentifier] NOT NULL,
    [PrincipalAmount] [decimal](18, 2) NOT NULL,
    [InterestAmount] [decimal](18, 2) NOT NULL,
    [TotalAmount] [decimal](18, 2) NOT NULL,
    [PaymentMethod] [nvarchar](64) NOT NULL,
    [PayMongoCheckoutSessionId] [nvarchar](256) NULL,
    [ExternalReference] [nvarchar](256) NULL,
    [Status] [int] NOT NULL,
    [DueAtUtc] [datetime2] NOT NULL,
    [CompletedAtUtc] [datetime2] NULL,
    [ProcessedByUserId] [nvarchar](450) NULL,
    [CreatedAtUtc] [datetime2] NOT NULL,
    [UpdatedAtUtc] [datetime2] NULL,
    CONSTRAINT [PK_CustomerLoanPayments] PRIMARY KEY CLUSTERED ([Id] ASC)
);

-- 4. Add foreign key constraints
ALTER TABLE [dbo].[CustomerLoanApplications]
ADD CONSTRAINT [FK_CustomerLoanApplications_Customers_CustomerId]
FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers] ([Id]) ON DELETE CASCADE;

ALTER TABLE [dbo].[CustomerLoans]
ADD CONSTRAINT [FK_CustomerLoans_Customers_CustomerId]
FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers] ([Id]) ON DELETE CASCADE;

ALTER TABLE [dbo].[CustomerLoans]
ADD CONSTRAINT [FK_CustomerLoans_CustomerLoanApplications_LoanApplicationId]
FOREIGN KEY ([LoanApplicationId]) REFERENCES [dbo].[CustomerLoanApplications] ([Id]) ON DELETE RESTRICT;

ALTER TABLE [dbo].[CustomerLoanPayments]
ADD CONSTRAINT [FK_CustomerLoanPayments_CustomerLoans_LoanId]
FOREIGN KEY ([LoanId]) REFERENCES [dbo].[CustomerLoans] ([Id]) ON DELETE CASCADE;

-- 5. Create indices for query performance
CREATE NONCLUSTERED INDEX [IX_CustomerLoanApplications_CustomerId]
ON [dbo].[CustomerLoanApplications] ([CustomerId] ASC);

CREATE NONCLUSTERED INDEX [IX_CustomerLoans_CustomerId]
ON [dbo].[CustomerLoans] ([CustomerId] ASC);

CREATE NONCLUSTERED INDEX [IX_CustomerLoans_LoanApplicationId]
ON [dbo].[CustomerLoans] ([LoanApplicationId] ASC);

CREATE NONCLUSTERED INDEX [IX_CustomerLoanPayments_LoanId]
ON [dbo].[CustomerLoanPayments] ([LoanId] ASC);

-- Verification queries:
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'CustomerLoan%';
-- SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_NAME LIKE 'FK_CustomerLoan%';
-- SELECT TABLE_NAME, INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME LIKE 'CustomerLoan%';
