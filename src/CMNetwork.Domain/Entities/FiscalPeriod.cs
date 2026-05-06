namespace CMNetwork.Domain.Entities;

public class FiscalPeriod
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool IsClosed { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}