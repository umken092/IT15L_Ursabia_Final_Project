namespace CMNetwork.Domain.Entities;

public enum ARInvoiceStatus
{
    Draft = 1,
    Sent = 2,
    Approved = 3,
    Paid = 4,
    Void = 5
}

public class ARInvoice
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; }
    public DateTime DueDate { get; set; }
    public decimal TotalAmount { get; set; }
    public ARInvoiceStatus Status { get; set; } = ARInvoiceStatus.Draft;
    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public string? LastModifiedByUserId { get; set; }
    public DateTime? LastModifiedUtc { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedUtc { get; set; }

    // Navigation properties
    public Customer Customer { get; set; } = null!;
    public ICollection<ARInvoiceLine> Lines { get; set; } = new List<ARInvoiceLine>();
}

public class ARInvoiceLine
{
    public Guid Id { get; set; }
    public Guid ARInvoiceId { get; set; }
    public Guid ChartOfAccountId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public decimal? TaxAmount { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ARInvoice ARInvoice { get; set; } = null!;
    public ChartOfAccount Account { get; set; } = null!;
}
