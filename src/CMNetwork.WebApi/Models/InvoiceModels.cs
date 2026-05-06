using System.ComponentModel.DataAnnotations;

namespace CMNetwork.Models;

// AP Invoice DTOs
public class CreateAPInvoiceRequest
{
    [Required]
    public Guid VendorId { get; set; }

    [Required]
    [MaxLength(64)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Required]
    public DateTime InvoiceDate { get; set; }

    [Required]
    public DateTime DueDate { get; set; }

    [Required]
    public List<CreateAPInvoiceLineRequest> Lines { get; set; } = new();
}

public class CreateAPInvoiceLineRequest
{
    [Required]
    public Guid ChartOfAccountId { get; set; }

    [MaxLength(512)]
    public string Description { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Quantity { get; set; }

    [Range(0, double.MaxValue)]
    public decimal UnitPrice { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Amount { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? TaxAmount { get; set; }
}

public class UpdateAPInvoiceRequest
{
    [Required]
    public DateTime InvoiceDate { get; set; }

    [Required]
    public DateTime DueDate { get; set; }

    public List<CreateAPInvoiceLineRequest>? Lines { get; set; }
}

// AR Invoice DTOs
public class CreateARInvoiceRequest
{
    [Required]
    public Guid CustomerId { get; set; }

    [Required]
    [MaxLength(64)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Required]
    public DateTime InvoiceDate { get; set; }

    [Required]
    public DateTime DueDate { get; set; }

    [Required]
    public List<CreateARInvoiceLineRequest> Lines { get; set; } = new();
}

public class CreateARInvoiceLineRequest
{
    [Required]
    public Guid ChartOfAccountId { get; set; }

    [MaxLength(512)]
    public string Description { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Quantity { get; set; }

    [Range(0, double.MaxValue)]
    public decimal UnitPrice { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Amount { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? TaxAmount { get; set; }
}

public class UpdateARInvoiceRequest
{
    [Required]
    public DateTime InvoiceDate { get; set; }

    [Required]
    public DateTime DueDate { get; set; }

    public List<CreateARInvoiceLineRequest>? Lines { get; set; }
}
