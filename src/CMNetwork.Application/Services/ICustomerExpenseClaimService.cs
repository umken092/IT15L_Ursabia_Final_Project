namespace CMNetwork.Application.Services;

public interface ICustomerExpenseClaimService
{
    /// <summary>
    /// Get all expense claims for the customer
    /// </summary>
    Task<List<CustomerExpenseClaimDto>> GetMyExpenseClaimsAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Submit a new expense claim
    /// </summary>
    Task<Guid> SubmitExpenseClaimAsync(Guid customerId, SubmitExpenseClaimRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get details of a specific expense claim
    /// </summary>
    Task<CustomerExpenseClaimDto> GetExpenseClaimDetailAsync(Guid customerId, Guid claimId, CancellationToken cancellationToken = default);
}

public class CustomerExpenseClaimDto
{
    public Guid Id { get; set; }
    public string ClaimNumber { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public DateTime SubmittedDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? ApprovedDate { get; set; }
    public string? RejectReason { get; set; }
    public string? MerchantName { get; set; }
    public string? ProjectCode { get; set; }
    public string? ReceiptUrl { get; set; }
}

public class SubmitExpenseClaimRequest
{
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? MerchantName { get; set; }
    public string? ProjectCode { get; set; }
    public string? ReceiptUrl { get; set; }
}
