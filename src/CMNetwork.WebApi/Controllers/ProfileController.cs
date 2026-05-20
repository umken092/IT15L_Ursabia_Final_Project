using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly CMNetworkDbContext _db;

    public ProfileController(UserManager<ApplicationUser> userManager, CMNetworkDbContext db)
    {
        _userManager = userManager;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var user = await GetCurrentUserAsync();
        if (user is null)
            return Unauthorized(new { message = "Authenticated user could not be resolved." });

        var employeeProfile = await _db.EmployeeProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == user.Id);

        var departmentName = user.DepartmentId.HasValue
            ? await _db.Departments
                .Where(x => x.Id == user.DepartmentId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync()
            : null;

        return Ok(MapProfile(user, employeeProfile, departmentName));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var user = await GetCurrentUserAsync();
        if (user is null)
            return Unauthorized(new { message = "Authenticated user could not be resolved." });

        var emailFailure = await TryUpdateEmailAsync(user, request.Email);
        if (emailFailure is not null)
            return emailFailure;

        ApplyNameFields(user, request);

        // Contact & address info
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        user.Address = string.IsNullOrWhiteSpace(request.Address) ? string.Empty : request.Address.Trim();
        
        // New registration profile fields
        if (request.BirthDate.HasValue)
        {
            user.Birthdate = request.BirthDate.Value;
        }
        if (!string.IsNullOrWhiteSpace(request.Gender))
        {
            user.Gender = request.Gender.Trim();
        }

        // Department assignment
        var departmentIdResult = await ResolveDepartmentIdAsync(request.Department);
        if (!departmentIdResult.isValid)
            return BadRequest(new { message = departmentIdResult.errorMessage });

        user.DepartmentId = departmentIdResult.departmentId;
        user.EmailNotificationsEnabled = request.EmailNotificationsEnabled;
        user.SmsNotificationsEnabled = request.SmsNotificationsEnabled;
        user.InAppNotificationsEnabled = request.InAppNotificationsEnabled;

        var employeeProfile = await GetOrCreateEmployeeProfileAsync(user);

        ApplyEmployeeFields(employeeProfile, request);

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(new { message = string.Join(" ", updateResult.Errors.Select(x => x.Description)) });

        await _db.SaveChangesAsync();

        var departmentName = user.DepartmentId.HasValue
            ? await _db.Departments
                .Where(x => x.Id == user.DepartmentId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync()
            : null;

        return Ok(MapProfile(user, employeeProfile, departmentName));
    }

    private async Task<IActionResult?> TryUpdateEmailAsync(ApplicationUser user, string rawEmail)
    {
        var email = rawEmail.Trim();
        if (string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            return null;

        var emailResult = await _userManager.SetEmailAsync(user, email);
        if (!emailResult.Succeeded)
            return BadRequest(new { message = string.Join(" ", emailResult.Errors.Select(x => x.Description)) });

        var userNameResult = await _userManager.SetUserNameAsync(user, email);
        if (!userNameResult.Succeeded)
            return BadRequest(new { message = string.Join(" ", userNameResult.Errors.Select(x => x.Description)) });

        return null;
    }

    private static void ApplyNameFields(ApplicationUser user, UpdateProfileRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.FirstName) && !string.IsNullOrWhiteSpace(request.LastName))
        {
            user.FirstName = request.FirstName.Trim();
            user.MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? string.Empty : request.MiddleName.Trim();
            user.LastName = request.LastName.Trim();
            return;
        }

        if (string.IsNullOrWhiteSpace(request.FullName))
            return;

        var nameParts = SplitFullName(request.FullName.Trim());
        user.FirstName = nameParts.firstName;
        user.MiddleName = nameParts.middleName;
        user.LastName = nameParts.lastName;
    }

    private static void ApplyEmployeeFields(EmployeeProfile employeeProfile, UpdateProfileRequest request)
    {
        if (request.Tin is not null)
        {
            employeeProfile.TIN = request.Tin.Trim();
        }

        if (request.Sss is not null)
        {
            employeeProfile.SSS = request.Sss.Trim();
        }

        if (request.BankAccount is null)
            return;

        employeeProfile.BankAccount = request.BankAccount.Trim();
    }

    private async Task<EmployeeProfile> GetOrCreateEmployeeProfileAsync(ApplicationUser user)
    {
        var profile = await _db.EmployeeProfiles.FirstOrDefaultAsync(x => x.UserId == user.Id);
        if (profile is not null)
            return profile;

        profile = new EmployeeProfile
        {
            UserId = user.Id,
            TIN = string.Empty,
            SSS = string.Empty,
            BankAccount = string.Empty,
            JoinDate = DateOnly.FromDateTime(DateTime.UtcNow),
            HourlyRate = null,
            LastLoginUtc = user.LastLoginUtc
        };

        _db.EmployeeProfiles.Add(profile);
        return profile;
    }

    private async Task<ApplicationUser?> GetCurrentUserAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userId, out var parsedUserId))
            return null;

        return await _userManager.Users.FirstOrDefaultAsync(x => x.Id == parsedUserId);
    }

    private async Task<(bool isValid, Guid? departmentId, string? errorMessage)> ResolveDepartmentIdAsync(string? department)
    {
        if (string.IsNullOrWhiteSpace(department))
            return (true, null, null);

        var normalizedDepartment = department.Trim();
        var match = await _db.Departments
            .Where(x => x.Code == normalizedDepartment || x.Name == normalizedDepartment)
            .Select(x => new { x.Id, x.Name })
            .FirstOrDefaultAsync();

        if (match is null)
            return (false, null, "Department was not found.");

        return (true, match.Id, null);
    }

    private static object MapProfile(ApplicationUser user, EmployeeProfile? employeeProfile, string? departmentName) => new
    {
        user.Id,
        fullName = user.FullName,
        firstName = user.FirstName ?? string.Empty,
        middleName = user.MiddleName ?? string.Empty,
        lastName = user.LastName ?? string.Empty,
        birthDate = user.Birthdate,
        gender = user.Gender ?? string.Empty,
        email = user.Email ?? string.Empty,
        phone = user.PhoneNumber ?? string.Empty,
        address = user.Address ?? string.Empty,
        department = departmentName ?? string.Empty,
        departmentId = user.DepartmentId,
        // Employee statutory / payroll fields
        tin = employeeProfile?.TIN ?? string.Empty,
        sss = employeeProfile?.SSS ?? string.Empty,
        bankAccount = employeeProfile?.BankAccount ?? string.Empty,
        joinDate = employeeProfile?.JoinDate,
        lastLoginUtc = employeeProfile?.LastLoginUtc ?? user.LastLoginUtc,
        hourlyRate = employeeProfile?.HourlyRate,
        emailNotificationsEnabled = user.EmailNotificationsEnabled,
        smsNotificationsEnabled = user.SmsNotificationsEnabled,
        inAppNotificationsEnabled = user.InAppNotificationsEnabled,
    };

    private static (string firstName, string middleName, string lastName) SplitFullName(string fullName)
    {
        var parts = fullName
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 0)
            return (string.Empty, string.Empty, string.Empty);

        if (parts.Length == 1)
            return (parts[0], string.Empty, string.Empty);

        if (parts.Length == 2)
            return (parts[0], string.Empty, parts[1]);

        return (parts[0], string.Join(' ', parts.Skip(1).Take(parts.Length - 2)), parts[^1]);
    }
}

public sealed class UpdateProfileRequest
{
    /// <summary>Fallback: if FirstName/LastName are not provided, this will be split.</summary>
    public string? FullName { get; init; }

    [StringLength(64)]
    public string? FirstName { get; init; }

    [StringLength(64)]
    public string? MiddleName { get; init; }

    [StringLength(64)]
    public string? LastName { get; init; }

    public DateOnly? BirthDate { get; init; }

    [RegularExpression("^(Male|Female|Other|Prefer not to say)$")]
    public string? Gender { get; init; }

    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    public string? Phone { get; init; }

    public string? Address { get; init; }

    public string? Department { get; init; }

    public bool EmailNotificationsEnabled { get; init; }

    public bool SmsNotificationsEnabled { get; init; }

    public bool InAppNotificationsEnabled { get; init; }

    /// <summary>BIR Tax Identification Number (employee statutory).</summary>
    [StringLength(20)]
    public string? Tin { get; init; }

    /// <summary>SSS membership number (employee statutory).</summary>
    [StringLength(20)]
    public string? Sss { get; init; }

    /// <summary>Bank account number for salary crediting.</summary>
    [StringLength(64)]
    public string? BankAccount { get; init; }
}