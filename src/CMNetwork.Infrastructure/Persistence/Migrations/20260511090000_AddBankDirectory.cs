using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    public partial class AddBankDirectory : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BankDirectoryId",
                table: "BankStatements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BankDirectoryEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    AccountNumberPattern = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    AccountNumberSample = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ListedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ListedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    RemovedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RemovedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankDirectoryEntries", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "BankDirectoryEntries",
                columns: new[] { "Id", "Name", "AccountNumberPattern", "AccountNumberSample", "IsActive", "ListedAtUtc", "ListedBy", "RemovedAtUtc", "RemovedBy" },
                values: new object[,]
                {
                    {
                        new Guid("70000000-0000-0000-0000-000000000001"),
                        "BDO",
                        "^\\d{4}-\\d{4}-\\d{2}$",
                        "1234-5678-90",
                        true,
                        new DateTime(2026, 5, 11, 0, 0, 0, DateTimeKind.Utc),
                        "system",
                        null,
                        null
                    },
                    {
                        new Guid("70000000-0000-0000-0000-000000000002"),
                        "BPI",
                        "^\\d{3,4}-\\d{4}-\\d{2,4}$",
                        "1234-5678-90",
                        true,
                        new DateTime(2026, 5, 11, 0, 0, 0, DateTimeKind.Utc),
                        "system",
                        null,
                        null
                    },
                    {
                        new Guid("70000000-0000-0000-0000-000000000003"),
                        "UnionBank",
                        "^\\d{4}-\\d{4}-\\d{4}$",
                        "1234-5678-9012",
                        true,
                        new DateTime(2026, 5, 11, 0, 0, 0, DateTimeKind.Utc),
                        "system",
                        null,
                        null
                    }
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankStatements_BankDirectoryId",
                table: "BankStatements",
                column: "BankDirectoryId");

            migrationBuilder.CreateIndex(
                name: "IX_BankDirectoryEntries_Name",
                table: "BankDirectoryEntries",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BankStatements_BankDirectoryEntries_BankDirectoryId",
                table: "BankStatements",
                column: "BankDirectoryId",
                principalTable: "BankDirectoryEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankStatements_BankDirectoryEntries_BankDirectoryId",
                table: "BankStatements");

            migrationBuilder.DropTable(
                name: "BankDirectoryEntries");

            migrationBuilder.DropIndex(
                name: "IX_BankStatements_BankDirectoryId",
                table: "BankStatements");

            migrationBuilder.DropColumn(
                name: "BankDirectoryId",
                table: "BankStatements");
        }
    }
}
