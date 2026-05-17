namespace CMNetwork.Domain.Entities;

/// <summary>
/// Loan application submitted by a customer.
/// Customer applies → Accountant reviews → CFO approves/rejects → Accountant disburses (or auto-disburses on approval).
/// </summary>
public class CustomerLoanApplication
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    /// <summary>Principal amount requested in PHP.</summary>
    public decimal RequestedAmount { get; set; }

    /// <summary>Annual interest rate (e.g., 5.5 for 5.5%).</summary>
    public decimal InterestRate { get; set; }

    /// <summary>Loan term in months.</summary>
    public int TermMonths { get; set; }

    /// <summary>Purpose of the loan (e.g., "Business expansion", "Working capital").</summary>
    public string Purpose { get; set; } = string.Empty;

    /// <summary>Application status: Submitted, Approved, Rejected, Withdrawn.</summary>
    public LoanApplicationStatus Status { get; set; } = LoanApplicationStatus.Submitted;

    /// <summary>Accountant notes after review.</summary>
    public string? AccountantReviewNotes { get; set; }

    /// <summary>CFO approval/rejection notes.</summary>
    public string? CfoNotes { get; set; }

    /// <summary>Date and time when the application was submitted.</summary>
    public DateTime SubmittedAtUtc { get; set; }

    /// <summary>Date and time when accountant completed review.</summary>
    public DateTime? ReviewedAtUtc { get; set; }

    /// <summary>Date and time when CFO approved/rejected the application.</summary>
    public DateTime? ApprovedOrRejectedAtUtc { get; set; }

    /// <summary>ID of the accountant who reviewed.</summary>
    public string? ReviewedByUserId { get; set; }

    /// <summary>ID of the CFO who approved/rejected.</summary>
    public string? ApprovedOrRejectedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

public enum LoanApplicationStatus
{
    Submitted = 0,   // Initial state - waiting for accountant review
    Approved = 1,    // CFO approved - ready for disbursement
    Rejected = 2,    // CFO rejected
    Withdrawn = 3    // Customer or admin withdrew before approval
}
