namespace CMNetwork.Domain.Entities;

public class JournalEntryLine
{
    public Guid Id { get; set; }
    public Guid JournalEntryId { get; set; }
    public Guid AccountId { get; set; }
    public string? Description { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }

    public JournalEntry? JournalEntry { get; set; }
    public ChartOfAccount? Account { get; set; }
}