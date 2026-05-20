using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeProfiles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TIN = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SSS = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    BankAccount = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    JoinDate = table.Column<DateOnly>(type: "date", nullable: false),
                    HourlyRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    LastLoginUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeProfiles", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_EmployeeProfiles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeProfiles_SSS",
                table: "EmployeeProfiles",
                column: "SSS");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeProfiles_TIN",
                table: "EmployeeProfiles",
                column: "TIN");

            migrationBuilder.Sql(@"
INSERT INTO EmployeeProfiles (UserId, TIN, SSS, BankAccount, JoinDate, HourlyRate, LastLoginUtc)
SELECT
    u.Id,
    COALESCE(NULLIF(LTRIM(RTRIM(u.TIN)), ''), ''),
    COALESCE(NULLIF(LTRIM(RTRIM(u.SSS)), ''), ''),
    COALESCE(NULLIF(LTRIM(RTRIM(u.BankAccount)), ''), ''),
    COALESCE(u.JoinDate, CAST(SYSUTCDATETIME() AS date)),
    u.HourlyRate,
    u.LastLoginUtc
FROM AspNetUsers u
WHERE EXISTS (
    SELECT 1
    FROM AspNetUserRoles ur
    INNER JOIN AspNetRoles r ON r.Id = ur.RoleId
    WHERE ur.UserId = u.Id
      AND LOWER(r.Name) <> 'customer'
)
AND NOT EXISTS (
    SELECT 1
    FROM EmployeeProfiles ep
    WHERE ep.UserId = u.Id
);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeProfiles");
        }
    }
}
