using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/expense-claims")]
[Authorize]
public class ExpenseClaimsController : ControllerBase
{
    private readonly CMNetworkDbContext _db;

    public ExpenseClaimsController(CMNetworkDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetClaims([FromQuery] string? status = null)
    {
        var userId = GetCurrentUserId();
        var isApprover = User.IsInRole("faculty-admin") || User.IsInRole("cfo") || User.IsInRole("super-admin") || User.IsInRole("accountant");

        var query = _db.ExpenseClaims.AsQueryable();

        // Employees see only their own claims; approvers see all
        if (!isApprover)
            query = query.Where(x => x.EmployeeId.ToString() == userId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ExpenseClaimStatus>(status, true, out var parsedStatus))
            query = query.Where(x => x.Status == parsedStatus);

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.ClaimNumber,
                x.EmployeeId,
                x.EmployeeName,
                x.ClaimDate,
                x.Category,
                x.Description,
                x.Amount,
                x.Status,
                x.ReviewedBy,
                x.ReviewNotes,
                x.ReviewedAtUtc,
                x.SubmittedAtUtc,
                x.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetClaim(Guid id)
    {
        var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == id);
        if (claim is null)
            return NotFound(new { message = "Expense claim not found." });

        var userId = GetCurrentUserId();
        var isApprover = User.IsInRole("faculty-admin") || User.IsInRole("cfo") || User.IsInRole("super-admin") || User.IsInRole("accountant");
        if (!isApprover && claim.EmployeeId.ToString() != userId)
            return Forbid();

        return Ok(claim);
    }

    [HttpPost]
    public async Task<IActionResult> CreateClaim([FromBody] CreateExpenseClaimRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userId = GetCurrentUserId();
        var userName = GetCurrentUser();

        var claimNumber = await GenerateClaimNumberAsync();

        var claim = new ExpenseClaim
        {
            Id = Guid.NewGuid(),
            ClaimNumber = claimNumber,
            EmployeeId = Guid.TryParse(userId, out var empId) ? empId : Guid.Empty,
            EmployeeName = userName,
            ClaimDate = request.ClaimDate,
            Category = request.Category.Trim(),
            Description = request.Description.Trim(),
            Amount = decimal.Round(request.Amount, 2),
            Status = ExpenseClaimStatus.Draft,
            CreatedAtUtc = DateTime.UtcNow,
            SubmittedAtUtc = DateTime.UtcNow
        };

        _db.ExpenseClaims.Add(claim);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetClaim), new { id = claim.Id }, claim);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> SubmitClaim(Guid id)
    {
        var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == id);
        if (claim is null)
            return NotFound(new { message = "Expense claim not found." });

        var userId = GetCurrentUserId();
        if (claim.EmployeeId.ToString() != userId)
            return Forbid();

        if (claim.Status != ExpenseClaimStatus.Draft)
            return BadRequest(new { message = "Only draft claims can be submitted." });

        claim.Status = ExpenseClaimStatus.Submitted;
        claim.SubmittedAtUtc = DateTime.UtcNow;

        // Create approval queue entry
        var approval = new ApprovalQueue
        {
            Id = Guid.NewGuid(),
            EntityType = "ExpenseClaim",
            EntityId = claim.Id,
            EntityDescription = $"Expense Claim {claim.ClaimNumber} — {claim.Category}: {claim.Description}",
            Amount = claim.Amount,
            RequestedByUserId = userId,
            RequestedByName = claim.EmployeeName,
            RequiredApproverRole = "faculty-admin",
            Status = ApprovalItemStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.ApprovalQueue.Add(approval);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Claim submitted for approval.", claimId = claim.Id });
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "faculty-admin,cfo,super-admin,accountant")]
    public async Task<IActionResult> ApproveClaim(Guid id, [FromBody] ReviewClaimRequest request)
    {
        return await ReviewClaim(id, ExpenseClaimStatus.Approved, request.Notes);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "faculty-admin,cfo,super-admin,accountant")]
    public async Task<IActionResult> RejectClaim(Guid id, [FromBody] ReviewClaimRequest request)
    {
        return await ReviewClaim(id, ExpenseClaimStatus.Rejected, request.Notes);
    }

    private async Task<IActionResult> ReviewClaim(Guid id, ExpenseClaimStatus newStatus, string? notes)
    {
        var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == id);
        if (claim is null)
            return NotFound(new { message = "Expense claim not found." });

        if (claim.Status != ExpenseClaimStatus.Submitted)
            return BadRequest(new { message = "Only submitted claims can be reviewed." });

        claim.Status = newStatus;
        claim.ReviewedBy = GetCurrentUser();
        claim.ReviewNotes = notes?.Trim();
        claim.ReviewedAtUtc = DateTime.UtcNow;

        // Resolve approval queue entry
        var approvalEntry = await _db.ApprovalQueue
            .FirstOrDefaultAsync(x => x.EntityType == "ExpenseClaim" && x.EntityId == id && x.Status == ApprovalItemStatus.Pending);

        if (approvalEntry is not null)
        {
            approvalEntry.Status = newStatus == ExpenseClaimStatus.Approved
                ? ApprovalItemStatus.Approved
                : ApprovalItemStatus.Rejected;
            approvalEntry.ProcessedByUserId = GetCurrentUserId();
            approvalEntry.ProcessedByName = GetCurrentUser();
            approvalEntry.Notes = notes?.Trim();
            approvalEntry.ProcessedAtUtc = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Claim {newStatus.ToString().ToLower()}.", claimId = id });
    }

    private string GetCurrentUser() =>
        User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "system";

    private string GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    private async Task<string> GenerateClaimNumberAsync()
    {
        var count = await _db.ExpenseClaims.CountAsync();
        return $"EC-{DateTime.UtcNow:yyyyMM}-{count + 1:D4}";
    }
}

public record CreateExpenseClaimRequest
{
    public DateOnly ClaimDate { get; init; }
    public string Category { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public decimal Amount { get; init; }
}

public record ReviewClaimRequest
{
    public string? Notes { get; init; }
}
