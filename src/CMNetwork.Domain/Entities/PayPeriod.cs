namespace CMNetwork.Domain.Entities;

public enum PayrollFrequency
{
    Monthly = 1,
    SemiMonthly = 2
}

public enum PayPeriodStatus
{
    Open = 1,
    Closed = 2
}

public class PayPeriod
{
    public Guid Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public PayrollFrequency Frequency { get; set; } = PayrollFrequency.Monthly;
    public DateOnly CutoffDate { get; set; }
    public DateOnly PayDate { get; set; }
    public PayPeriodStatus Status { get; set; } = PayPeriodStatus.Open;
    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public string? LastModifiedByUserId { get; set; }
    public DateTime? LastModifiedUtc { get; set; }
    public bool IsDeleted { get; set; }

    public ICollection<PayrollRun> PayrollRuns { get; set; } = new List<PayrollRun>();
}
