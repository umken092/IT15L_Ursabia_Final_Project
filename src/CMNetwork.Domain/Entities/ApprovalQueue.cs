namespace CMNetwork.Domain.Entities;

public enum ApprovalItemStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public class ApprovalQueue
{
    public Guid Id { get; set; }
    public string EntityType { get; set; } = string.Empty;  // "ExpenseClaim" | "APInvoice" | etc.
    public Guid EntityId { get; set; }
    public string EntityDescription { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string RequestedByUserId { get; set; } = string.Empty;
    public string RequestedByName { get; set; } = string.Empty;
    public string RequiredApproverRole { get; set; } = string.Empty;
    public ApprovalItemStatus Status { get; set; } = ApprovalItemStatus.Pending;
    public string? ProcessedByUserId { get; set; }
    public string? ProcessedByName { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAtUtc { get; set; }
}
