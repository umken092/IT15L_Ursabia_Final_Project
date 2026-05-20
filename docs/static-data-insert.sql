-- =============================================================================
-- CMNetwork – Static / Public Reference Data Insert Script
-- Purpose : Populate the database with realistic, non-demo, public-domain
--           reference data sufficient to exercise all major modules:
--           Chart of Accounts, Fiscal Periods, Vendors, Customers,
--           AP Invoices, AR Invoices, Journal Entries + Lines.
--
-- Idempotent: Uses MERGE statements so the script can be run multiple times.
-- All monetary amounts are in PHP (Philippine Peso).
-- EntryDate values are set to the CURRENT calendar month so MTD calculations
-- in DashboardService and ReportsController return non-zero figures.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- ---------------------------------------------------------------------------
-- 0. Helper variables
-- ---------------------------------------------------------------------------
DECLARE @Now         DATETIME2  = SYSUTCDATETIME();
DECLARE @MonthStart  DATE       = DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1);
DECLARE @MonthEnd    DATE       = EOMONTH(GETUTCDATE());
DECLARE @MidMonth    DATE       = DATEADD(DAY, 14, @MonthStart);
DECLARE @FY          INT        = YEAR(GETUTCDATE());
DECLARE @FYStart     DATE       = DATEFROMPARTS(@FY, 1, 1);
DECLARE @FYEnd       DATE       = DATEFROMPARTS(@FY, 12, 31);
DECLARE @SystemUser  NVARCHAR(100) = 'system-seed';

-- ===========================================================================
-- 1. CHART OF ACCOUNTS
--    AccountType integers:  Asset=1  Liability=2  Equity=3  Revenue=4  Expense=5
--    AccountCode convention: 1xxx Asset, 2xxx Liability, 3xxx Equity,
--                            4xxx Revenue, 5xxx Expense
-- ===========================================================================
MERGE dbo.ChartOfAccounts AS target
USING (VALUES
  -- Assets
  ('A1000-0001', '1010', 'Cash on Hand',               1, NULL, 1),
  ('A1000-0002', '1020', 'Cash in Bank – BDO',          1, NULL, 1),
  ('A1000-0003', '1030', 'Accounts Receivable',         1, NULL, 1),
  ('A1000-0004', '1040', 'Prepaid Expenses',            1, NULL, 1),
  ('A1000-0005', '1050', 'Office Equipment',            1, NULL, 1),
  -- Liabilities
  ('A2000-0001', '2010', 'Accounts Payable',            2, NULL, 1),
  ('A2000-0002', '2020', 'Accrued Liabilities',         2, NULL, 1),
  ('A2000-0003', '2030', 'VAT Payable',                 2, NULL, 1),
  -- Equity
  ('A3000-0001', '3010', 'Common Stock',                3, NULL, 1),
  ('A3000-0002', '3020', 'Retained Earnings',           3, NULL, 1),
  -- Revenue
  ('A4000-0001', '4010', 'Service Revenue',             4, NULL, 1),
  ('A4000-0002', '4020', 'Interest Income',             4, NULL, 1),
  ('A4000-0003', '4030', 'Consulting Revenue',          4, NULL, 1),
  -- Expenses
  ('A5000-0001', '5010', 'Salaries and Wages',          5, NULL, 1),
  ('A5000-0002', '5020', 'Rent Expense',                5, NULL, 1),
  ('A5000-0003', '5030', 'Utilities Expense',           5, NULL, 1),
  ('A5000-0004', '5040', 'Office Supplies Expense',     5, NULL, 1),
  ('A5000-0005', '5050', 'Professional Fees',           5, NULL, 1),
  ('A5000-0006', '5060', 'Depreciation Expense',        5, NULL, 1),
  ('A5000-0007', '5070', 'Communication Expense',       5, NULL, 1)
) AS src (IdStr, AccountCode, Name, Type, ParentAccountId, IsActive)
ON target.AccountCode = src.AccountCode
WHEN NOT MATCHED THEN INSERT (Id, AccountCode, Name, Type, ParentAccountId, IsActive, CreatedUtc)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER), src.AccountCode, src.Name, src.Type, src.ParentAccountId, src.IsActive, @Now)
WHEN MATCHED THEN UPDATE SET Name = src.Name, Type = src.Type, IsActive = src.IsActive;

