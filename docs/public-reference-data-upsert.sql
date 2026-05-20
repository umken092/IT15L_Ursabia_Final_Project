/*
  CMNetwork public reference data upsert script

  Sources (public, non-demo reference):
  - BIR TRAIN withholding schedule (RA 10963)
  - SSS contribution schedule (employee share)
  - PhilHealth premium contribution rate advisories
  - Pag-IBIG HDMF contribution rates
  - BSP-supervised major Philippine banks (directory names)

  Notes:
  - Script is idempotent: safe to run repeatedly.
  - Uses current UTC year by default; override @TargetYear if needed.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @TargetYear INT = YEAR(SYSUTCDATETIME());
DECLARE @EffectiveFrom DATE = DATEFROMPARTS(@TargetYear, 1, 1);
DECLARE @EffectiveTo DATE = DATEFROMPARTS(@TargetYear, 12, 31);

/* ------------------------------------------------------------------------- */
/* 1) Bank directory (public institution names)                              */
/* ------------------------------------------------------------------------- */

DECLARE @BankSeed TABLE
(
    Name NVARCHAR(128) NOT NULL,
    Country NVARCHAR(64) NOT NULL,
    BranchName NVARCHAR(128) NULL,
    AccountNumberPattern NVARCHAR(256) NOT NULL,
    AccountNumberSample NVARCHAR(64) NOT NULL
);

INSERT INTO @BankSeed (Name, Country, BranchName, AccountNumberPattern, AccountNumberSample)
VALUES
    (N'BDO Unibank, Inc.', N'Philippines', N'Main Office', N'^\d{10,16}$', N'123456789012'),
    (N'Bank of the Philippine Islands', N'Philippines', N'Main Office', N'^\d{10,16}$', N'123456789012'),
    (N'Metropolitan Bank and Trust Company', N'Philippines', N'Main Office', N'^\d{10,16}$', N'123456789012'),
    (N'Land Bank of the Philippines', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'Philippine National Bank', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'Union Bank of the Philippines', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'Security Bank Corporation', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'China Banking Corporation', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'Rizal Commercial Banking Corporation', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'East West Banking Corporation', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'Philippine Savings Bank', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012'),
    (N'Development Bank of the Philippines', N'Philippines', N'Head Office', N'^\d{10,16}$', N'123456789012');

MERGE dbo.BankDirectoryEntries AS target
USING @BankSeed AS source
ON target.Name = source.Name
WHEN MATCHED THEN
    UPDATE SET
        target.Country = source.Country,
        target.BranchName = source.BranchName,
        target.AccountNumberPattern = source.AccountNumberPattern,
        target.AccountNumberSample = source.AccountNumberSample,
        target.IsActive = 1,
        target.RemovedAtUtc = NULL,
        target.RemovedBy = NULL,
        target.ListedAtUtc = SYSUTCDATETIME(),
        target.ListedBy = N'public-data-sync'
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        Id,
        Name,
        Country,
        BranchName,
        AccountNumberPattern,
        AccountNumberSample,
        IsActive,
        ListedAtUtc,
        ListedBy,
        RemovedAtUtc,
        RemovedBy
    )
    VALUES
    (
        NEWID(),
        source.Name,
        source.Country,
        source.BranchName,
        source.AccountNumberPattern,
        source.AccountNumberSample,
        1,
        SYSUTCDATETIME(),
        N'public-data-sync',
        NULL,
        NULL
    );

/* ------------------------------------------------------------------------- */
/* 2) Statutory tax / contribution table rows                                */
/* ------------------------------------------------------------------------- */

DECLARE @TaxSeed TABLE
(
    [Type] INT NOT NULL,
    [Year] INT NOT NULL,
    MinIncome DECIMAL(18,2) NOT NULL,
    MaxIncome DECIMAL(18,2) NULL,
    Rate DECIMAL(9,6) NOT NULL,
    [Description] NVARCHAR(256) NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL
);

