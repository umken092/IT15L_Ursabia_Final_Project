namespace CMNetwork.Domain.Entities;

public enum APInvoiceStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Paid = 4,
    Void = 5
}

public class APInvoice
{
    public Guid Id { get; set; }
    public Guid VendorId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; }
    public DateTime DueDate { get; set; }
    public decimal TotalAmount { get; set; }
    public APInvoiceStatus Status { get; set; } = APInvoiceStatus.Draft;
    public Guid? PurchaseOrderId { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public string? LastModifiedByUserId { get; set; }
    public DateTime? LastModifiedUtc { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedUtc { get; set; }

    // Navigation properties
    public Vendor Vendor { get; set; } = null!;
    public ICollection<APInvoiceLine> Lines { get; set; } = new List<APInvoiceLine>();
}

public class APInvoiceLine
{
    public Guid Id { get; set; }
    public Guid APInvoiceId { get; set; }
    public Guid ChartOfAccountId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public decimal? TaxAmount { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public APInvoice APInvoice { get; set; } = null!;
    public ChartOfAccount Account { get; set; } = null!;
}