-- ===========================================================================
-- 2. FISCAL PERIODS
--    One full-year period for the current FY
-- ===========================================================================
MERGE dbo.FiscalPeriods AS target
USING (VALUES
  ('FP0001-0000-0000-0000-000000000001',
   CONCAT('FY ', @FY), @FYStart, @FYEnd, 0)
) AS src (IdStr, Name, StartDate, EndDate, IsClosed)
ON target.Name = src.Name
WHEN NOT MATCHED THEN INSERT (Id, Name, StartDate, EndDate, IsClosed, CreatedUtc)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER), src.Name, src.StartDate, src.EndDate, src.IsClosed, @Now)
WHEN MATCHED THEN UPDATE SET StartDate = src.StartDate, EndDate = src.EndDate, IsClosed = src.IsClosed;

-- ===========================================================================
-- 3. VENDORS  (Philippine companies – public domain)
-- ===========================================================================
MERGE dbo.Vendors AS target
USING (VALUES
  ('V0001-0000-0000-0000-000000000001', 'VND-001', 'Meralco (Manila Electric Company)',
   'Billing Desk', 'billing@meralco.com.ph', '+63 2 1637 1637',
   'Lopez Building, Ortigas Ave', 'Pasig City', 'Metro Manila', '1600', 'PH',
   '003-539-167-000', 'Net 30', 500000.00),
  ('V0002-0000-0000-0000-000000000002', 'VND-002', 'PLDT Inc.',
   'Corporate Accounts', 'corp@pldt.com.ph', '+63 2 8888 3088',
   'Ramon Cojuangco Building, Makati Ave', 'Makati City', 'Metro Manila', '1200', 'PH',
   '003-488-999-000', 'Net 30', 300000.00),
  ('V0003-0000-0000-0000-000000000003', 'VND-003', 'Globe Telecom Inc.',
   'Enterprise Sales', 'enterprise@globe.com.ph', '+63 2 7730 1000',
   'The Globe Tower, 32nd Street', 'Taguig City', 'Metro Manila', '1634', 'PH',
   '004-741-321-000', 'Net 30', 200000.00),
  ('V0004-0000-0000-0000-000000000004', 'VND-004', 'SM Prime Holdings Inc.',
   'Property Leasing', 'leasing@smprime.com.ph', '+63 2 8831 1000',
   'Mall of Asia Complex, J.W. Diokno Blvd', 'Pasay City', 'Metro Manila', '1300', 'PH',
   '005-012-456-000', 'Net 30', 1000000.00),
  ('V0005-0000-0000-0000-000000000005', 'VND-005', 'National Bookstore Inc.',
   'Supply Procurement', 'procurement@nationalbookstore.com.ph', '+63 2 8523 1781',
   '54 Quezon Avenue', 'Quezon City', 'Metro Manila', '1105', 'PH',
   '006-789-012-000', 'Net 15', 50000.00)
) AS src (IdStr, VendorCode, Name, ContactPerson, Email, PhoneNumber, Address, City, State, PostalCode, Country, TaxId, PaymentTerms, CreditLimit)
ON target.VendorCode = src.VendorCode
WHEN NOT MATCHED THEN INSERT
  (Id, VendorCode, Name, ContactPerson, Email, PhoneNumber, Address, City, State, PostalCode, Country, TaxId, PaymentTerms, CreditLimit, IsActive, CreatedUtc)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER), src.VendorCode, src.Name, src.ContactPerson, src.Email, src.PhoneNumber,
          src.Address, src.City, src.State, src.PostalCode, src.Country, src.TaxId, src.PaymentTerms, src.CreditLimit, 1, @Now)
WHEN MATCHED THEN UPDATE SET Name = src.Name, Email = src.Email, IsActive = 1;

