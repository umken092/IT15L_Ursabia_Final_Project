namespace CMNetwork.Domain.Entities;

public enum BankReconciliationStatus
{
    Open = 1,
    Finalized = 2
}

public class BankStatement
{
    public Guid Id { get; set; }
    public string BankAccountName { get; set; } = string.Empty;
    public string? BankAccountNumber { get; set; }
    public DateOnly StatementDate { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal ClosingBalance { get; set; }
    public Guid? FiscalPeriodId { get; set; }
    public string ImportedBy { get; set; } = string.Empty;
    public DateTime ImportedAtUtc { get; set; } = DateTime.UtcNow;

    public FiscalPeriod? FiscalPeriod { get; set; }
    public ICollection<BankTransaction> Transactions { get; set; } = new List<BankTransaction>();
    public BankReconciliation? Reconciliation { get; set; }
}

public class BankTransaction
{
    public Guid Id { get; set; }
    public Guid BankStatementId { get; set; }
    public DateOnly TransactionDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public decimal Amount { get; set; }
    public bool IsDebit { get; set; }
    public bool IsMatched { get; set; }
    public Guid? MatchedJournalEntryLineId { get; set; }
    public string? MatchedBy { get; set; }
    public DateTime? MatchedAtUtc { get; set; }

    public BankStatement? BankStatement { get; set; }
    public JournalEntryLine? MatchedJournalEntryLine { get; set; }
}

public class BankReconciliation
{
    public Guid Id { get; set; }
    public Guid BankStatementId { get; set; }
    public string BankAccountName { get; set; } = string.Empty;
    public BankReconciliationStatus Status { get; set; } = BankReconciliationStatus.Open;
    public decimal? Difference { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? FinalizedBy { get; set; }
    public DateTime? FinalizedAtUtc { get; set; }

    public BankStatement? BankStatement { get; set; }
}
