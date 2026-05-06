using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/approvals")]
[Authorize]
public class ApprovalsController : ControllerBase
{
    private readonly CMNetworkDbContext _db;
    private readonly IAuditEventLogger _audit;

    public ApprovalsController(CMNetworkDbContext db, IAuditEventLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("queue")]
    public async Task<IActionResult> GetQueue()
    {
        // Return items that match the current user's role
        var userRoles = User.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .ToList();

        var query = _db.ApprovalQueue
            .Where(x => x.Status == ApprovalItemStatus.Pending);

        // Filter by role if not super-admin
        if (!User.IsInRole("super-admin"))
            query = query.Where(x => userRoles.Contains(x.RequiredApproverRole));

        var items = await query
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.EntityType,
                x.EntityId,
                x.EntityDescription,
                x.Amount,
                x.RequestedByUserId,
                x.RequestedByName,
                x.RequiredApproverRole,
                x.Status,
                x.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var items = await _db.ApprovalQueue
            .Where(x => x.Status != ApprovalItemStatus.Pending)
            .OrderByDescending(x => x.ProcessedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.EntityType,
                x.EntityId,
                x.EntityDescription,
                x.Amount,
                x.RequestedByName,
                x.Status,
                x.ProcessedByName,
                x.Notes,
                x.ProcessedAtUtc,
                x.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "faculty-admin,cfo,super-admin,accountant")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ProcessApprovalRequest request)
    {
        return await Process(id, ApprovalItemStatus.Approved, request.Notes);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "faculty-admin,cfo,super-admin,accountant")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ProcessApprovalRequest request)
    {
        return await Process(id, ApprovalItemStatus.Rejected, request.Notes);
    }

    private async Task<IActionResult> Process(Guid id, ApprovalItemStatus newStatus, string? notes)
    {
        var item = await _db.ApprovalQueue.FirstOrDefaultAsync(x => x.Id == id);
        if (item is null)
            return NotFound(new { message = "Approval item not found." });

        if (item.Status != ApprovalItemStatus.Pending)
            return BadRequest(new { message = "This approval item has already been processed." });

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (newStatus == ApprovalItemStatus.Approved && item.RequestedByUserId == currentUserId)
            return BadRequest(new { message = "You cannot approve your own submission." });

        item.Status = newStatus;
        item.ProcessedByUserId = currentUserId ?? string.Empty;
        item.ProcessedByName = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "system";
        item.Notes = notes?.Trim();
        item.ProcessedAtUtc = DateTime.UtcNow;

        // Cascade status to the source entity if it's an ExpenseClaim
        if (item.EntityType == "ExpenseClaim")
        {
            var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(x => x.Id == item.EntityId);
            if (claim is not null)
            {
                claim.Status = newStatus == ApprovalItemStatus.Approved
                    ? ExpenseClaimStatus.Approved
                    : ExpenseClaimStatus.Rejected;
                claim.ReviewedBy = item.ProcessedByName;
                claim.ReviewNotes = notes?.Trim();
                claim.ReviewedAtUtc = DateTime.UtcNow;
            }
        }
        else if (item.EntityType == "BudgetReallocation")
        {
            var request = await _db.BudgetReallocationRequests.FirstOrDefaultAsync(x => x.Id == item.EntityId);
            if (request is not null && request.Status == BudgetReallocationStatus.Pending)
            {
                request.ProcessedByName = item.ProcessedByName;
                request.ProcessedAtUtc = DateTime.UtcNow;
                request.DecisionNotes = notes?.Trim();
                if (newStatus == ApprovalItemStatus.Approved)
                {
                    var source = await _db.Departments.FirstOrDefaultAsync(d => d.Id == request.SourceDepartmentId);
                    var target = await _db.Departments.FirstOrDefaultAsync(d => d.Id == request.TargetDepartmentId);
                    if (source is null || target is null)
                        return BadRequest(new { message = "Source or target department no longer exists." });
                    if (source.BudgetAmount < request.Amount)
                        return BadRequest(new { message = "Source department no longer has sufficient budget for this transfer." });

                    source.BudgetAmount -= request.Amount;
                    target.BudgetAmount += request.Amount;
                    request.Status = BudgetReallocationStatus.Approved;
                }
                else
                {
                    request.Status = BudgetReallocationStatus.Rejected;
                }
            }
        }

        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: item.EntityType,
            action: newStatus == ApprovalItemStatus.Approved ? "Approved" : "Rejected",
            category: AuditCategories.Approval,
            recordId: item.EntityId.ToString(),
            details: new
            {
                approvalQueueId = id,
                amount = item.Amount,
                requestedBy = item.RequestedByName,
                processedBy = item.ProcessedByName,
                notes,
            });

        return Ok(new
        {
            message = $"Approval item {newStatus.ToString().ToLower()}.",
            approvalId = id,
            entityType = item.EntityType,
            entityId = item.EntityId
        });
    }
}

public record ProcessApprovalRequest
{
    public string? Notes { get; init; }
}
