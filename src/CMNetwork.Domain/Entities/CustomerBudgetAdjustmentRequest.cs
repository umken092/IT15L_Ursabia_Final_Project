namespace CMNetwork.Domain.Entities;

public enum BudgetAdjustmentStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public class CustomerBudgetAdjustmentRequest
{
    public Guid Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid BudgetId { get; set; }
    public string BudgetName { get; set; } = string.Empty;
    public decimal RequestedAmount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public BudgetAdjustmentStatus Status { get; set; } = BudgetAdjustmentStatus.Pending;
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public string? DecisionNotes { get; set; }
}
