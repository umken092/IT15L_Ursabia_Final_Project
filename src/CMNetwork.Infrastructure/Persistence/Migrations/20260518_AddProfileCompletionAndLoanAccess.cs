using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileCompletionAndLoanAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TIN",
                table: "Customers",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SSS",
                table: "Customers",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankAccount",
                table: "Customers",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "Customers",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BankVerificationStatus",
                table: "Customers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "BankVerifiedAtUtc",
                table: "Customers",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TIN",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "SSS",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "BankAccount",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "BankVerificationStatus",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "BankVerifiedAtUtc",
                table: "Customers");
        }
    }
}
