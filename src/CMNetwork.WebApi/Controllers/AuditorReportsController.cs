using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

/// <summary>
/// Auditor-specific read-only endpoints that aggregate data already in the
/// system (audit log, vendors, customers) into views the auditor needs:
/// Segregation-of-Duties report, User Activity Timeline, Vendor/Customer
/// change history.
/// </summary>
[ApiController]
[Route("api/auditor")]
[Authorize(Roles = "auditor,super-admin")]
public class AuditorReportsController : ControllerBase
{
    private readonly CMNetworkDbContext _db;
    private readonly IAuditEventLogger _audit;

    public AuditorReportsController(CMNetworkDbContext db, IAuditEventLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    // ── Segregation of Duties ─────────────────────────────────────────────────

    /// <summary>
    /// Pre-defined SoD rules. Each rule fires when the same actor performed
    /// BOTH activities within the lookback window.
    /// </summary>
    private static readonly SodRule[] SodRules = new[]
    {
        new SodRule(
            "SOD-001",
            "Vendor maintenance + Payment approval",
            "Same user created/edited a vendor AND approved a payment.",
            new[] { "Vendor" },
            new[] { "APInvoice" },
            new[] { "Created", "Updated" },
            new[] { "Approved", "Paid" }),
        new SodRule(
            "SOD-002",
            "Customer maintenance + Receipt posting",
            "Same user created/edited a customer AND posted a receipt.",
            new[] { "Customer" },
            new[] { "ARInvoice" },
            new[] { "Created", "Updated" },
            new[] { "Sent", "Approved", "Paid" }),
        new SodRule(
            "SOD-003",
            "Chart of Accounts edit + Journal posting",
            "Same user modified the Chart of Accounts AND posted a journal entry.",
            new[] { "ChartOfAccount" },
            new[] { "JournalEntry" },
            new[] { "Created", "Updated" },
            new[] { "Posted", "MonthEndClosed" }),
        new SodRule(
            "SOD-004",
            "Invoice creation + Invoice approval",
            "Same user created an invoice AND approved/sent it.",
            new[] { "APInvoice", "ARInvoice" },
            new[] { "APInvoice", "ARInvoice" },
            new[] { "Created" },
            new[] { "Approved", "Sent", "Paid" }),
        new SodRule(
            "SOD-005",
            "User management + Security policy change",
            "Same user provisioned an account AND changed a security policy.",
            new[] { "ApplicationUser" },
            new[] { "SecurityPolicy" },
            new[] { "UserCreated", "UserUpdated" },
            new[] { "Enabled", "Disabled", "Updated" }),
    };

    [HttpGet("sod-report")]
    public async Task<IActionResult> GetSodReport(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var fromUtc = from ?? DateTime.UtcNow.AddDays(-90);
        var toUtc = to ?? DateTime.UtcNow;

        var logs = await _db.AuditLogs
            .AsNoTracking()
            .Where(x => x.CreatedUtc >= fromUtc && x.CreatedUtc <= toUtc)
            .Select(x => new
            {
                x.Id, x.PerformedBy, x.UserEmail, x.EntityName, x.Action,
                x.CreatedUtc, x.RecordId,
            })
            .ToListAsync();

        var byUser = logs
            .Where(x => !string.IsNullOrWhiteSpace(x.PerformedBy))
            .GroupBy(x => x.PerformedBy)
            .ToList();

        var violations = new List<object>();
        foreach (var rule in SodRules)
        {
            foreach (var userGroup in byUser)
            {
                var aSide = userGroup
                    .Where(l => rule.EntitiesA.Contains(l.EntityName) && rule.ActionsA.Contains(l.Action))
                    .ToList();
                var bSide = userGroup
                    .Where(l => rule.EntitiesB.Contains(l.EntityName) && rule.ActionsB.Contains(l.Action))
                    .ToList();

                if (aSide.Count == 0 || bSide.Count == 0) continue;

                violations.Add(new
                {
                    ruleCode = rule.Code,
                    ruleTitle = rule.Title,
                    description = rule.Description,
                    user = userGroup.Key,
                    userEmail = userGroup.First().UserEmail,
                    sideACount = aSide.Count,
                    sideBCount = bSide.Count,
                    firstActivityUtc = aSide.Concat(bSide).Min(x => x.CreatedUtc),
                    lastActivityUtc = aSide.Concat(bSide).Max(x => x.CreatedUtc),
                    sampleSideA = aSide.Take(5).Select(l => new { l.Id, l.EntityName, l.Action, l.RecordId, l.CreatedUtc }),
                    sampleSideB = bSide.Take(5).Select(l => new { l.Id, l.EntityName, l.Action, l.RecordId, l.CreatedUtc }),
                });
            }
        }

        return Ok(new
        {
            from = fromUtc,
            to = toUtc,
            ruleCount = SodRules.Length,
            violationCount = violations.Count,
            rules = SodRules.Select(r => new { r.Code, r.Title, r.Description }),
            violations,
        });
    }

    // ── User Activity Timeline ────────────────────────────────────────────────

    [HttpGet("user-activity")]
    public async Task<IActionResult> GetUserActivity(
        [FromQuery] string? user = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int take = 200)
    {
        if (take < 1) take = 1;
        if (take > 1000) take = 1000;

        var fromUtc = from ?? DateTime.UtcNow.AddDays(-30);
        var toUtc = to ?? DateTime.UtcNow;

        var query = _db.AuditLogs.AsNoTracking()
            .Where(x => x.CreatedUtc >= fromUtc && x.CreatedUtc <= toUtc);

        if (!string.IsNullOrWhiteSpace(user))
        {
            var u = user.Trim();
            query = query.Where(x => x.PerformedBy == u || (x.UserEmail != null && x.UserEmail == u));
        }

        var items = await query
            .OrderByDescending(x => x.CreatedUtc)
            .Take(take)
            .Select(x => new
            {
                id = x.Id,
                createdUtc = x.CreatedUtc,
                category = x.ActionCategory,
                entity = x.EntityName,
                action = x.Action,
                recordId = x.RecordId,
                performedBy = x.PerformedBy,
                userEmail = x.UserEmail,
                ipAddress = x.IpAddress,
            })
            .ToListAsync();

        var users = await _db.AuditLogs.AsNoTracking()
            .Where(x => x.CreatedUtc >= fromUtc.AddDays(-30))
            .Select(x => x.UserEmail ?? x.PerformedBy)
            .Where(x => !string.IsNullOrEmpty(x))
            .Distinct()
            .OrderBy(x => x)
            .Take(200)
            .ToListAsync();

        return Ok(new
        {
            from = fromUtc,
            to = toUtc,
            user,
            availableUsers = users,
            items,
        });
    }

    // ── Vendor / Customer history (derived from AuditLogs) ────────────────────

    [HttpGet("vendor-history/{id:guid}")]
    public Task<IActionResult> GetVendorHistory(Guid id) => GetEntityHistory("Vendor", id);

    [HttpGet("customer-history/{id:guid}")]
    public Task<IActionResult> GetCustomerHistory(Guid id) => GetEntityHistory("Customer", id);

    private async Task<IActionResult> GetEntityHistory(string entityName, Guid id)
    {
        var key = id.ToString();
        var rows = await _db.AuditLogs.AsNoTracking()
            .Where(x => x.EntityName == entityName && x.RecordId == key)
            .OrderByDescending(x => x.CreatedUtc)
            .Select(x => new
            {
                id = x.Id,
                createdUtc = x.CreatedUtc,
                action = x.Action,
                category = x.ActionCategory,
                performedBy = x.PerformedBy,
                userEmail = x.UserEmail,
                details = x.DetailsJson,
            })
            .ToListAsync();

        return Ok(new { entityName, recordId = key, items = rows });
    }

    private sealed record SodRule(
        string Code,
        string Title,
        string Description,
        string[] EntitiesA,
        string[] EntitiesB,
        string[] ActionsA,
        string[] ActionsB);
}
