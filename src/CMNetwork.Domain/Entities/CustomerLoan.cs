namespace CMNetwork.Domain.Entities;

/// <summary>
/// Active or historical loan issued to a customer.
/// Created after application is approved and disbursed.
/// Tracks principal, payments, schedule, and status.
/// </summary>
public class CustomerLoan
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    /// <summary>Link to the approved application that resulted in this loan.</summary>
    public Guid LoanApplicationId { get; set; }
    public CustomerLoanApplication? LoanApplication { get; set; }

    /// <summary>Original principal amount disbursed in PHP.</summary>
    public decimal PrincipalAmount { get; set; }

    /// <summary>Annual interest rate (e.g., 5.5 for 5.5%).</summary>
    public decimal InterestRate { get; set; }

    /// <summary>Loan term in months.</summary>
    public int TermMonths { get; set; }

    /// <summary>Outstanding principal remaining.</summary>
    public decimal OutstandingPrincipal { get; set; }

    /// <summary>Total interest accrued to date.</summary>
    public decimal TotalInterestAccrued { get; set; }

    /// <summary>Loan status: Active, Fully Paid, Overdue, Restructured, Written Off.</summary>
    public LoanStatus Status { get; set; } = LoanStatus.Active;

    /// <summary>Date loan was disbursed.</summary>
    public DateTime DisbursedAtUtc { get; set; }

    /// <summary>Date loan is/was fully repaid (if applicable).</summary>
    public DateTime? FullyPaidAtUtc { get; set; }

    /// <summary>Date of the first missed payment (if overdue).</summary>
    public DateTime? OverdueSinceUtc { get; set; }

    /// <summary>Notes on restructuring, write-off, or other status changes.</summary>
    public string? StatusNotes { get; set; }

    /// <summary>User ID of accountant who processed disbursement.</summary>
    public string? DisbursedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    // Navigation
    public ICollection<CustomerLoanPayment> Payments { get; set; } = new List<CustomerLoanPayment>();
}

public enum LoanStatus
{
    Active = 0,         // Ongoing loan with repayments due
    FullyPaid = 1,      // All principal + interest repaid
    Overdue = 2,        // One or more payments past due
    Restructured = 3,   // Terms changed (extended, reduced rate, etc.)
    WrittenOff = 4      // Deemed uncollectible by SuperAdmin
}
