namespace CMNetwork.Domain.Entities;

public enum JournalEntryStatus
{
    Draft = 1,
    Posted = 2
}

public class JournalEntry
{
    public Guid Id { get; set; }
    public string EntryNumber { get; set; } = string.Empty;
    public DateOnly EntryDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceNo { get; set; }
    public JournalEntryStatus Status { get; set; } = JournalEntryStatus.Draft;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public string? PostedBy { get; set; }
    public DateTime? PostedUtc { get; set; }

    public ICollection<JournalEntryLine> Lines { get; set; } = new List<JournalEntryLine>();
}