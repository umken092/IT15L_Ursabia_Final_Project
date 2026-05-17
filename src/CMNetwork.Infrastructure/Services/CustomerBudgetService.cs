using CMNetwork.Application.Services;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerBudgetService : ICustomerBudgetService
{
    private readonly CMNetworkDbContext _db;

    public CustomerBudgetService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<List<CustomerBudgetDto>> GetMyBudgetsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .AsNoTracking()
            .Where(c => c.Id == customerId && c.IsActive)
            .Select(c => new { c.Id, c.Name, c.CreditLimit })
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        var spentAmount = await _db.ARInvoices
            .AsNoTracking()
            .Where(inv => inv.CustomerId == customerId && !inv.IsDeleted && inv.Status != ARInvoiceStatus.Void)
            .SumAsync(inv => (decimal?)inv.TotalAmount, cancellationToken) ?? 0m;

        var now = DateTime.UtcNow;
        return
        [
            new CustomerBudgetDto
            {
                Id = customer.Id,
                Name = $"{customer.Name} Credit Budget",
                AllocatedAmount = customer.CreditLimit,
                SpentAmount = spentAmount,
                StartDate = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1).AddDays(-1),
                Status = spentAmount <= customer.CreditLimit ? "OnTrack" : "Exceeded"
            }
        ];
    }

    public async Task<Guid> RequestBudgetAdjustmentAsync(
        Guid customerId,
        RequestBudgetAdjustmentRequest request,
        CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        if (request.RequestedAmount <= 0)
        {
            throw new ArgumentException("Requested amount must be greater than zero.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 10)
        {
            throw new ArgumentException("Reason must be at least 10 characters.");
        }

        if (request.Reason.Length > 1024)
        {
            throw new ArgumentException("Reason must not exceed 1024 characters.");
        }

        var hasPendingRequest = await _db.CustomerBudgetAdjustmentRequests
            .AnyAsync(r => r.CustomerId == customerId
                && r.BudgetId == request.BudgetId
                && r.Status == BudgetAdjustmentStatus.Pending,
                cancellationToken);

        if (hasPendingRequest)
        {
            throw new InvalidOperationException("A pending budget adjustment request already exists for this budget.");
        }

        // Generate request number
        var requestNumber = $"BAR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid():N}";
        requestNumber = requestNumber[..21];

        var adjustmentRequest = new CustomerBudgetAdjustmentRequest
        {
            Id = Guid.NewGuid(),
            RequestNumber = requestNumber,
            CustomerId = customerId,
            BudgetId = request.BudgetId,
            BudgetName = request.BudgetId.ToString(), // Will be populated with actual budget name
            RequestedAmount = request.RequestedAmount,
            Reason = request.Reason,
            Status = BudgetAdjustmentStatus.Pending,
            RequestedAtUtc = DateTime.UtcNow
        };

        _db.CustomerBudgetAdjustmentRequests.Add(adjustmentRequest);
        await _db.SaveChangesAsync(cancellationToken);

        return adjustmentRequest.Id;
    }

    public async Task<List<BudgetAdjustmentRequestDto>> GetBudgetAdjustmentRequestsAsync(
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        var requests = await _db.CustomerBudgetAdjustmentRequests
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.RequestedAtUtc)
            .Select(r => new BudgetAdjustmentRequestDto
            {
                Id = r.Id,
                RequestNumber = r.RequestNumber,
                BudgetName = r.BudgetName,
                RequestedAmount = r.RequestedAmount,
                Reason = r.Reason,
                Status = r.Status.ToString(),
                RequestedAtUtc = r.RequestedAtUtc,
                ApprovedAtUtc = r.ApprovedAtUtc,
                DecisionNotes = r.DecisionNotes
            })
            .ToListAsync(cancellationToken);

        return requests;
    }
}
