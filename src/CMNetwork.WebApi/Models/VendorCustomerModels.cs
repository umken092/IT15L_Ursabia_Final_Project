using System.ComponentModel.DataAnnotations;

namespace CMNetwork.Models;

public class CreateVendorRequest
{
    [Required]
    [MaxLength(32)]
    public string VendorCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? ContactPerson { get; set; }

    [MaxLength(256)]
    [EmailAddress]
    public string? Email { get; set; }

    [MaxLength(32)]
    public string? PhoneNumber { get; set; }

    [MaxLength(512)]
    public string? Address { get; set; }

    [MaxLength(128)]
    public string? City { get; set; }

    [MaxLength(64)]
    public string? State { get; set; }

    [MaxLength(16)]
    public string? PostalCode { get; set; }

    [MaxLength(128)]
    public string? Country { get; set; }

    [MaxLength(64)]
    public string? TaxId { get; set; }

    [Range(0, 9999999999999999.99)]
    public decimal CreditLimit { get; set; }

    [MaxLength(64)]
    public string? PaymentTerms { get; set; }
}

public class UpdateVendorRequest
{
    [Required]
    [MaxLength(32)]
    public string VendorCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? ContactPerson { get; set; }

    [MaxLength(256)]
    [EmailAddress]
    public string? Email { get; set; }

    [MaxLength(32)]
    public string? PhoneNumber { get; set; }

    [MaxLength(512)]
    public string? Address { get; set; }

    [MaxLength(128)]
    public string? City { get; set; }

    [MaxLength(64)]
    public string? State { get; set; }

    [MaxLength(16)]
    public string? PostalCode { get; set; }

    [MaxLength(128)]
    public string? Country { get; set; }

    [MaxLength(64)]
    public string? TaxId { get; set; }

    [Range(0, 9999999999999999.99)]
    public decimal CreditLimit { get; set; }

    [MaxLength(64)]
    public string? PaymentTerms { get; set; }

    public bool IsActive { get; set; } = true;
}

public class CreateCustomerRequest
{
    [Required]
    [MaxLength(32)]
    public string CustomerCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? ContactPerson { get; set; }

    [MaxLength(256)]
    [EmailAddress]
    public string? Email { get; set; }

    [MaxLength(32)]
    public string? PhoneNumber { get; set; }

    [MaxLength(512)]
    public string? Address { get; set; }

    [MaxLength(128)]
    public string? City { get; set; }

    [MaxLength(64)]
    public string? State { get; set; }

    [MaxLength(16)]
    public string? PostalCode { get; set; }

    [MaxLength(128)]
    public string? Country { get; set; }

    [MaxLength(64)]
    public string? TaxId { get; set; }

    [Range(0, 9999999999999999.99)]
    public decimal CreditLimit { get; set; }

    [MaxLength(64)]
    public string? PaymentTerms { get; set; }
}

public class UpdateCustomerRequest
{
    [Required]
    [MaxLength(32)]
    public string CustomerCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? ContactPerson { get; set; }

    [MaxLength(256)]
    [EmailAddress]
    public string? Email { get; set; }

    [MaxLength(32)]
    public string? PhoneNumber { get; set; }

    [MaxLength(512)]
    public string? Address { get; set; }

    [MaxLength(128)]
    public string? City { get; set; }

    [MaxLength(64)]
    public string? State { get; set; }

    [MaxLength(16)]
    public string? PostalCode { get; set; }

    [MaxLength(128)]
    public string? Country { get; set; }

    [MaxLength(64)]
    public string? TaxId { get; set; }

    [Range(0, 9999999999999999.99)]
    public decimal CreditLimit { get; set; }

    [MaxLength(64)]
    public string? PaymentTerms { get; set; }

    public bool IsActive { get; set; } = true;
}