-- ===========================================================================
-- 4. CUSTOMERS  (Philippine entities – public domain)
-- ===========================================================================
MERGE dbo.Customers AS target
USING (VALUES
  ('C0001-0000-0000-0000-000000000001', 'CUS-001', 'Jollibee Foods Corporation',
   'AR Desk', 'ar@jollibee.com.ph', '+63 2 8783 1234',
   '10 Jollibee Plaza, Ortigas Center', 'Pasig City', 'Metro Manila', '1605', 'PH',
   '007-654-321-000', 'Net 30', 2000000.00),
  ('C0002-0000-0000-0000-000000000002', 'CUS-002', 'Ayala Corporation',
   'Finance Office', 'finance@ayala.com.ph', '+63 2 8848 5000',
   '34th Floor, Tower One & Exchange Plaza, Ayala Triangle', 'Makati City', 'Metro Manila', '1226', 'PH',
   '008-111-222-000', 'Net 45', 5000000.00),
  ('C0003-0000-0000-0000-000000000003', 'CUS-003', 'SM Investments Corporation',
   'Accounts Payable', 'ap@sminvestments.com.ph', '+63 2 8857 0100',
   '10 Mall of Asia Arena Annex', 'Pasay City', 'Metro Manila', '1300', 'PH',
   '009-333-444-000', 'Net 30', 3000000.00),
  ('C0004-0000-0000-0000-000000000004', 'CUS-004', 'DMCI Holdings Inc.',
   'Finance Team', 'finance@dmci.com.ph', '+63 2 8888 3000',
   '3/F Dacon Building, 2281 Pasong Tamo Extension', 'Makati City', 'Metro Manila', '1231', 'PH',
   '010-555-666-000', 'Net 30', 1500000.00),
  ('C0005-0000-0000-0000-000000000005', 'CUS-005', 'Robinsons Land Corporation',
   'Treasury', 'treasury@robinsonsland.com.ph', '+63 2 8397 1234',
   '43/F Robinsons Equitable Tower, ADB Avenue', 'Pasig City', 'Metro Manila', '1605', 'PH',
   '011-777-888-000', 'Net 30', 2500000.00)
) AS src (IdStr, CustomerCode, Name, ContactPerson, Email, PhoneNumber, Address, City, State, PostalCode, Country, TaxId, PaymentTerms, CreditLimit)
ON target.CustomerCode = src.CustomerCode
WHEN NOT MATCHED THEN INSERT
  (Id, CustomerCode, Name, ContactPerson, Email, PhoneNumber, Address, City, State, PostalCode, Country, TaxId, PaymentTerms, CreditLimit, IsActive, CreatedUtc, RegistrationOtpVerified)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER), src.CustomerCode, src.Name, src.ContactPerson, src.Email, src.PhoneNumber,
          src.Address, src.City, src.State, src.PostalCode, src.Country, src.TaxId, src.PaymentTerms, src.CreditLimit, 1, @Now, 0)
WHEN MATCHED THEN UPDATE SET Name = src.Name, Email = src.Email, IsActive = 1;

-- ===========================================================================
-- 5. AR INVOICES  (current month – Status=Paid=4, triggers MTD fallback path)
--    Also covers Sent=2 and Approved=3 to exercise aging buckets
-- ===========================================================================
MERGE dbo.ARInvoices AS target
USING (VALUES
  ('AR001-0000-0000-0000-000000000001', 'CUS-001',
   'AR-2026-001', @MonthStart, @MonthEnd, 350000.00, 4),    -- Paid
  ('AR002-0000-0000-0000-000000000002', 'CUS-002',
   'AR-2026-002', @MonthStart, @MonthEnd, 520000.00, 3),    -- Approved
  ('AR003-0000-0000-0000-000000000003', 'CUS-003',
   'AR-2026-003', @MidMonth,  @MonthEnd, 180000.00, 2),    -- Sent
  ('AR004-0000-0000-0000-000000000004', 'CUS-004',
   'AR-2026-004', @MidMonth,  @MonthEnd, 275000.00, 4),    -- Paid
  ('AR005-0000-0000-0000-000000000005', 'CUS-005',
   'AR-2026-005', @MidMonth,  @MonthEnd, 410000.00, 3)     -- Approved
) AS src (IdStr, CustomerCode, InvoiceNumber, InvoiceDate, DueDate, TotalAmount, Status)
ON target.InvoiceNumber = src.InvoiceNumber
WHEN NOT MATCHED THEN INSERT
  (Id, CustomerId, InvoiceNumber, InvoiceDate, DueDate, TotalAmount, Status, CreatedByUserId, CreatedUtc, IsDeleted)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER),
          (SELECT TOP (1) c.Id FROM dbo.Customers c WHERE c.CustomerCode = src.CustomerCode),
          src.InvoiceNumber,
          CAST(src.InvoiceDate AS DATETIME2),
          CAST(src.DueDate AS DATETIME2),
          src.TotalAmount, src.Status, @SystemUser, @Now, 0)
