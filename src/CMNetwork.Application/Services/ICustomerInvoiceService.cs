namespace CMNetwork.Application.Services;

public interface ICustomerInvoiceService
{
    /// <summary>
    /// Get all invoices for the customer
    /// </summary>
    Task<CustomerInvoicesResponseDto> GetMyInvoicesAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a specific invoice by ID
    /// </summary>
    Task<CustomerInvoiceDetailDto> GetInvoiceDetailAsync(Guid customerId, Guid invoiceId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get payment records for the customer
    /// </summary>
    Task<List<CustomerPaymentRecordDto>> GetPaymentRecordsAsync(Guid customerId, CancellationToken cancellationToken = default);
}

public class CustomerInvoiceDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; }
    public DateTime DueDate { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class CustomerInvoicesResponseDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public List<CustomerInvoiceDto> Invoices { get; set; } = new();
}

public class CustomerInvoiceDetailDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; }
    public DateTime DueDate { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<InvoiceLineItemDto> LineItems { get; set; } = new();
}

public class InvoiceLineItemDto
{
    public Guid Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public decimal? TaxAmount { get; set; }
}

public class CustomerPaymentRecordDto
{
    public Guid Id { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PayMongoCheckoutSessionId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string InvoiceIds { get; set; } = string.Empty;
}
