using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/budget")]
[Authorize]
public class BudgetController : ControllerBase
{
    private readonly CMNetworkDbContext _db;
    private readonly ILogger<BudgetController> _logger;

    public BudgetController(CMNetworkDbContext db, ILogger<BudgetController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var items = await _db.Departments
            .OrderBy(d => d.Name)
            .Select(d => new
            {
                id = d.Id,
                code = d.Code,
                name = d.Name,
                budgetAmount = d.BudgetAmount,
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("reallocations")]
    public async Task<IActionResult> GetReallocations([FromQuery] string? status = null)
    {
        var query = _db.BudgetReallocationRequests.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<BudgetReallocationStatus>(status, true, out var parsed))
        {
            query = query.Where(x => x.Status == parsed);
        }

        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Join(_db.Departments, x => x.SourceDepartmentId, d => d.Id, (x, src) => new { x, src })
            .Join(_db.Departments, t => t.x.TargetDepartmentId, d => d.Id, (t, tgt) => new
            {
                t.x.Id,
                t.x.RequestNumber,
                SourceDepartment = new { t.src.Id, t.src.Code, t.src.Name },
                TargetDepartment = new { tgt.Id, tgt.Code, tgt.Name },
                t.x.Amount,
                t.x.Currency,
                t.x.Justification,
                Status = t.x.Status.ToString(),
                t.x.EffectiveDate,
                t.x.RequestedByName,
                t.x.CreatedAtUtc,
                t.x.ProcessedByName,
                t.x.ProcessedAtUtc,
                t.x.DecisionNotes,
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpPost("reallocations")]
    [Authorize(Roles = "accountant,faculty-admin,cfo,super-admin,department-head,manager")]
    public async Task<IActionResult> CreateReallocation([FromBody] CreateReallocationRequest body)
    {
        if (body is null) return BadRequest(new { message = "Body is required." });
        if (body.SourceDepartmentId == Guid.Empty || body.TargetDepartmentId == Guid.Empty)
            return BadRequest(new { message = "Source and target departments are required." });
        if (body.SourceDepartmentId == body.TargetDepartmentId)
            return BadRequest(new { message = "Source and target departments must differ." });
        if (body.Amount <= 0)
            return BadRequest(new { message = "Amount must be greater than zero." });
        if (string.IsNullOrWhiteSpace(body.Justification))
            return BadRequest(new { message = "Justification is required." });

        var source = await _db.Departments.FirstOrDefaultAsync(d => d.Id == body.SourceDepartmentId);
        var target = await _db.Departments.FirstOrDefaultAsync(d => d.Id == body.TargetDepartmentId);
        if (source is null || target is null)
            return NotFound(new { message = "One or both departments were not found." });

        if (source.BudgetAmount < body.Amount)
        {
            return BadRequest(new
            {
                message = $"Source department budget ({source.BudgetAmount:N2}) is less than the requested amount ({body.Amount:N2})."
            });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var userName = User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? "system";

        var requestNumber = $"BRR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";

        var request = new BudgetReallocationRequest
        {
            Id = Guid.NewGuid(),
            RequestNumber = requestNumber,
            SourceDepartmentId = source.Id,
            TargetDepartmentId = target.Id,
            Amount = body.Amount,
            Currency = string.IsNullOrWhiteSpace(body.Currency) ? "USD" : body.Currency.ToUpperInvariant(),
            Justification = body.Justification.Trim(),
            EffectiveDate = body.EffectiveDate?.Date ?? DateTime.UtcNow.Date,
            Status = BudgetReallocationStatus.Pending,
            RequestedByUserId = userId,
            RequestedByName = userName,
            CreatedAtUtc = DateTime.UtcNow,
        };

        var queueEntry = new ApprovalQueue
        {
            Id = Guid.NewGuid(),
            EntityType = "BudgetReallocation",
            EntityId = request.Id,
            EntityDescription = $"{requestNumber}: {source.Name} → {target.Name} ({request.Currency} {request.Amount:N2})",
            Amount = request.Amount,
            RequestedByUserId = userId,
            RequestedByName = userName,
            RequiredApproverRole = "cfo",
            Status = ApprovalItemStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow,
        };

        _db.BudgetReallocationRequests.Add(request);
        _db.ApprovalQueue.Add(queueEntry);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Created budget reallocation {RequestNumber} for {Amount} {Currency} from {Source} to {Target}",
            requestNumber, request.Amount, request.Currency, source.Code, target.Code);

        return Ok(new
        {
            id = request.Id,
            requestNumber = request.RequestNumber,
            approvalId = queueEntry.Id,
            status = request.Status.ToString(),
        });
    }
}

public record CreateReallocationRequest
{
    public Guid SourceDepartmentId { get; init; }
    public Guid TargetDepartmentId { get; init; }
    public decimal Amount { get; init; }
    public string? Currency { get; init; }
    public string Justification { get; init; } = string.Empty;
    public DateTime? EffectiveDate { get; init; }
}
