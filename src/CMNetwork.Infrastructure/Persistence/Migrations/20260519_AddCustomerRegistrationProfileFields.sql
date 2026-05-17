IF COL_LENGTH('Customers', 'FirstName') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [FirstName] nvarchar(64) NULL;
END;

IF COL_LENGTH('Customers', 'MiddleName') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [MiddleName] nvarchar(64) NULL;
END;

IF COL_LENGTH('Customers', 'LastName') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [LastName] nvarchar(64) NULL;
END;

IF COL_LENGTH('Customers', 'BirthDate') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [BirthDate] date NULL;
END;

IF COL_LENGTH('Customers', 'Age') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [Age] int NULL;
END;

IF COL_LENGTH('Customers', 'Gender') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [Gender] nvarchar(16) NULL;
END;

IF COL_LENGTH('Customers', 'MaritalStatus') IS NULL
BEGIN
    ALTER TABLE [Customers] ADD [MaritalStatus] nvarchar(32) NULL;
END;
