using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayslipsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The Payslips entity was added to the DbContext snapshot inside AddPayrollModule
            // but that migration's Up() method never issued the CREATE TABLE.
            // Production may already have the table from a failed startup attempt, so this
            // must be idempotent to let EF record the migration in __EFMigrationsHistory.
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[dbo].[Payslips]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Payslips] (
                        [Id] uniqueidentifier NOT NULL,
                        [PayslipNumber] nvarchar(32) NOT NULL,
                        [EmployeeId] uniqueidentifier NOT NULL,
                        [EmployeeName] nvarchar(256) NOT NULL,
                        [PeriodStart] date NOT NULL,
                        [PeriodEnd] date NOT NULL,
                        [GrossPay] decimal(18,2) NOT NULL,
                        [TaxDeduction] decimal(18,2) NOT NULL,
                        [SssDeduction] decimal(18,2) NOT NULL,
                        [PhilHealthDeduction] decimal(18,2) NOT NULL,
                        [PagIbigDeduction] decimal(18,2) NOT NULL,
                        [OtherDeductions] decimal(18,2) NOT NULL,
                        [NetPay] decimal(18,2) NOT NULL,
                        [GeneratedBy] nvarchar(256) NOT NULL,
                        [GeneratedAtUtc] datetime2 NOT NULL,
                        CONSTRAINT [PK_Payslips] PRIMARY KEY ([Id])
                    );
                END;

                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_Payslips_PayslipNumber'
                      AND [object_id] = OBJECT_ID(N'[dbo].[Payslips]')
                )
                BEGIN
                    CREATE UNIQUE INDEX [IX_Payslips_PayslipNumber]
                    ON [dbo].[Payslips] ([PayslipNumber]);
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[dbo].[Payslips]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [dbo].[Payslips];
                END;
                """);
        }
    }
}
