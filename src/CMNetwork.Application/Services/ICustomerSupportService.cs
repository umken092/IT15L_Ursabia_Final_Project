namespace CMNetwork.Application.Services;

public interface ICustomerSupportService
{
    /// <summary>
    /// Get all support tickets for the customer
    /// </summary>
    Task<List<CustomerSupportTicketDto>> GetMyTicketsAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Create a new support ticket
    /// </summary>
    Task<Guid> CreateTicketAsync(Guid customerId, CreateSupportTicketRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get ticket details
    /// </summary>
    Task<CustomerSupportTicketDetailDto> GetTicketDetailAsync(Guid customerId, Guid ticketId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all FAQs
    /// </summary>
    Task<List<FaqDto>> GetFAQsAsync(CancellationToken cancellationToken = default);
}

public class CustomerSupportTicketDto
{
    public Guid Id { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public DateTime? ResolvedDate { get; set; }
}

public class CustomerSupportTicketDetailDto
{
    public Guid Id { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public DateTime? ResolvedDate { get; set; }
    public DateTime? ClosedDate { get; set; }
    public string? AssignedToName { get; set; }
    public string? ResolutionNotes { get; set; }
}

public class CreateSupportTicketRequest
{
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Priority { get; set; } = "Medium";
}

public class FaqDto
{
    public Guid Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}
