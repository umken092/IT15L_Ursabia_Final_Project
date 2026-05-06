using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDemoData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Delete demo user roles first (foreign key constraint)
            migrationBuilder.Sql(
                @"DELETE FROM [AspNetUserRoles] 
                  WHERE [UserId] IN (
                    '20000000-0000-0000-0000-000000000001',
                    '20000000-0000-0000-0000-000000000002',
                    '20000000-0000-0000-0000-000000000003',
                    '20000000-0000-0000-0000-000000000004',
                    '20000000-0000-0000-0000-000000000005',
                    '20000000-0000-0000-0000-000000000006',
                    '20000000-0000-0000-0000-000000000007'
                  )");

            // Delete demo refresh tokens (foreign key constraint)
            migrationBuilder.Sql(
                @"DELETE FROM [RefreshTokens] 
                  WHERE [UserId] IN (
                    '20000000-0000-0000-0000-000000000001',
                    '20000000-0000-0000-0000-000000000002',
                    '20000000-0000-0000-0000-000000000003',
                    '20000000-0000-0000-0000-000000000004',
                    '20000000-0000-0000-0000-000000000005',
                    '20000000-0000-0000-0000-000000000006',
                    '20000000-0000-0000-0000-000000000007'
                  )");

            // Delete demo AspNetUsers
            migrationBuilder.Sql(
                @"DELETE FROM [AspNetUsers] 
                  WHERE [Id] IN (
                    '20000000-0000-0000-0000-000000000001',
                    '20000000-0000-0000-0000-000000000002',
                    '20000000-0000-0000-0000-000000000003',
                    '20000000-0000-0000-0000-000000000004',
                    '20000000-0000-0000-0000-000000000005',
                    '20000000-0000-0000-0000-000000000006',
                    '20000000-0000-0000-0000-000000000007'
                  )");

            // Delete demo budget reallocation requests (foreign key constraint to departments)
            migrationBuilder.Sql(
                @"DELETE FROM [BudgetReallocationRequests] 
                  WHERE [SourceDepartmentId] IN (
                    '10000000-0000-0000-0000-000000000001',
                    '10000000-0000-0000-0000-000000000002',
                    '10000000-0000-0000-0000-000000000003'
                  ) 
                  OR [TargetDepartmentId] IN (
                    '10000000-0000-0000-0000-000000000001',
                    '10000000-0000-0000-0000-000000000002',
                    '10000000-0000-0000-0000-000000000003'
                  )");

            // Delete demo departments
            migrationBuilder.Sql(
                @"DELETE FROM [Departments] 
                  WHERE [Id] IN (
                    '10000000-0000-0000-0000-000000000001',
                    '10000000-0000-0000-0000-000000000002',
                    '10000000-0000-0000-0000-000000000003'
                  )");

            // Delete demo security policies
            migrationBuilder.Sql(
                @"DELETE FROM [SecurityPolicies] 
                  WHERE [Id] IN (
                    '30000000-0000-0000-0000-000000000001',
                    '30000000-0000-0000-0000-000000000002'
                  )");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Down migration - recreate demo data if needed
            migrationBuilder.Sql(
                @"IF NOT EXISTS (SELECT 1 FROM [Departments] WHERE [Id] = '10000000-0000-0000-0000-000000000001')
                  INSERT INTO [Departments] ([Id], [Code], [Name], [BudgetAmount], [Description])
                  VALUES 
                    ('10000000-0000-0000-0000-000000000001', N'FIN', N'Finance', 0.0, N'Finance & Accounting'),
                    ('10000000-0000-0000-0000-000000000002', N'HR', N'Human Resources', 0.0, N'Human Resources'),
                    ('10000000-0000-0000-0000-000000000003', N'OPS', N'Operations', 0.0, N'Operations')");

            migrationBuilder.Sql(
                @"IF NOT EXISTS (SELECT 1 FROM [SecurityPolicies] WHERE [Id] = '30000000-0000-0000-0000-000000000001')
                  INSERT INTO [SecurityPolicies] ([Id], [Description], [IsEnabled], [Name], [Value])
                  VALUES 
                    ('30000000-0000-0000-0000-000000000001', N'Enforce strong passwords and rotation', 1, N'Password Policy', N'Minimum 12 characters, uppercase + numbers + symbols. Rotate every 90 days.'),
                    ('30000000-0000-0000-0000-000000000002', N'Automatic logout after inactivity', 1, N'Session Timeout', N'30 minutes inactivity timeout')");
        }
    }
}
