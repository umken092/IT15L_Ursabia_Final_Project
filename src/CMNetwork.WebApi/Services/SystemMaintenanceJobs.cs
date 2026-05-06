using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Hangfire;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Services;

public class SystemMaintenanceJobs
{
    public static readonly IReadOnlyList<SystemRecurringJobDefinition> RecurringJobDefinitions =
    [
        new(
            "cmnetwork-system-health-snapshot",
            "Capture System Health Snapshot",
            Cron.Hourly(),
            "Hourly"),
        new(
            "cmnetwork-pending-approvals-review",
            "Review Pending Approvals",
            Cron.Daily(),
            "Daily"),
        new(
            "cmnetwork-audit-activity-summary",
            "Refresh Audit Activity Summary",
            Cron.Daily(),
            "Daily"),
    ];

    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<SystemMaintenanceJobs> _logger;

    public SystemMaintenanceJobs(CMNetworkDbContext dbContext, ILogger<SystemMaintenanceJobs> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public static void RegisterRecurringJobs(IRecurringJobManager recurringJobManager)
    {
        recurringJobManager.AddOrUpdate<SystemMaintenanceJobs>(
            RecurringJobDefinitions[0].Id,
            job => job.CaptureSystemHealthSnapshotAsync(),
            RecurringJobDefinitions[0].Cron);

        recurringJobManager.AddOrUpdate<SystemMaintenanceJobs>(
            RecurringJobDefinitions[1].Id,
            job => job.ReviewPendingApprovalsAsync(),
            RecurringJobDefinitions[1].Cron);

        recurringJobManager.AddOrUpdate<SystemMaintenanceJobs>(
            RecurringJobDefinitions[2].Id,
            job => job.RefreshAuditActivitySummaryAsync(),
            RecurringJobDefinitions[2].Cron);
    }

    public async Task CaptureSystemHealthSnapshotAsync()
    {
        var activeUsers = await _dbContext.Users.CountAsync(user => user.IsActive);
        var pendingApprovals = await _dbContext.ApprovalQueue.CountAsync(item => item.Status == ApprovalItemStatus.Pending);
        var failedAuditEvents = await _dbContext.AuditLogs.CountAsync(log => log.ActionCategory == "Security");

        _logger.LogInformation(
            "System health snapshot captured. ActiveUsers={ActiveUsers}, PendingApprovals={PendingApprovals}, SecurityAuditEvents={SecurityAuditEvents}",
            activeUsers,
            pendingApprovals,
            failedAuditEvents);
    }

    public async Task ReviewPendingApprovalsAsync()
    {
        var pendingApprovals = await _dbContext.ApprovalQueue
            .Where(item => item.Status == ApprovalItemStatus.Pending)
            .OrderBy(item => item.CreatedAtUtc)
            .Select(item => new { item.EntityType, item.CreatedAtUtc })
            .Take(10)
            .ToListAsync();

        _logger.LogInformation(
            "Pending approval review completed. PendingCount={PendingCount}, OldestCreatedUtc={OldestCreatedUtc}",
            pendingApprovals.Count,
            pendingApprovals.FirstOrDefault()?.CreatedAtUtc);
    }

    public async Task RefreshAuditActivitySummaryAsync()
    {
        var sinceUtc = DateTime.UtcNow.AddDays(-1);
        var recentAuditEvents = await _dbContext.AuditLogs.CountAsync(log => log.CreatedUtc >= sinceUtc);
        var unreviewedAuditEvents = await _dbContext.AuditLogs.CountAsync(log => !log.IsReviewed);

        _logger.LogInformation(
            "Audit activity summary refreshed. RecentEvents={RecentEvents}, UnreviewedEvents={UnreviewedEvents}",
            recentAuditEvents,
            unreviewedAuditEvents);
    }
}

public sealed record SystemRecurringJobDefinition(
    string Id,
    string Name,
    string Cron,
    string ScheduleLabel);