WHEN MATCHED THEN UPDATE SET TotalAmount = src.TotalAmount, Status = src.Status, IsDeleted = 0;

-- AR Invoice Lines
MERGE dbo.ARInvoiceLines AS target
USING (
  SELECT
    s.IdStr,
    inv.Id AS ARInvoiceId,
    coa.Id AS ChartOfAccountId,
    s.Description,
    s.Quantity,
    s.UnitPrice,
    s.Amount,
    s.TaxAmount
  FROM (VALUES
  -- AR-001 lines
  ('AL001-0000-0000-0000-000000000001', 'AR-2026-001', '4010', 'IT Consulting Services – Apr batch',   5.0,  50000.00, 250000.00, NULL),
  ('AL001-0000-0000-0000-000000000002', 'AR-2026-001', '4030', 'Process Improvement Workshop',          2.0,  50000.00, 100000.00, NULL),
  -- AR-002 lines
  ('AL002-0000-0000-0000-000000000001', 'AR-2026-002', '4010', 'System Integration Support',           10.0,  40000.00, 400000.00, NULL),
  ('AL002-0000-0000-0000-000000000002', 'AR-2026-002', '4020', 'Escrow Interest Income',                1.0,  120000.00, 120000.00, NULL),
  -- AR-003 lines
  ('AL003-0000-0000-0000-000000000001', 'AR-2026-003', '4030', 'ERP Configuration Services',           3.0,  60000.00, 180000.00, NULL),
  -- AR-004 lines
  ('AL004-0000-0000-0000-000000000001', 'AR-2026-004', '4010', 'Managed IT Services – monthly retainer', 1.0, 275000.00, 275000.00, NULL),
  -- AR-005 lines
  ('AL005-0000-0000-0000-000000000001', 'AR-2026-005', '4030', 'Business Process Outsourcing',          4.0,  80000.00, 320000.00, NULL),
  ('AL005-0000-0000-0000-000000000002', 'AR-2026-005', '4020', 'Investment Advisory Fee',               1.0,  90000.00,  90000.00, NULL)
  ) AS s (IdStr, InvoiceNumber, AccountCode, Description, Quantity, UnitPrice, Amount, TaxAmount)
  JOIN dbo.ARInvoices inv ON inv.InvoiceNumber = s.InvoiceNumber
  JOIN dbo.ChartOfAccounts coa ON coa.AccountCode = s.AccountCode
) AS src
ON target.Id = CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER)
WHEN NOT MATCHED THEN INSERT
  (Id, ARInvoiceId, ChartOfAccountId, Description, Quantity, UnitPrice, Amount, TaxAmount, CreatedUtc)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER),
          src.ARInvoiceId,
          src.ChartOfAccountId,
          src.Description, src.Quantity, src.UnitPrice, src.Amount, src.TaxAmount, @Now)
WHEN MATCHED THEN UPDATE SET Amount = src.Amount;

