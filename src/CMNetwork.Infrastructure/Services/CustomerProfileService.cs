using CMNetwork.Application.Services;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerProfileService : ICustomerProfileService
{
    private readonly CMNetworkDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public CustomerProfileService(CMNetworkDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<CustomerProfileDto> GetMyProfileAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        return new CustomerProfileDto
        {
            Id = customer.Id,
            FirstName = customer.ContactPerson ?? string.Empty,
            LastName = customer.Name,
            Email = customer.Email ?? string.Empty,
            PhoneNumber = customer.PhoneNumber,
            CompanyName = customer.Name,
            Address = customer.Address,
            City = customer.City,
            State = customer.State,
            Country = customer.Country,
            PostalCode = customer.PostalCode
        };
    }

    public async Task<CustomerProfileDto> UpdateMyProfileAsync(
        Guid customerId,
        UpdateCustomerProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        // Update customer profile fields
        if (!string.IsNullOrWhiteSpace(request.FirstName))
        {
            customer.ContactPerson = request.FirstName;
        }

        if (!string.IsNullOrWhiteSpace(request.LastName))
        {
            customer.Name = request.LastName;
        }

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            customer.PhoneNumber = request.PhoneNumber;
        }

        if (!string.IsNullOrWhiteSpace(request.Address))
        {
            customer.Address = request.Address;
        }

        if (!string.IsNullOrWhiteSpace(request.City))
        {
            customer.City = request.City;
        }

        if (!string.IsNullOrWhiteSpace(request.State))
        {
            customer.State = request.State;
        }

        if (!string.IsNullOrWhiteSpace(request.Country))
        {
            customer.Country = request.Country;
        }

        if (!string.IsNullOrWhiteSpace(request.PostalCode))
        {
            customer.PostalCode = request.PostalCode;
        }

        customer.LastUpdatedUtc = DateTime.UtcNow;

        _db.Customers.Update(customer);
        await _db.SaveChangesAsync(cancellationToken);

        return new CustomerProfileDto
        {
            Id = customer.Id,
            FirstName = customer.ContactPerson ?? string.Empty,
            LastName = customer.Name,
            Email = customer.Email ?? string.Empty,
            PhoneNumber = customer.PhoneNumber,
            CompanyName = customer.Name,
            Address = customer.Address,
            City = customer.City,
            State = customer.State,
            Country = customer.Country,
            PostalCode = customer.PostalCode
        };
    }

    public async Task ChangePasswordAsync(Guid customerId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.OldPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            throw new ArgumentException("Old password and new password are required.");
        }

        if (request.OldPassword == request.NewPassword)
        {
            throw new ArgumentException("New password must be different from the old password.");
        }

        // Find the ApplicationUser associated with this customer
        var user = await _userManager.Users
            .Where(u => u.CustomerId == customerId)
            .FirstOrDefaultAsync(cancellationToken);

        if (user == null)
        {
            throw new InvalidOperationException($"User account for customer {customerId} not found.");
        }

        // Change password using UserManager
        var result = await _userManager.ChangePasswordAsync(user, request.OldPassword, request.NewPassword);

        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Password change failed: {errors}");
        }
    }
}
