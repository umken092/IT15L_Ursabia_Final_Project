using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkPayslipsToPayrollRun : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF COL_LENGTH(N'[dbo].[Payslips]', N'PayrollRunId') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[Payslips]
                    ADD [PayrollRunId] uniqueidentifier NULL;
                END;

                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_Payslips_PayrollRunId_EmployeeId'
                      AND [object_id] = OBJECT_ID(N'[dbo].[Payslips]')
                )
                BEGIN
                    CREATE UNIQUE INDEX [IX_Payslips_PayrollRunId_EmployeeId]
                    ON [dbo].[Payslips] ([PayrollRunId], [EmployeeId])
                    WHERE [PayrollRunId] IS NOT NULL;
                END;

                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.foreign_keys
                    WHERE [name] = N'FK_Payslips_PayrollRuns_PayrollRunId'
                      AND [parent_object_id] = OBJECT_ID(N'[dbo].[Payslips]')
                )
                BEGIN
                    ALTER TABLE [dbo].[Payslips]
                    ADD CONSTRAINT [FK_Payslips_PayrollRuns_PayrollRunId]
                    FOREIGN KEY ([PayrollRunId]) REFERENCES [dbo].[PayrollRuns] ([Id])
                    ON DELETE SET NULL;
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (
                    SELECT 1
                    FROM sys.foreign_keys
                    WHERE [name] = N'FK_Payslips_PayrollRuns_PayrollRunId'
                      AND [parent_object_id] = OBJECT_ID(N'[dbo].[Payslips]')
                )
                BEGIN
                    ALTER TABLE [dbo].[Payslips]
                    DROP CONSTRAINT [FK_Payslips_PayrollRuns_PayrollRunId];
                END;

                IF EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE [name] = N'IX_Payslips_PayrollRunId_EmployeeId'
                      AND [object_id] = OBJECT_ID(N'[dbo].[Payslips]')
                )
                BEGIN
                    DROP INDEX [IX_Payslips_PayrollRunId_EmployeeId]
                    ON [dbo].[Payslips];
                END;

                IF COL_LENGTH(N'[dbo].[Payslips]', N'PayrollRunId') IS NOT NULL
                BEGIN
                    ALTER TABLE [dbo].[Payslips]
                    DROP COLUMN [PayrollRunId];
                END;
                """);
        }
    }
}