-- ===========================================================================
-- 6. AP INVOICES  (current month – Status=Approved=3 to show pending payables)
-- ===========================================================================
MERGE dbo.APInvoices AS target
USING (VALUES
  ('AP001-0000-0000-0000-000000000001', 'VND-001',
   'AP-MEQ-2026-001', @MonthStart, @MonthEnd,  85000.00, 3),   -- Electricity
  ('AP002-0000-0000-0000-000000000002', 'VND-002',
   'AP-PLT-2026-001', @MonthStart, @MonthEnd,  12000.00, 3),   -- Internet/fiber
  ('AP003-0000-0000-0000-000000000003', 'VND-003',
   'AP-GLB-2026-001', @MonthStart, @MonthEnd,   8500.00, 3),   -- Mobile lines
  ('AP004-0000-0000-0000-000000000004', 'VND-004',
   'AP-SMP-2026-001', @MonthStart, @MonthEnd, 150000.00, 3),   -- Office rent
  ('AP005-0000-0000-0000-000000000005', 'VND-005',
   'AP-NBS-2026-001', @MonthStart, @MonthEnd,   6500.00, 2)    -- Supplies (Submitted)
) AS src (IdStr, VendorCode, InvoiceNumber, InvoiceDate, DueDate, TotalAmount, Status)
ON target.InvoiceNumber = src.InvoiceNumber
WHEN NOT MATCHED THEN INSERT
  (Id, VendorId, InvoiceNumber, InvoiceDate, DueDate, TotalAmount, Status, CreatedByUserId, CreatedUtc, IsDeleted)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER),
          (SELECT TOP (1) v.Id FROM dbo.Vendors v WHERE v.VendorCode = src.VendorCode),
          src.InvoiceNumber,
          CAST(src.InvoiceDate AS DATETIME2),
          CAST(src.DueDate AS DATETIME2),
          src.TotalAmount, src.Status, @SystemUser, @Now, 0)
WHEN MATCHED THEN UPDATE SET TotalAmount = src.TotalAmount, Status = src.Status, IsDeleted = 0;

-- AP Invoice Lines
MERGE dbo.APInvoiceLines AS target
USING (
  SELECT
    s.IdStr,
    inv.Id AS APInvoiceId,
    coa.Id AS ChartOfAccountId,
    s.Description,
    s.Quantity,
    s.UnitPrice,
    s.Amount,
    s.TaxAmount
  FROM (VALUES
  ('BL001-0000-0000-0000-000000000001', 'AP-MEQ-2026-001', '5030', 'Electricity – Office Building',       1.0, 85000.00,  85000.00, NULL),
  ('BL002-0000-0000-0000-000000000001', 'AP-PLT-2026-001', '5070', 'Fiber Broadband – Corporate',         1.0, 12000.00,  12000.00, NULL),
  ('BL003-0000-0000-0000-000000000001', 'AP-GLB-2026-001', '5070', 'Mobile Corporate Lines x 5',          1.0,  8500.00,   8500.00, NULL),
  ('BL004-0000-0000-0000-000000000001', 'AP-SMP-2026-001', '5020', 'Office Rent – May',                   1.0, 150000.00, 150000.00, NULL),
  ('BL005-0000-0000-0000-000000000001', 'AP-NBS-2026-001', '5040', 'Office Supplies – Replenishment',     1.0,  6500.00,   6500.00, NULL)
  ) AS s (IdStr, InvoiceNumber, AccountCode, Description, Quantity, UnitPrice, Amount, TaxAmount)
  JOIN dbo.APInvoices inv ON inv.InvoiceNumber = s.InvoiceNumber
  JOIN dbo.ChartOfAccounts coa ON coa.AccountCode = s.AccountCode
) AS src
ON target.Id = CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER)
WHEN NOT MATCHED THEN INSERT
  (Id, APInvoiceId, ChartOfAccountId, Description, Quantity, UnitPrice, Amount, TaxAmount, CreatedUtc)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER),
          src.APInvoiceId,
          src.ChartOfAccountId,
          src.Description, src.Quantity, src.UnitPrice, src.Amount, src.TaxAmount, @Now)
WHEN MATCHED THEN UPDATE SET Amount = src.Amount;

