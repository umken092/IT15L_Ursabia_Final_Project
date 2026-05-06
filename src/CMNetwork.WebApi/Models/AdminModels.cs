namespace CMNetwork.Models;

public class AdminUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string JoinDate { get; set; } = string.Empty;
}

public class CreateAdminUserRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string MiddleName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Birthdate { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Address { get; set; } = string.Empty;
    public string TinNumber { get; set; } = string.Empty;
    public string SssNumber { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string GeneratedEmail { get; set; } = string.Empty;
    public string GeneratedPassword { get; set; } = string.Empty;
}

public class UpdateAdminUserRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string MiddleName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class ResetAdminUserPasswordRequest
{
    public string NewPassword { get; set; } = string.Empty;
}

public class SecurityPolicyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public string Value { get; set; } = string.Empty;
}

public class SecurityPolicySettingsDto
{
    public PasswordPolicySettingsDto Password { get; set; } = new();
    public LockoutPolicySettingsDto Lockout { get; set; } = new();
    public SessionPolicySettingsDto Session { get; set; } = new();
    public MfaPolicySettingsDto Mfa { get; set; } = new();
    public IpPolicySettingsDto Ip { get; set; } = new();
}

public class PasswordPolicySettingsDto
{
    public int MinLength { get; set; }
    public int MaxLength { get; set; }
    public string BlockedTerms { get; set; } = string.Empty;
    public bool? ForbidUserContext { get; set; }
    public bool? ForbidCompanyName { get; set; }
    public bool? ExpireOnlyOnCompromise { get; set; }
    public bool? AllowUnicode { get; set; }
    public bool RequireUppercase { get; set; }
    public bool RequireLowercase { get; set; }
    public bool RequireNumbers { get; set; }
    public bool RequireSymbols { get; set; }
    public int PreventReuse { get; set; }
}

public class LockoutPolicySettingsDto
{
    public int MaxFailedAttempts { get; set; }
    public int LockoutDurationMinutes { get; set; }
    public int ResetCounterAfterMinutes { get; set; }
}

public class SessionPolicySettingsDto
{
    public int IdleTimeoutMinutes { get; set; }
    public int AbsoluteTimeoutHours { get; set; }
    public bool SingleSessionPerUser { get; set; }
}

public class MfaPolicySettingsDto
{
    public string Level { get; set; } = string.Empty;
}

public class IpPolicySettingsDto
{
    public string Mode { get; set; } = string.Empty;
    public string AllowedRanges { get; set; } = string.Empty;
}

public class IntegrationDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string LastSync { get; set; } = string.Empty;
}

public class BackupRecordDto
{
    public Guid Id { get; set; }
    public string Timestamp { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
}

public class AuditReviewRequest
{
    public List<Guid> Ids { get; set; } = new();
}

public class AdminHealthCheckDto
{
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int LatencyMs { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class AdminApiStatDto
{
    public string Label { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Sub { get; set; } = string.Empty;
    public string Trend { get; set; } = string.Empty;
}

public class AdminRequestLogDto
{
    public string Id { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public int Status { get; set; }
    public int DurationMs { get; set; }
    public string Timestamp { get; set; } = string.Empty;
}

public class AdminSystemHealthDto
{
    public List<AdminHealthCheckDto> Checks { get; set; } = new();
    public List<AdminApiStatDto> Stats { get; set; } = new();
    public List<AdminRequestLogDto> RecentRequests { get; set; } = new();
}

public class AdminUsageRowDto
{
    public string User { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int Logins { get; set; }
    public string TopModule { get; set; } = string.Empty;
    public string LastLogin { get; set; } = string.Empty;
}

public class AdminModuleUsageDto
{
    public string Module { get; set; } = string.Empty;
    public int Sessions { get; set; }
    public int Pct { get; set; }
}

public class AdminPeakHourDto
{
    public string Hour { get; set; } = string.Empty;
    public int Requests { get; set; }
}

public class AdminLicenseUserDto
{
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string LastSeen { get; set; } = string.Empty;
}

public class AdminReportsDto
{
    public List<AdminUsageRowDto> UsageRows { get; set; } = new();
    public List<AdminModuleUsageDto> ModuleUsage { get; set; } = new();
    public List<AdminPeakHourDto> PeakHours { get; set; } = new();
    public int LicenseLimit { get; set; }
    public List<AdminLicenseUserDto> LicenseUsers { get; set; } = new();
}

public class AdminJobDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string LastRun { get; set; } = string.Empty;
    public string? NextRun { get; set; }
    public string? Duration { get; set; }
    public string? Error { get; set; }
    public string? Cron { get; set; }
}
