using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CMNetwork.WebApi.Controllers;

[ApiController]
[Route("api/system/loan-configuration")]
public class LoanConfigurationController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;

    public LoanConfigurationController(CMNetworkDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [Authorize(Roles = "accountant,cfo,super-admin,auditor")]
    [HttpGet("tiers")]
    public async Task<IActionResult> GetLoanInterestTiers([FromQuery] bool includeInactive = false)
    {
        var query = _dbContext.LoanInterestTiers.AsNoTracking();
        if (!includeInactive)
            query = query.Where(x => x.IsActive);

        var tiers = await query
            .OrderBy(x => x.TermMonths)
            .Select(x => new
            {
                x.Id,
                x.TermMonths,
                x.AnnualInterestRate,
                x.IsActive,
                x.CreatedAtUtc,
                x.UpdatedAtUtc,
                x.CreatedBy,
                x.UpdatedBy
            })
            .ToListAsync();

        return Ok(tiers);
    }

    [Authorize(Roles = "cfo,super-admin")]
    [HttpPost("tiers")]
    public async Task<IActionResult> CreateLoanInterestTier([FromBody] UpsertLoanInterestTierRequest request)
    {
        if (request.TermMonths <= 0)
            return BadRequest(new { message = "TermMonths must be greater than zero." });

        if (request.AnnualInterestRate < 0)
            return BadRequest(new { message = "AnnualInterestRate cannot be negative." });

        var existing = await _dbContext.LoanInterestTiers.FirstOrDefaultAsync(x => x.TermMonths == request.TermMonths);
        if (existing is not null)
            return BadRequest(new { message = "A tier already exists for this term. Use update instead." });

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "system";

        var tier = new LoanInterestTier
        {
            TermMonths = request.TermMonths,
            AnnualInterestRate = request.AnnualInterestRate,
            IsActive = request.IsActive,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedBy = userId
        };

        _dbContext.LoanInterestTiers.Add(tier);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Loan interest tier created.",
            tierId = tier.Id
        });
    }

    [Authorize(Roles = "cfo,super-admin")]
    [HttpPut("tiers/{tierId:guid}")]
    public async Task<IActionResult> UpdateLoanInterestTier(Guid tierId, [FromBody] UpsertLoanInterestTierRequest request)
    {
        if (request.TermMonths <= 0)
            return BadRequest(new { message = "TermMonths must be greater than zero." });

        if (request.AnnualInterestRate < 0)
            return BadRequest(new { message = "AnnualInterestRate cannot be negative." });

        var tier = await _dbContext.LoanInterestTiers.FirstOrDefaultAsync(x => x.Id == tierId);
        if (tier is null)
            return NotFound(new { message = "Tier not found." });

        var duplicate = await _dbContext.LoanInterestTiers.FirstOrDefaultAsync(x => x.TermMonths == request.TermMonths && x.Id != tierId);
        if (duplicate is not null)
            return BadRequest(new { message = "Another tier already uses this term." });

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "system";

        tier.TermMonths = request.TermMonths;
        tier.AnnualInterestRate = request.AnnualInterestRate;
        tier.IsActive = request.IsActive;
        tier.UpdatedAtUtc = DateTime.UtcNow;
        tier.UpdatedBy = userId;

        _dbContext.LoanInterestTiers.Update(tier);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Loan interest tier updated." });
    }

    [Authorize(Roles = "cfo,super-admin")]
    [HttpDelete("tiers/{tierId:guid}")]
    public async Task<IActionResult> DeleteLoanInterestTier(Guid tierId)
    {
        var tier = await _dbContext.LoanInterestTiers.FirstOrDefaultAsync(x => x.Id == tierId);
        if (tier is null)
            return NotFound(new { message = "Tier not found." });

        _dbContext.LoanInterestTiers.Remove(tier);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Loan interest tier deleted." });
    }
}

public record UpsertLoanInterestTierRequest(int TermMonths, decimal AnnualInterestRate, bool IsActive = true);
