using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIndexesAndFkHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ARInvoices_CustomerId_Status",
                table: "ARInvoices");

            migrationBuilder.DropIndex(
                name: "IX_APInvoices_VendorId_Status",
                table: "APInvoices");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_EntryDate",
                table: "JournalEntries",
                column: "EntryDate");

            migrationBuilder.CreateIndex(
                name: "IX_ARInvoices_CustomerId_Status_InvoiceDate",
                table: "ARInvoices",
                columns: new[] { "CustomerId", "Status", "InvoiceDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalQueue_Status_RequiredApproverRole",
                table: "ApprovalQueue",
                columns: new[] { "Status", "RequiredApproverRole" });

            migrationBuilder.CreateIndex(
                name: "IX_APInvoices_VendorId_Status_InvoiceDate",
                table: "APInvoices",
                columns: new[] { "VendorId", "Status", "InvoiceDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_ExpenseClaims_AspNetUsers_EmployeeId",
                table: "ExpenseClaims",
                column: "EmployeeId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExpenseClaims_AspNetUsers_EmployeeId",
                table: "ExpenseClaims");

            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_EntryDate",
                table: "JournalEntries");

            migrationBuilder.DropIndex(
                name: "IX_ARInvoices_CustomerId_Status_InvoiceDate",
                table: "ARInvoices");

            migrationBuilder.DropIndex(
                name: "IX_ApprovalQueue_Status_RequiredApproverRole",
                table: "ApprovalQueue");

            migrationBuilder.DropIndex(
                name: "IX_APInvoices_VendorId_Status_InvoiceDate",
                table: "APInvoices");

            migrationBuilder.CreateIndex(
                name: "IX_ARInvoices_CustomerId_Status",
                table: "ARInvoices",
                columns: new[] { "CustomerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_APInvoices_VendorId_Status",
                table: "APInvoices",
                columns: new[] { "VendorId", "Status" });
        }
    }
}
