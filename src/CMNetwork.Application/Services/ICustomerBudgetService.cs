namespace CMNetwork.Application.Services;

public interface ICustomerBudgetService
{
    /// <summary>
    /// Get all budgets for the customer
    /// </summary>
    Task<List<CustomerBudgetDto>> GetMyBudgetsAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Request a budget adjustment for the customer
    /// </summary>
    Task<Guid> RequestBudgetAdjustmentAsync(Guid customerId, RequestBudgetAdjustmentRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get budget adjustment requests for the customer
    /// </summary>
    Task<List<BudgetAdjustmentRequestDto>> GetBudgetAdjustmentRequestsAsync(Guid customerId, CancellationToken cancellationToken = default);
}

public class CustomerBudgetDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal AllocatedAmount { get; set; }
    public decimal SpentAmount { get; set; }
    public decimal RemainingAmount => AllocatedAmount - SpentAmount;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class RequestBudgetAdjustmentRequest
{
    public Guid BudgetId { get; set; }
    public decimal RequestedAmount { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class BudgetAdjustmentRequestDto
{
    public Guid Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    public string BudgetName { get; set; } = string.Empty;
    public decimal RequestedAmount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? DecisionNotes { get; set; }
}