/* TRAIN monthly brackets currently used by CMNetwork payroll engine */
INSERT INTO @TaxSeed ([Type], [Year], MinIncome, MaxIncome, Rate, [Description], EffectiveFrom, EffectiveTo)
VALUES
    (1, @TargetYear, 0.00, 20833.00, 0.000000, N'TRAIN monthly: up to 20,833 (tax exempt)', @EffectiveFrom, @EffectiveTo),
    (1, @TargetYear, 20833.01, 33333.00, 0.150000, N'TRAIN monthly: 20,833.01 to 33,333 (15%)', @EffectiveFrom, @EffectiveTo),
    (1, @TargetYear, 33333.01, 66667.00, 0.200000, N'TRAIN monthly: 33,333.01 to 66,667 (20%)', @EffectiveFrom, @EffectiveTo),
    (1, @TargetYear, 66667.01, 166667.00, 0.250000, N'TRAIN monthly: 66,667.01 to 166,667 (25%)', @EffectiveFrom, @EffectiveTo),
    (1, @TargetYear, 166667.01, NULL, 0.350000, N'TRAIN monthly: over 166,667 (35%)', @EffectiveFrom, @EffectiveTo);

/* SSS employee share (rate-based approximation in current CMNetwork model) */
INSERT INTO @TaxSeed ([Type], [Year], MinIncome, MaxIncome, Rate, [Description], EffectiveFrom, EffectiveTo)
VALUES
    (2, @TargetYear, 0.00, NULL, 0.050000, N'SSS employee share rate', @EffectiveFrom, @EffectiveTo);

/* PhilHealth employee share (half of total premium contribution) */
INSERT INTO @TaxSeed ([Type], [Year], MinIncome, MaxIncome, Rate, [Description], EffectiveFrom, EffectiveTo)
VALUES
    (3, @TargetYear, 0.00, NULL, 0.025000, N'PhilHealth employee share rate', @EffectiveFrom, @EffectiveTo);

/* Pag-IBIG employee share used by payroll engine */
INSERT INTO @TaxSeed ([Type], [Year], MinIncome, MaxIncome, Rate, [Description], EffectiveFrom, EffectiveTo)
VALUES
    (4, @TargetYear, 0.00, NULL, 0.020000, N'Pag-IBIG employee share rate', @EffectiveFrom, @EffectiveTo);

MERGE dbo.TaxTables AS target
USING @TaxSeed AS source
ON target.[Type] = source.[Type]
AND target.[Year] = source.[Year]
AND target.MinIncome = source.MinIncome
AND ISNULL(target.MaxIncome, -1) = ISNULL(source.MaxIncome, -1)
AND target.IsDeleted = 0
WHEN MATCHED THEN
    UPDATE SET
        target.Rate = source.Rate,
        target.[Description] = source.[Description],
        target.EffectiveFrom = source.EffectiveFrom,
        target.EffectiveTo = source.EffectiveTo,
        target.CreatedUtc = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET THEN
    INSERT
    (
        Id,
        [Type],
        [Year],
        MinIncome,
        MaxIncome,
        Rate,
        [Description],
        EffectiveFrom,
        EffectiveTo,
        CreatedUtc,
        IsDeleted
    )
    VALUES
    (
        NEWID(),
        source.[Type],
        source.[Year],
        source.MinIncome,
        source.MaxIncome,
        source.Rate,
        source.[Description],
        source.EffectiveFrom,
        source.EffectiveTo,
        SYSUTCDATETIME(),
        0
    );

/* Soft-delete superseded rows for the same year/types that are not in seed */
UPDATE target
SET target.IsDeleted = 1
FROM dbo.TaxTables AS target
WHERE target.[Year] = @TargetYear
  AND target.[Type] IN (1, 2, 3, 4)
  AND target.IsDeleted = 0
  AND NOT EXISTS
  (
      SELECT 1
      FROM @TaxSeed AS source
      WHERE source.[Type] = target.[Type]
        AND source.[Year] = target.[Year]
        AND source.MinIncome = target.MinIncome
        AND ISNULL(source.MaxIncome, -1) = ISNULL(target.MaxIncome, -1)
  );

COMMIT TRANSACTION;

/* ------------------------------------------------------------------------- */
/* Verification result sets                                                   */
/* ------------------------------------------------------------------------- */

SELECT
    b.Name,
    b.Country,
    b.BranchName,
    b.IsActive,
    b.ListedBy,
    b.ListedAtUtc
FROM dbo.BankDirectoryEntries AS b
WHERE b.ListedBy = N'public-data-sync'
ORDER BY b.Name;

SELECT
    t.[Type],
    t.[Year],
    t.MinIncome,
    t.MaxIncome,
    t.Rate,
    t.[Description],
    t.IsDeleted
FROM dbo.TaxTables AS t
WHERE t.[Year] = @TargetYear
  AND t.[Type] IN (1, 2, 3, 4)
ORDER BY t.[Type], t.MinIncome;
