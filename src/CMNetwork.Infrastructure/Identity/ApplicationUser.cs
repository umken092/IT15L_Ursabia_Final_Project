using Microsoft.AspNetCore.Identity;

namespace CMNetwork.Infrastructure.Identity;

public class ApplicationUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string MiddleName { get; set; } = string.Empty;
    public DateOnly? Birthdate { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string TIN { get; set; } = string.Empty;
    public string SSS { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public bool EmailNotificationsEnabled { get; set; } = true;
    public bool SmsNotificationsEnabled { get; set; }
    public bool InAppNotificationsEnabled { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateOnly JoinDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string? AuthenticatorKey { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginUtc { get; set; }

    public string FullName => $"{FirstName} {MiddleName} {LastName}".Trim().Replace("  ", " ");
}
