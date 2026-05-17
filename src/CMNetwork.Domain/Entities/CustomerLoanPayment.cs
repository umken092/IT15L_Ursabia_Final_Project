namespace CMNetwork.Domain.Entities;

/// <summary>
/// A single loan payment made by a customer towards an active loan.
/// Can be via portal (PayMongo), manual bank transfer recorded by accountant, or system-scheduled.
/// </summary>
public class CustomerLoanPayment
{
    public Guid Id { get; set; }
    public Guid LoanId { get; set; }
    public CustomerLoan? Loan { get; set; }

    /// <summary>Principal portion of this payment in PHP.</summary>
    public decimal PrincipalAmount { get; set; }

    /// <summary>Interest portion of this payment in PHP.</summary>
    public decimal InterestAmount { get; set; }

    /// <summary>Total amount paid (principal + interest).</summary>
    public decimal TotalAmount { get; set; }

    /// <summary>Payment method: Portal (PayMongo), BankTransfer, SystemGenerated, Other.</summary>
    public string PaymentMethod { get; set; } = "Portal";

    /// <summary>Reference ID if paid via PayMongo checkout session.</summary>
    public string? PayMongoCheckoutSessionId { get; set; }

    /// <summary>Bank transfer reference or other external reference.</summary>
    public string? ExternalReference { get; set; }

    /// <summary>Status: Scheduled, Completed, Overdue, Waived.</summary>
    public LoanPaymentStatus Status { get; set; } = LoanPaymentStatus.Scheduled;

    /// <summary>When the payment was scheduled/due.</summary>
    public DateTime DueAtUtc { get; set; }

    /// <summary>When the payment was actually completed.</summary>
    public DateTime? CompletedAtUtc { get; set; }

    /// <summary>User ID who recorded/processed the payment (for manual entries).</summary>
    public string? ProcessedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

public enum LoanPaymentStatus
{
    Scheduled = 0,      // Due in the future
    Completed = 1,      // Paid on time
    Overdue = 2,        // Payment is past due
    Waived = 3          // Forgiven by SuperAdmin
}