-- ===========================================================================
-- 7. JOURNAL ENTRIES  (Status = Posted = 2, EntryDate in current month)
--    These drive the PRIMARY path in DashboardService.GetMetricsAsync()
--    and ReportsController.GetIncomeStatement().
--
--    Double-entry rules enforced: each entry has equal total Debits = Credits.
--    JE-001: Record service revenue collected (AR receipt)
--    JE-002: Record consulting revenue
--    JE-003: Record monthly salary expense
--    JE-004: Record rent expense
--    JE-005: Record utilities expense
-- ===========================================================================
MERGE dbo.JournalEntries AS target
USING (VALUES
  ('JE001-0000-0000-0000-000000000001', 'JE-2026-001', @MonthStart,
   'Service Revenue – May collection from Jollibee', 'AR-2026-001', 2),
  ('JE002-0000-0000-0000-000000000002', 'JE-2026-002', @MonthStart,
   'Consulting Revenue – Ayala engagement', 'AR-2026-002', 2),
  ('JE003-0000-0000-0000-000000000003', 'JE-2026-003', @MonthStart,
   'Payroll – May salaries and wages', NULL, 2),
  ('JE004-0000-0000-0000-000000000004', 'JE-2026-004', @MonthStart,
   'Office rent – SM Prime Holdings', 'AP-SMP-2026-001', 2),
  ('JE005-0000-0000-0000-000000000005', 'JE-2026-005', @MidMonth,
   'Utilities – Meralco electricity', 'AP-MEQ-2026-001', 2),
  ('JE006-0000-0000-0000-000000000006', 'JE-2026-006', @MidMonth,
   'Additional managed IT revenue – DMCI retainer', 'AR-2026-004', 2),
  ('JE007-0000-0000-0000-000000000007', 'JE-2026-007', @MidMonth,
   'Communication expenses – PLDT & Globe', NULL, 2)
) AS src (IdStr, EntryNumber, EntryDate, Description, ReferenceNo, Status)
ON target.EntryNumber = src.EntryNumber
WHEN NOT MATCHED THEN INSERT
  (Id, EntryNumber, EntryDate, Description, ReferenceNo, Status, CreatedBy, CreatedUtc, PostedBy, PostedUtc)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER), src.EntryNumber, src.EntryDate,
          src.Description, src.ReferenceNo, src.Status,
          @SystemUser, @Now, @SystemUser, @Now)
WHEN MATCHED THEN UPDATE SET Status = src.Status, Description = src.Description;

-- ===========================================================================
-- 8. JOURNAL ENTRY LINES
--    Credit to Revenue accounts  → increases revenue
--    Debit  to Expense accounts  → increases expense
--    Balancing entries use Asset / Liability accounts
--
--    Amounts summary (for MTD verification):
--      Revenue accounts credited:
--        4010 Service Revenue   : 350,000 + 275,000 = 625,000
--        4030 Consulting Revenue: 520,000
--      Total MTD Revenue = 1,145,000
--
--      Expense accounts debited:
--        5010 Salaries          : 380,000
--        5020 Rent              : 150,000
--        5030 Utilities         :  85,000
--        5070 Communication     :  20,500
--      Total MTD Expenses = 635,500
--      Net Income MTD = 509,500
-- ===========================================================================
MERGE dbo.JournalEntryLines AS target
USING (
  SELECT
    s.IdStr,
    je.Id AS JournalEntryId,
    coa.Id AS AccountId,
    s.Description,
    s.Debit,
    s.Credit
  FROM (VALUES
  -- JE-001: Service Revenue – 350,000 (Debit A/R, Credit Service Revenue)
  ('JL001-0001-0000-0000-000000000001', 'JE-2026-001', '1030', 'A/R – Jollibee invoice AR-2026-001',      350000.00,      0.00),
  ('JL001-0002-0000-0000-000000000002', 'JE-2026-001', '4010', 'Service Revenue – May collection',              0.00, 350000.00),

  -- JE-002: Consulting Revenue – 520,000
  ('JL002-0001-0000-0000-000000000003', 'JE-2026-002', '1030', 'A/R – Ayala invoice AR-2026-002',         520000.00,      0.00),
  ('JL002-0002-0000-0000-000000000004', 'JE-2026-002', '4030', 'Consulting Revenue – Ayala engagement',        0.00, 520000.00),

  -- JE-003: Payroll – 380,000 (Debit Salaries, Credit Cash in Bank)
  ('JL003-0001-0000-0000-000000000005', 'JE-2026-003', '5010', 'Salaries and Wages – May payroll',        380000.00,      0.00),
  ('JL003-0002-0000-0000-000000000006', 'JE-2026-003', '1020', 'Cash disbursement – BDO payroll',              0.00, 380000.00),

  -- JE-004: Rent – 150,000
  ('JL004-0001-0000-0000-000000000007', 'JE-2026-004', '5020', 'Rent Expense – May',                     150000.00,      0.00),
  ('JL004-0002-0000-0000-000000000008', 'JE-2026-004', '2010', 'A/P – SM Prime invoice',                       0.00, 150000.00),

  -- JE-005: Utilities – 85,000
  ('JL005-0001-0000-0000-000000000009', 'JE-2026-005', '5030', 'Utilities Expense – Meralco May bill',     85000.00,      0.00),
  ('JL005-0002-0000-0000-000000000010', 'JE-2026-005', '2010', 'A/P – Meralco invoice',                        0.00,  85000.00),

  -- JE-006: DMCI managed IT revenue – 275,000
  ('JL006-0001-0000-0000-000000000011', 'JE-2026-006', '1030', 'A/R – DMCI invoice AR-2026-004',          275000.00,      0.00),
  ('JL006-0002-0000-0000-000000000012', 'JE-2026-006', '4010', 'Service Revenue – DMCI retainer',              0.00, 275000.00),

  -- JE-007: Communication – 20,500 (PLDT 12,000 + Globe 8,500)
  ('JL007-0001-0000-0000-000000000013', 'JE-2026-007', '5070', 'Communication – PLDT fiber broadband',     12000.00,      0.00),
  ('JL007-0002-0000-0000-000000000014', 'JE-2026-007', '5070', 'Communication – Globe mobile lines',        8500.00,      0.00),
  ('JL007-0003-0000-0000-000000000015', 'JE-2026-007', '2010', 'A/P – PLDT & Globe invoices',                  0.00,  20500.00)
  ) AS s (IdStr, EntryNumber, AccountCode, Description, Debit, Credit)
  JOIN dbo.JournalEntries je ON je.EntryNumber = s.EntryNumber
  JOIN dbo.ChartOfAccounts coa ON coa.AccountCode = s.AccountCode
) AS src
ON target.Id = CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER)
WHEN NOT MATCHED THEN INSERT
  (Id, JournalEntryId, AccountId, Description, Debit, Credit)
  VALUES (CAST(HASHBYTES('MD5', src.IdStr) AS UNIQUEIDENTIFIER),
          src.JournalEntryId,
          src.AccountId,
          src.Description, src.Debit, src.Credit)
