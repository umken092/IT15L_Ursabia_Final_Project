using CMNetwork.Application.Services;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerExpenseClaimService : ICustomerExpenseClaimService
{
    private readonly CMNetworkDbContext _db;

    public CustomerExpenseClaimService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<List<CustomerExpenseClaimDto>> GetMyExpenseClaimsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var claims = await _db.ExpenseClaims
            .AsNoTracking()
            .Where(c => c.EmployeeId == customerId)
            .OrderByDescending(c => c.SubmittedAtUtc)
            .Select(c => new CustomerExpenseClaimDto
            {
                Id = c.Id,
                ClaimNumber = c.ClaimNumber,
                Description = c.Description,
                Amount = c.Amount,
                Category = c.Category,
                SubmittedDate = c.SubmittedAtUtc,
                Status = c.Status.ToString(),
                ApprovedDate = c.ReviewedAtUtc,
                RejectReason = c.Status == ExpenseClaimStatus.Rejected ? c.ReviewNotes : null,
                MerchantName = c.MerchantName,
                ProjectCode = c.ProjectCode,
                ReceiptUrl = c.ReceiptUrl
            })
            .ToListAsync(cancellationToken);

        return claims;
    }

    public async Task<Guid> SubmitExpenseClaimAsync(
        Guid customerId,
        SubmitExpenseClaimRequest request,
        CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        if (request.Amount <= 0)
        {
            throw new ArgumentException("Expense amount must be greater than zero.");
        }

        if (request.Amount > 10_000_000)
        {
            throw new ArgumentException("Expense amount exceeds allowed maximum.");
        }

        if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length < 5)
        {
            throw new ArgumentException("Description must be at least 5 characters.");
        }

        if (string.IsNullOrWhiteSpace(request.Category))
        {
            throw new ArgumentException("Category is required.");
        }

        if (request.Description.Length > 1000)
        {
            throw new ArgumentException("Description must not exceed 1000 characters.");
        }

        // Generate claim number
        var claimNumber = $"EC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}";
        claimNumber = claimNumber[..20];

        var claim = new ExpenseClaim
        {
            Id = Guid.NewGuid(),
            ClaimNumber = claimNumber,
            EmployeeId = customerId,
            EmployeeName = customer.Name,
            ClaimDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Category = request.Category,
            Description = request.Description,
            Amount = request.Amount,
            MerchantName = request.MerchantName,
            ProjectCode = request.ProjectCode,
            ReceiptUrl = request.ReceiptUrl,
            Status = ExpenseClaimStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.ExpenseClaims.Add(claim);
        await _db.SaveChangesAsync(cancellationToken);

        return claim.Id;
    }

    public async Task<CustomerExpenseClaimDto> GetExpenseClaimDetailAsync(
        Guid customerId,
        Guid claimId,
        CancellationToken cancellationToken = default)
    {
        var claim = await _db.ExpenseClaims
            .Where(c => c.Id == claimId && c.EmployeeId == customerId)
            .FirstOrDefaultAsync(cancellationToken);

        if (claim == null)
        {
            throw new InvalidOperationException($"Expense claim with ID {claimId} not found for customer {customerId}.");
        }

        return new CustomerExpenseClaimDto
        {
            Id = claim.Id,
            ClaimNumber = claim.ClaimNumber,
            Description = claim.Description,
            Amount = claim.Amount,
            Category = claim.Category,
            SubmittedDate = claim.SubmittedAtUtc,
            Status = claim.Status.ToString(),
            ApprovedDate = claim.ReviewedAtUtc,
            RejectReason = claim.ReviewNotes,
            MerchantName = claim.MerchantName,
            ProjectCode = claim.ProjectCode,
            ReceiptUrl = claim.ReceiptUrl
        };
    }
}
