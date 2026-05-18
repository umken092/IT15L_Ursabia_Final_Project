namespace CMNetwork.Domain.Entities;

/// <summary>
/// Policy table that maps loan term months to annual interest rate.
/// Managed by CFO/SuperAdmin via System Settings.
/// </summary>
public class LoanInterestTier
{
    public Guid Id { get; set; }

    /// <summary>Loan term in months (for example 3, 6, 12).</summary>
    public int TermMonths { get; set; }

    /// <summary>Annual percentage rate in percent units (for example 7.5 means 7.5%).</summary>
    public decimal AnnualInterestRate { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
}
