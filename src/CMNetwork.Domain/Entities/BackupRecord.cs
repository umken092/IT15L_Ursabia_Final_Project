namespace CMNetwork.Domain.Entities;

public class BackupRecord
{
    public Guid Id { get; set; }
    public DateTime StartedUtc { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal SizeInMb { get; set; }
    public int DurationSeconds { get; set; }
}
