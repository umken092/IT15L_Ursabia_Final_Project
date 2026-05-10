namespace CMNetwork.Domain.Entities;

public class BankDirectoryEntry
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Country { get; set; } = "Philippines";
    public string? BranchName { get; set; }
    public string AccountNumberPattern { get; set; } = string.Empty;
    public string AccountNumberSample { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime ListedAtUtc { get; set; } = DateTime.UtcNow;
    public string ListedBy { get; set; } = "system";
    public DateTime? RemovedAtUtc { get; set; }
    public string? RemovedBy { get; set; }
}
