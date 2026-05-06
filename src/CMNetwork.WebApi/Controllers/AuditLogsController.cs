using System.Globalization;
using System.Security.Claims;
using System.Text;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

/// <summary>
/// Audit log viewer endpoints. Accessible to super-admins and auditors.
/// Lives in its own controller so it is not gated by AdminController's
/// "SuperAdminOnly" policy.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "super-admin,auditor")]
public class AuditLogsController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly IAuditEventLogger _audit;

    public AuditLogsController(CMNetworkDbContext dbContext, IAuditEventLogger audit)
    {
        _dbContext = dbContext;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? category,
        [FromQuery] string? userEmail,
        [FromQuery] string? entityName,
        [FromQuery] string? recordId,
        [FromQuery] string? action,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool? reviewed,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 500) pageSize = 50;

        var q = BuildAuditQuery(category, userEmail, entityName, recordId, action, from, to, reviewed);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(x => x.CreatedUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                userAgent = x.UserAgent,
                isReviewed = x.IsReviewed,
                reviewedBy = x.ReviewedBy,
                reviewedDate = x.ReviewedDate,
                details = x.DetailsJson,
            })
            .ToListAsync();

        return Ok(new { totalCount = total, page, pageSize, items });
    }

    [HttpPost("review")]
    public async Task<IActionResult> ReviewAuditLogs([FromBody] AuditReviewRequest request)
    {
        if (request.Ids is null || request.Ids.Count == 0)
            return BadRequest(new { message = "At least one audit log id is required." });

        var reviewer = User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? "system";

        var rows = await _dbContext.AuditLogs
            .Where(x => request.Ids.Contains(x.Id))
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            row.IsReviewed = true;
            row.ReviewedBy = reviewer;
            row.ReviewedDate = now;
        }
        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: nameof(CMNetwork.Domain.Entities.AuditLogEntry),
            action: "Reviewed",
            category: AuditCategories.Review,
            details: new { count = rows.Count, ids = rows.Select(r => r.Id) });

        return Ok(new { reviewed = rows.Count });
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] string? category,
        [FromQuery] string? userEmail,
        [FromQuery] string? entityName,
        [FromQuery] string? recordId,
        [FromQuery] string? action,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool? reviewed)
    {
        var q = BuildAuditQuery(category, userEmail, entityName, recordId, action, from, to, reviewed);

        var rows = await q
            .OrderByDescending(x => x.CreatedUtc)
            .Take(10_000)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("CreatedUtc,Category,Entity,Action,RecordId,PerformedBy,UserEmail,IpAddress,IsReviewed,ReviewedBy,ReviewedDate");
        foreach (var r in rows)
        {
            sb.Append(r.CreatedUtc.ToString("o", CultureInfo.InvariantCulture)).Append(',');
            sb.Append(Csv(r.ActionCategory)).Append(',');
            sb.Append(Csv(r.EntityName)).Append(',');
            sb.Append(Csv(r.Action)).Append(',');
            sb.Append(Csv(r.RecordId)).Append(',');
            sb.Append(Csv(r.PerformedBy)).Append(',');
            sb.Append(Csv(r.UserEmail)).Append(',');
            sb.Append(Csv(r.IpAddress)).Append(',');
            sb.Append(r.IsReviewed ? "true" : "false").Append(',');
            sb.Append(Csv(r.ReviewedBy)).Append(',');
            sb.Append(r.ReviewedDate?.ToString("o", CultureInfo.InvariantCulture) ?? string.Empty);
            sb.AppendLine();
        }

        await _audit.LogAsync(
            entityName: nameof(CMNetwork.Domain.Entities.AuditLogEntry),
            action: "Exported",
            category: AuditCategories.Export,
            details: new { rowCount = rows.Count, filters = new { category, userEmail, entityName, recordId, action, from, to, reviewed } });

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"audit-logs-{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    private IQueryable<CMNetwork.Domain.Entities.AuditLogEntry> BuildAuditQuery(
        string? category, string? userEmail, string? entityName, string? recordId,
        string? action, DateTime? from, DateTime? to, bool? reviewed)
    {
        var q = _dbContext.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(category))   q = q.Where(x => x.ActionCategory == category);
        if (!string.IsNullOrWhiteSpace(userEmail))  q = q.Where(x => x.UserEmail != null && x.UserEmail.Contains(userEmail));
        if (!string.IsNullOrWhiteSpace(entityName)) q = q.Where(x => x.EntityName.Contains(entityName));
        if (!string.IsNullOrWhiteSpace(recordId))   q = q.Where(x => x.RecordId == recordId);
        if (!string.IsNullOrWhiteSpace(action))     q = q.Where(x => x.Action.Contains(action));
        if (from.HasValue) q = q.Where(x => x.CreatedUtc >= from.Value);
        if (to.HasValue)   q = q.Where(x => x.CreatedUtc <= to.Value);
        if (reviewed.HasValue) q = q.Where(x => x.IsReviewed == reviewed.Value);
        return q;
    }

    private static string Csv(string? s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        var needsQuotes = s.IndexOfAny(new[] { ',', '"', '\n', '\r' }) >= 0;
        var escaped = s.Replace("\"", "\"\"");
        return needsQuotes ? $"\"{escaped}\"" : escaped;
    }
}
