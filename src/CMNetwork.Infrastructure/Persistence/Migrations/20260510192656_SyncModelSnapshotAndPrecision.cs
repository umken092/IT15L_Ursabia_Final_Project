using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SyncModelSnapshotAndPrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No-op: schema changes are handled by earlier bank-directory migrations.
            // This migration exists to sync the model snapshot with the current model.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op.
        }
    }
}
