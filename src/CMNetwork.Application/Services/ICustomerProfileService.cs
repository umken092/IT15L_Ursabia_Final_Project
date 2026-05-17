namespace CMNetwork.Application.Services;

public interface ICustomerProfileService
{
    /// <summary>
    /// Get current customer's profile
    /// </summary>
    Task<CustomerProfileDto> GetMyProfileAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update current customer's profile
    /// </summary>
    Task<CustomerProfileDto> UpdateMyProfileAsync(Guid customerId, UpdateCustomerProfileRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Change password for current customer
    /// </summary>
    Task ChangePasswordAsync(Guid customerId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
}

public class CustomerProfileDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? CompanyName { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
}

public class UpdateCustomerProfileRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? CompanyName { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
}

public class ChangePasswordRequest
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
