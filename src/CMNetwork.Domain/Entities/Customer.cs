namespace CMNetwork.Domain.Entities;

public enum BankVerificationStatus
{
    NotVerified = 0,
    Pending = 1,
    Verified = 2
}

public class Customer
{
    public Guid Id { get; set; }
    public string CustomerCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; }
    public string? TaxId { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal CreditLimit { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastUpdatedUtc { get; set; }

    // OTP for registration verification
    public string? RegistrationOtp { get; set; }
    public DateTime? RegistrationOtpGeneratedUtc { get; set; }
    public bool RegistrationOtpVerified { get; set; } = false;

    // Profile completion fields
    public string? TIN { get; set; }
    public string? SSS { get; set; }
    public string? BankAccount { get; set; }
    public string? BankName { get; set; }
    public BankVerificationStatus BankVerificationStatus { get; set; } = BankVerificationStatus.NotVerified;
    public DateTime? BankVerifiedAtUtc { get; set; }
}
