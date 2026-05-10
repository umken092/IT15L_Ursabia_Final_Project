using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    public partial class AddBankDirectoryMetadata : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BranchName",
                table: "BankDirectoryEntries",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "BankDirectoryEntries",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "Philippines");

            migrationBuilder.UpdateData(
                table: "BankDirectoryEntries",
                keyColumn: "Id",
                keyValue: new System.Guid("70000000-0000-0000-0000-000000000001"),
                columns: new[] { "Country", "BranchName" },
                values: new object[] { "Philippines", "Main Branch" });

            migrationBuilder.UpdateData(
                table: "BankDirectoryEntries",
                keyColumn: "Id",
                keyValue: new System.Guid("70000000-0000-0000-0000-000000000002"),
                columns: new[] { "Country", "BranchName" },
                values: new object[] { "Philippines", "Main Branch" });

            migrationBuilder.UpdateData(
                table: "BankDirectoryEntries",
                keyColumn: "Id",
                keyValue: new System.Guid("70000000-0000-0000-0000-000000000003"),
                columns: new[] { "Country", "BranchName" },
                values: new object[] { "Philippines", "Main Branch" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BranchName",
                table: "BankDirectoryEntries");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "BankDirectoryEntries");
        }
    }
}
