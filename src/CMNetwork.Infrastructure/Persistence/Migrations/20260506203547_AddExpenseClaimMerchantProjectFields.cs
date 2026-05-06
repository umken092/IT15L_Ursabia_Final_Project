using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseClaimMerchantProjectFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MerchantName",
                table: "ExpenseClaims",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProjectCode",
                table: "ExpenseClaims",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseClaims_EmployeeId",
                table: "ExpenseClaims",
                column: "EmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExpenseClaims_EmployeeId",
                table: "ExpenseClaims");

            migrationBuilder.DropColumn(
                name: "MerchantName",
                table: "ExpenseClaims");

            migrationBuilder.DropColumn(
                name: "ProjectCode",
                table: "ExpenseClaims");
        }
    }
}
