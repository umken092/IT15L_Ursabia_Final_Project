using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CMNetwork.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixPendingModelChanges : Migration
    {
        /// <inheritdoc />
        /// <remarks>
        /// This migration is intentionally empty. Its sole purpose is to update
        /// the EF Core model snapshot (CMNetworkDbContextModelSnapshot) so that
        /// EF no longer raises PendingModelChangesWarning on startup.
        /// All actual schema changes are captured in preceding migrations.
        /// </remarks>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
