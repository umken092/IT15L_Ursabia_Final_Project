namespace CMNetwork.Domain.Entities;

public enum BudgetReallocationStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public class BudgetReallocationRequest
{
    public Guid Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    public Guid SourceDepartmentId { get; set; }
    public Guid TargetDepartmentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Justification { get; set; } = string.Empty;
    public BudgetReallocationStatus Status { get; set; } = BudgetReallocationStatus.Pending;
    public DateTime EffectiveDate { get; set; } = DateTime.UtcNow.Date;
    public string RequestedByUserId { get; set; } = string.Empty;
    public string RequestedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? ProcessedByName { get; set; }
    public DateTime? ProcessedAtUtc { get; set; }
    public string? DecisionNotes { get; set; }
}
