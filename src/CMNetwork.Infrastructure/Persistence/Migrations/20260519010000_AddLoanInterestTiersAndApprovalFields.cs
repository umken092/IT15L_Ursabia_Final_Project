using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    public partial class AddLoanInterestTiersAndApprovalFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ApprovedAmount",
                table: "CustomerLoanApplications",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedTermMonths",
                table: "CustomerLoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoanInterestTiers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TermMonths = table.Column<int>(type: "int", nullable: false),
                    AnnualInterestRate = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanInterestTiers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoanInterestTiers_IsActive",
                table: "LoanInterestTiers",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_LoanInterestTiers_TermMonths",
                table: "LoanInterestTiers",
                column: "TermMonths",
                unique: true);

            migrationBuilder.InsertData(
                table: "LoanInterestTiers",
                columns: new[] { "Id", "TermMonths", "AnnualInterestRate", "IsActive", "CreatedAtUtc", "UpdatedAtUtc", "CreatedBy", "UpdatedBy" },
                values: new object[,]
                {
                    { new Guid("80000000-0000-0000-0000-000000000001"), 3, 5m, true, new DateTime(2026, 5, 19, 0, 0, 0, DateTimeKind.Utc), null, "system", null },
                    { new Guid("80000000-0000-0000-0000-000000000002"), 6, 7m, true, new DateTime(2026, 5, 19, 0, 0, 0, DateTimeKind.Utc), null, "system", null },
                    { new Guid("80000000-0000-0000-0000-000000000003"), 12, 10m, true, new DateTime(2026, 5, 19, 0, 0, 0, DateTimeKind.Utc), null, "system", null },
                    { new Guid("80000000-0000-0000-0000-000000000004"), 24, 14m, true, new DateTime(2026, 5, 19, 0, 0, 0, DateTimeKind.Utc), null, "system", null },
                    { new Guid("80000000-0000-0000-0000-000000000005"), 36, 18m, true, new DateTime(2026, 5, 19, 0, 0, 0, DateTimeKind.Utc), null, "system", null }
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoanInterestTiers");

            migrationBuilder.DropColumn(
                name: "ApprovedAmount",
                table: "CustomerLoanApplications");

            migrationBuilder.DropColumn(
                name: "ApprovedTermMonths",
                table: "CustomerLoanApplications");
        }
    }
}
