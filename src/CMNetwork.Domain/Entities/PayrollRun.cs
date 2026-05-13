namespace CMNetwork.Domain.Entities;

public enum PayrollRunStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Processed = 5,
    Posted = 6
}

public class PayrollRun
{
    public Guid Id { get; set; }
    public Guid PayPeriodId { get; set; }
    public PayrollRunStatus Status { get; set; } = PayrollRunStatus.Draft;
    public DateTime? SubmittedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? RejectionReason { get; set; }
    public decimal TotalGrossPay { get; set; }
    public decimal TotalNetPay { get; set; }
    public decimal TotalDeductions { get; set; }
    public Guid? JournalEntryId { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public string? LastModifiedByUserId { get; set; }
    public DateTime? LastModifiedUtc { get; set; }
    public bool IsDeleted { get; set; }

    public PayPeriod PayPeriod { get; set; } = null!;
    public JournalEntry? JournalEntry { get; set; }
    public ICollection<PayrollLineItem> LineItems { get; set; } = new List<PayrollLineItem>();
}
