namespace CMNetwork.Application.Services;

public interface ICustomerApprovalService
{
    /// <summary>
    /// Get all pending approvals for the customer
    /// </summary>
    Task<List<CustomerApprovalDto>> GetPendingApprovalsAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all approved requests for the customer
    /// </summary>
    Task<List<CustomerApprovalDto>> GetApprovedRequestsAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get approval details
    /// </summary>
    Task<CustomerApprovalDetailDto> GetApprovalDetailAsync(Guid customerId, Guid approvalId, CancellationToken cancellationToken = default);
}

public class CustomerApprovalDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime SubmittedDate { get; set; }
    public DateTime? ApprovedDate { get; set; }
}

public class CustomerApprovalDetailDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime SubmittedDate { get; set; }
    public DateTime? ApprovedDate { get; set; }
    public string? ApprovedByName { get; set; }
    public string? ApprovalNotes { get; set; }
    public decimal? Amount { get; set; }
}
