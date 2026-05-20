namespace CMNetwork.Domain.Entities;

public class EmployeeProfile
{
    // Uses AspNetUsers.Id as both PK and FK to enforce one-to-one ownership.
    public Guid UserId { get; set; }

    public string TIN { get; set; } = string.Empty;
    public string SSS { get; set; } = string.Empty;
    public string BankAccount { get; set; } = string.Empty;
    public DateOnly JoinDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public decimal? HourlyRate { get; set; }
    public DateTime? LastLoginUtc { get; set; }
}