WHEN MATCHED THEN UPDATE SET Debit = src.Debit, Credit = src.Credit;

-- ===========================================================================
-- 9. VERIFICATION SUMMARY  (run after the script to confirm MTD values)
-- ===========================================================================
SELECT
  'MTD Revenue (journals)'   AS Metric,
  SUM(jl.Credit - jl.Debit) AS Amount
FROM dbo.JournalEntryLines   jl
JOIN dbo.JournalEntries      je ON je.Id = jl.JournalEntryId
JOIN dbo.ChartOfAccounts     ca ON ca.Id = jl.AccountId
WHERE je.Status = 2               -- Posted
  AND je.EntryDate >= CAST(@MonthStart AS DATE)
  AND ca.Type = 4                  -- Revenue

UNION ALL

SELECT
  'MTD Expenses (journals)',
  SUM(jl.Debit - jl.Credit)
FROM dbo.JournalEntryLines   jl
JOIN dbo.JournalEntries      je ON je.Id = jl.JournalEntryId
JOIN dbo.ChartOfAccounts     ca ON ca.Id = jl.AccountId
WHERE je.Status = 2
  AND je.EntryDate >= CAST(@MonthStart AS DATE)
  AND ca.Type = 5                  -- Expense

UNION ALL

SELECT
  'MTD AR Revenue (fallback)',
  SUM(TotalAmount)
FROM dbo.ARInvoices
WHERE IsDeleted = 0
  AND Status IN (2, 3, 4)          -- Sent, Approved, Paid
  AND InvoiceDate >= CAST(@MonthStart AS DATETIME2);

COMMIT TRANSACTION;

PRINT '✓ Static reference data inserted successfully.';
PRINT '  Expected MTD Revenue  (GL journals) : 1,145,000 PHP';
PRINT '  Expected MTD Expenses (GL journals) :   635,500 PHP';
PRINT '  Expected Net Income MTD             :   509,500 PHP';
PRINT '  AR Invoice fallback revenue         : 1,735,000 PHP';
