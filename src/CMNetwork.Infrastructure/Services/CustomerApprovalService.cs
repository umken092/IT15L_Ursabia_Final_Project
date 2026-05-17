using CMNetwork.Application.Services;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerApprovalService : ICustomerApprovalService
{
    private readonly CMNetworkDbContext _db;

    public CustomerApprovalService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<List<CustomerApprovalDto>> GetPendingApprovalsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var approvals = new List<CustomerApprovalDto>();

        // Get pending budget adjustment requests
        var budgetRequests = await _db.CustomerBudgetAdjustmentRequests
            .Where(r => r.CustomerId == customerId && r.Status.ToString() == "Pending")
            .Select(r => new CustomerApprovalDto
            {
                Id = r.Id,
                Title = $"Budget Adjustment Request: {r.BudgetName}",
                Description = r.Reason,
                Type = "Budget Adjustment",
                Status = r.Status.ToString(),
                SubmittedDate = r.RequestedAtUtc,
                ApprovedDate = r.ApprovedAtUtc
            })
            .ToListAsync(cancellationToken);

        approvals.AddRange(budgetRequests);

        return approvals.OrderByDescending(a => a.SubmittedDate).ToList();
    }

    public async Task<List<CustomerApprovalDto>> GetApprovedRequestsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var approvals = new List<CustomerApprovalDto>();

        // Get approved budget adjustment requests
        var budgetRequests = await _db.CustomerBudgetAdjustmentRequests
            .Where(r => r.CustomerId == customerId && r.Status.ToString() == "Approved")
            .Select(r => new CustomerApprovalDto
            {
                Id = r.Id,
                Title = $"Budget Adjustment Request: {r.BudgetName}",
                Description = r.Reason,
                Type = "Budget Adjustment",
                Status = r.Status.ToString(),
                SubmittedDate = r.RequestedAtUtc,
                ApprovedDate = r.ApprovedAtUtc
            })
            .ToListAsync(cancellationToken);

        approvals.AddRange(budgetRequests);

        return approvals.OrderByDescending(a => a.ApprovedDate).ToList();
    }

    public async Task<CustomerApprovalDetailDto> GetApprovalDetailAsync(Guid customerId, Guid approvalId, CancellationToken cancellationToken = default)
    {
        // Try to find in budget adjustment requests
        var budgetRequest = await _db.CustomerBudgetAdjustmentRequests
            .Where(r => r.Id == approvalId && r.CustomerId == customerId)
            .FirstOrDefaultAsync(cancellationToken);

        if (budgetRequest != null)
        {
            return new CustomerApprovalDetailDto
            {
                Id = budgetRequest.Id,
                Title = $"Budget Adjustment Request: {budgetRequest.BudgetName}",
                Description = budgetRequest.Reason,
                Type = "Budget Adjustment",
                Status = budgetRequest.Status.ToString(),
                SubmittedDate = budgetRequest.RequestedAtUtc,
                ApprovedDate = budgetRequest.ApprovedAtUtc,
                ApprovedByName = budgetRequest.ApprovedByName,
                ApprovalNotes = budgetRequest.DecisionNotes,
                Amount = budgetRequest.RequestedAmount
            };
        }

        throw new InvalidOperationException($"Approval with ID {approvalId} not found for customer {customerId}.");
    }
}
