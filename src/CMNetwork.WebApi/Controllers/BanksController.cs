using System.Security.Claims;
using System.Text.RegularExpressions;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/banks")]
[Authorize(Roles = "accountant,cfo,super-admin")]
public class BanksController : ControllerBase
{
    private readonly CMNetworkDbContext _db;
    private readonly IAuditEventLogger _audit;

    public BanksController(CMNetworkDbContext db, IAuditEventLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetBanks(
        [FromQuery] bool includeInactive = false,
        [FromQuery] string? search = null,
        [FromQuery] string status = "all",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (includeInactive && !User.IsInRole("super-admin"))
            return Forbid();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.BankDirectoryEntries.AsNoTracking();

        var statusFilter = status.Trim().ToLowerInvariant();
        if (statusFilter == "active")
        {
            query = query.Where(x => x.IsActive);
        }
        else if (statusFilter == "removed")
        {
            if (!User.IsInRole("super-admin"))
                return Forbid();

            query = query.Where(x => !x.IsActive);
        }
        else if (statusFilter == "all")
        {
            if (!includeInactive)
                query = query.Where(x => x.IsActive);
        }
        else
        {
            return BadRequest(new { message = "Invalid status filter. Use all, active, or removed." });
        }

        var term = search?.Trim();
        if (!string.IsNullOrWhiteSpace(term))
            query = query.Where(x => x.Name.Contains(term));

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Country,
                x.BranchName,
                x.AccountNumberPattern,
                x.AccountNumberSample,
                x.IsActive,
                x.ListedAtUtc,
                x.ListedBy,
                x.RemovedAtUtc,
                x.RemovedBy
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            total,
            page,
            pageSize
        });
    }

    [HttpPost]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> AddBank([FromBody] CreateBankRequest request)
    {
        var name = request.Name.Trim();
        var country = string.IsNullOrWhiteSpace(request.Country) ? "Philippines" : request.Country.Trim();
        var branchName = string.IsNullOrWhiteSpace(request.BranchName) ? null : request.BranchName.Trim();
        var pattern = request.AccountNumberPattern.Trim();
        var sample = request.AccountNumberSample.Trim();
        var currentUser = GetCurrentUser();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(country) || string.IsNullOrWhiteSpace(pattern) || string.IsNullOrWhiteSpace(sample))
            return BadRequest(new { message = "Bank name, country, account number format, and sample are required." });

        if (!IsRegexPatternValid(pattern))
            return BadRequest(new { message = "Account number format pattern is invalid." });

        var existing = await _db.BankDirectoryEntries.FirstOrDefaultAsync(x => x.Name.ToLower() == name.ToLower());
        if (existing is not null)
        {
            if (existing.IsActive)
                return Conflict(new { message = "A bank with this name already exists." });

            existing.AccountNumberPattern = pattern;
            existing.AccountNumberSample = sample;
            existing.Country = country;
            existing.BranchName = branchName;
            existing.IsActive = true;
            existing.ListedAtUtc = DateTime.UtcNow;
            existing.ListedBy = currentUser;
            existing.RemovedAtUtc = null;
            existing.RemovedBy = null;

            await _db.SaveChangesAsync();
            await _audit.LogAsync(
                entityName: nameof(BankDirectoryEntry),
                action: "Relisted",
                category: AuditCategories.System,
                recordId: existing.Id.ToString(),
                details: new
                {
                    existing.Name,
                    existing.Country,
                    existing.BranchName,
                    existing.AccountNumberPattern,
                    existing.AccountNumberSample
                });
            return Ok(new { message = "Bank re-listed successfully.", id = existing.Id });
        }

        var bank = new BankDirectoryEntry
        {
            Id = Guid.NewGuid(),
            Name = name,
            Country = country,
            BranchName = branchName,
            AccountNumberPattern = pattern,
            AccountNumberSample = sample,
            IsActive = true,
            ListedAtUtc = DateTime.UtcNow,
            ListedBy = currentUser
        };

        _db.BankDirectoryEntries.Add(bank);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: nameof(BankDirectoryEntry),
            action: "Created",
            category: AuditCategories.System,
            recordId: bank.Id.ToString(),
            details: new
            {
                bank.Name,
                bank.Country,
                bank.BranchName,
                bank.AccountNumberPattern,
                bank.AccountNumberSample
            });

        return CreatedAtAction(nameof(GetBanks), new { includeInactive = true }, new { id = bank.Id, message = "Bank added successfully." });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> UpdateBank(Guid id, [FromBody] UpdateBankRequest request)
    {
        var bank = await _db.BankDirectoryEntries.FirstOrDefaultAsync(x => x.Id == id);
        if (bank is null)
            return NotFound(new { message = "Bank not found." });

        var name = request.Name.Trim();
        var country = string.IsNullOrWhiteSpace(request.Country) ? "Philippines" : request.Country.Trim();
        var branchName = string.IsNullOrWhiteSpace(request.BranchName) ? null : request.BranchName.Trim();
        var pattern = request.AccountNumberPattern.Trim();
        var sample = request.AccountNumberSample.Trim();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(country) || string.IsNullOrWhiteSpace(pattern) || string.IsNullOrWhiteSpace(sample))
            return BadRequest(new { message = "Bank name, country, account number format, and sample are required." });

        if (!IsRegexPatternValid(pattern))
            return BadRequest(new { message = "Account number format pattern is invalid." });

        var duplicate = await _db.BankDirectoryEntries
            .AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower());
        if (duplicate)
            return Conflict(new { message = "Another bank already uses that name." });

        var before = new
        {
            bank.Name,
            bank.Country,
            bank.BranchName,
            bank.AccountNumberPattern,
            bank.AccountNumberSample,
            bank.IsActive
        };

        var isFormatChanged = bank.AccountNumberPattern != pattern || bank.AccountNumberSample != sample;
        if (isFormatChanged)
        {
            var blockingWorkflowCount = await _db.BankStatements
                .Where(x => x.BankDirectoryId == id)
                .CountAsync(x => x.Reconciliation == null || x.Reconciliation.Status != BankReconciliationStatus.Finalized);

            if (blockingWorkflowCount > 0)
            {
                await _audit.LogAsync(
                    entityName: nameof(BankDirectoryEntry),
                    action: "UpdateFormatBlocked",
                    category: AuditCategories.Security,
                    recordId: bank.Id.ToString(),
                    details: new
                    {
                        bank.Name,
                        reason = "OpenReconciliationWorkflows",
                        blockingWorkflowCount
                    });

                return BadRequest(new
                {
                    message = $"Cannot change account number format while {blockingWorkflowCount} open reconciliation workflow(s) still reference {bank.Name}. Finalize those statements first."
                });
            }
        }

        bank.Name = name;
        bank.Country = country;
        bank.BranchName = branchName;
        bank.AccountNumberPattern = pattern;
        bank.AccountNumberSample = sample;

        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: nameof(BankDirectoryEntry),
            action: "Updated",
            category: AuditCategories.System,
            recordId: bank.Id.ToString(),
            details: new
            {
                before,
                after = new
                {
                    bank.Name,
                    bank.Country,
                    bank.BranchName,
                    bank.AccountNumberPattern,
                    bank.AccountNumberSample,
                    bank.IsActive
                }
            });

        return Ok(new { message = "Bank updated successfully.", id = bank.Id });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> RemoveBank(Guid id)
    {
        var bank = await _db.BankDirectoryEntries.FirstOrDefaultAsync(x => x.Id == id);
        if (bank is null)
            return NotFound(new { message = "Bank not found." });

        if (!bank.IsActive)
            return BadRequest(new { message = "Bank is already removed." });

        var blockingWorkflowCount = await _db.BankStatements
            .Where(x => x.BankDirectoryId == id)
            .CountAsync(x => x.Reconciliation == null || x.Reconciliation.Status != BankReconciliationStatus.Finalized);

        if (blockingWorkflowCount > 0)
        {
            await _audit.LogAsync(
                entityName: nameof(BankDirectoryEntry),
                action: "RemoveBlocked",
                category: AuditCategories.Security,
                recordId: bank.Id.ToString(),
                details: new
                {
                    bank.Name,
                    reason = "OpenReconciliationWorkflows",
                    blockingWorkflowCount
                });

            return BadRequest(new
            {
                message = $"Cannot remove {bank.Name} while {blockingWorkflowCount} open reconciliation workflow(s) still reference it. Finalize or resolve those statements first."
            });
        }

        bank.IsActive = false;
        bank.RemovedAtUtc = DateTime.UtcNow;
        bank.RemovedBy = GetCurrentUser();

        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: nameof(BankDirectoryEntry),
            action: "Removed",
            category: AuditCategories.System,
            recordId: bank.Id.ToString(),
            details: new
            {
                bank.Name,
                bank.RemovedAtUtc,
                bank.RemovedBy
            });

        return Ok(new { message = "Bank removed successfully." });
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> RestoreBank(Guid id)
    {
        var bank = await _db.BankDirectoryEntries.FirstOrDefaultAsync(x => x.Id == id);
        if (bank is null)
            return NotFound(new { message = "Bank not found." });

        if (bank.IsActive)
            return BadRequest(new { message = "Bank is already active." });

        bank.IsActive = true;
        bank.ListedAtUtc = DateTime.UtcNow;
        bank.ListedBy = GetCurrentUser();
        bank.RemovedAtUtc = null;
        bank.RemovedBy = null;

        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: nameof(BankDirectoryEntry),
            action: "Restored",
            category: AuditCategories.System,
            recordId: bank.Id.ToString(),
            details: new
            {
                bank.Name,
                bank.ListedAtUtc,
                bank.ListedBy
            });

        return Ok(new { message = "Bank restored successfully." });
    }

    private static bool IsRegexPatternValid(string pattern)
    {
        try
        {
            _ = new Regex(pattern);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private string GetCurrentUser()
    {
        return User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? "system";
    }
}

public record CreateBankRequest
{
    public string Name { get; init; } = string.Empty;
    public string Country { get; init; } = "Philippines";
    public string? BranchName { get; init; }
    public string AccountNumberPattern { get; init; } = string.Empty;
    public string AccountNumberSample { get; init; } = string.Empty;
}

public record UpdateBankRequest
{
    public string Name { get; init; } = string.Empty;
    public string Country { get; init; } = "Philippines";
    public string? BranchName { get; init; }
    public string AccountNumberPattern { get; init; } = string.Empty;
    public string AccountNumberSample { get; init; } = string.Empty;
}
