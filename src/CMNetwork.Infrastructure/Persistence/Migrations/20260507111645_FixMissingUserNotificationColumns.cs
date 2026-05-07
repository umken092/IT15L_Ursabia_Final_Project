using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixMissingUserNotificationColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'EmailNotificationsEnabled') IS NULL
BEGIN
    ALTER TABLE [dbo].[AspNetUsers]
    ADD [EmailNotificationsEnabled] bit NOT NULL CONSTRAINT [DF_AspNetUsers_EmailNotificationsEnabled] DEFAULT (1);
END;");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'InAppNotificationsEnabled') IS NULL
BEGIN
    ALTER TABLE [dbo].[AspNetUsers]
    ADD [InAppNotificationsEnabled] bit NOT NULL CONSTRAINT [DF_AspNetUsers_InAppNotificationsEnabled] DEFAULT (1);
END;");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'SmsNotificationsEnabled') IS NULL
BEGIN
    ALTER TABLE [dbo].[AspNetUsers]
    ADD [SmsNotificationsEnabled] bit NOT NULL CONSTRAINT [DF_AspNetUsers_SmsNotificationsEnabled] DEFAULT (0);
END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'EmailNotificationsEnabled') IS NOT NULL
BEGIN
    DECLARE @df1 sysname;
    SELECT @df1 = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'AspNetUsers' AND c.name = 'EmailNotificationsEnabled';

    IF @df1 IS NOT NULL EXEC('ALTER TABLE [dbo].[AspNetUsers] DROP CONSTRAINT [' + @df1 + ']');
    ALTER TABLE [dbo].[AspNetUsers] DROP COLUMN [EmailNotificationsEnabled];
END;");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'InAppNotificationsEnabled') IS NOT NULL
BEGIN
    DECLARE @df2 sysname;
    SELECT @df2 = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'AspNetUsers' AND c.name = 'InAppNotificationsEnabled';

    IF @df2 IS NOT NULL EXEC('ALTER TABLE [dbo].[AspNetUsers] DROP CONSTRAINT [' + @df2 + ']');
    ALTER TABLE [dbo].[AspNetUsers] DROP COLUMN [InAppNotificationsEnabled];
END;");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.AspNetUsers', 'SmsNotificationsEnabled') IS NOT NULL
BEGIN
    DECLARE @df3 sysname;
    SELECT @df3 = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'AspNetUsers' AND c.name = 'SmsNotificationsEnabled';

    IF @df3 IS NOT NULL EXEC('ALTER TABLE [dbo].[AspNetUsers] DROP CONSTRAINT [' + @df3 + ']');
    ALTER TABLE [dbo].[AspNetUsers] DROP COLUMN [SmsNotificationsEnabled];
END;");
        }
    }
}
