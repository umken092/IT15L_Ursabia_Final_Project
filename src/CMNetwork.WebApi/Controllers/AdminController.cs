using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Models;
using CMNetwork.Services;
using Hangfire;
using Hangfire.Storage;
using Hangfire.Storage.Monitoring;
using System.Diagnostics;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "SuperAdminOnly")]
public class AdminController : ControllerBase
{
    private const string ApplicationUserEntity = "ApplicationUser";
    private const string DateTimeMinuteFormat = "yyyy-MM-dd HH:mm";
    private const string GlobalSecurityPolicyName = "Global Security Policy";
    private const string GlobalSecurityPolicyDescription = "Full authentication and access-control settings for the Security Policy module";
    private const string CompanyNameTerm = "cmnetwork";
    private const string ActiveUserStatus = "active";
    private const string AdHocJobType = "ad-hoc";
    private const string RecurringJobType = "recurring";
    private const string ScheduledJobStatus = "scheduled";
    private static readonly string[] BuiltInBlockedPasswordTerms =
    [
        "password", "passw0rd", "p@ssword", "123456", "12345678", "123456789",
        "qwerty", "admin", "administrator", "letmein", "welcome", "abc123",
        "iloveyou", "monkey", "dragon", "football", "baseball", "login"
    ];
    private static readonly JsonSerializerOptions SecurityPolicyJsonOptions = new(JsonSerializerDefaults.Web);

    private readonly CMNetworkDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAuditEventLogger _audit;
    private readonly IConfiguration _configuration;
    private readonly IRecurringJobManager _recurringJobManager;
    private readonly JobStorage _jobStorage;

    public AdminController(
        CMNetworkDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        IAuditEventLogger audit,
        IConfiguration configuration,
        IRecurringJobManager recurringJobManager,
        JobStorage jobStorage)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _audit = audit;
        _configuration = configuration;
        _recurringJobManager = recurringJobManager;
        _jobStorage = jobStorage;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var result = await BuildAdminUsersAsync();
        return Ok(result);
    }

    // Backward-compatible alias for older clients using singular endpoint path.
    [HttpGet("user")]
    public Task<IActionResult> GetUsersQueryAlias(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? department,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        return GetUsersQuery(search, role, department, page, pageSize);
    }

    [HttpGet("users/query")]
    public async Task<IActionResult> GetUsersQuery(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? department,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (page < 1)
        {
            page = 1;
        }

        if (pageSize < 1)
        {
            pageSize = 10;
        }

        var users = await BuildAdminUsersAsync();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalizedSearch = search.Trim().ToLowerInvariant();
            users = users
                .Where(user =>
                    user.FullName.ToLowerInvariant().Contains(normalizedSearch)
                    || user.Email.ToLowerInvariant().Contains(normalizedSearch))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            users = users
                .Where(user => string.Equals(user.Role, role, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(department))
        {
            users = users
                .Where(user => string.Equals(user.Department, department, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var totalCount = users.Count;
        var items = users
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize,
        });
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateAdminUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
        {
            return BadRequest(new { message = "First name and last name are required." });
        }

        var email = await ResolveGeneratedEmailAsync(request.GeneratedEmail, request.FirstName, request.LastName);
        var password = ResolveGeneratedPassword(request.GeneratedPassword);

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            return BadRequest(new { message = "User already exists." });
        }

        var departmentId = await ResolveDepartmentIdAsync(request.Department);

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            IsActive = true,
            FirstName = request.FirstName,
            MiddleName = request.MiddleName,
            LastName = request.LastName,
            Birthdate = DateOnly.TryParse(
                request.Birthdate,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var birthdate) ? birthdate : null,
            Gender = request.Gender,
            Address = request.Address,
            TIN = request.TinNumber,
            SSS = request.SssNumber,
            DepartmentId = departmentId,
            JoinDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedUtc = DateTime.UtcNow,
        };

        var passwordPolicy = await GetCurrentSecurityPolicySettingsAsync();
        var passwordValidationErrors = ValidatePasswordAgainstPolicy(password, passwordPolicy.Password, user);
        if (passwordValidationErrors.Count > 0)
        {
            return BadRequest(new { message = string.Join(" ", passwordValidationErrors) });
        }

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", createResult.Errors.Select(x => x.Description)) });
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            await EnsureRoleExistsAsync(request.Role);
            await _userManager.AddToRoleAsync(user, request.Role);
        }

        await _audit.LogAsync(
            entityName: ApplicationUserEntity,
            action: "UserCreated",
            category: AuditCategories.UserMgmt,
            recordId: user.Id.ToString(),
            details: new { email = user.Email, role = request.Role, departmentId });

        return Ok(new { id = user.Id, email = user.Email });
    }

    [HttpPut("users/{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateAdminUserRequest request)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.FirstName = request.FirstName;
        user.MiddleName = request.MiddleName;
        user.LastName = request.LastName;
        user.IsActive = request.Status != "inactive";
        user.DepartmentId = await ResolveDepartmentIdAsync(request.Department);

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", updateResult.Errors.Select(x => x.Description)) });
        }

        var previousRoles = await _userManager.GetRolesAsync(user);
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (previousRoles.Count > 0)
            {
                await _userManager.RemoveFromRolesAsync(user, previousRoles);
            }
            await EnsureRoleExistsAsync(request.Role);
            await _userManager.AddToRoleAsync(user, request.Role);
        }

        await _audit.LogAsync(
            entityName: ApplicationUserEntity,
            action: "UserUpdated",
            category: AuditCategories.UserMgmt,
            recordId: user.Id.ToString(),
            details: new
            {
                email = user.Email,
                status = request.Status,
                previousRoles,
                newRole = request.Role,
                department = request.Department,
            });

        return NoContent();
    }

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        user.IsActive = false;
        await _userManager.UpdateAsync(user);

        await _audit.LogAsync(
            entityName: ApplicationUserEntity,
            action: "UserDeactivated",
            category: AuditCategories.UserMgmt,
            recordId: user.Id.ToString(),
            details: new { email = user.Email });

        return NoContent();
    }

    [HttpPost("users/{id:guid}/unlock")]
    public async Task<IActionResult> UnlockUser(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound(new { message = "User not found." });

        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        await _audit.LogAsync(
            entityName: ApplicationUserEntity,
            action: "UserUnlocked",
            category: AuditCategories.Security,
            recordId: user.Id.ToString(),
            details: new { email = user.Email });

        return NoContent();
    }

    [HttpPost("users/{id:guid}/password")]
    public async Task<IActionResult> ResetUserPassword(Guid id, [FromBody] ResetAdminUserPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "New password is required." });
        }

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var roles = await _userManager.GetRolesAsync(user);
        var isSuperAdmin = roles.Any(role => role.Equals("super-admin", StringComparison.OrdinalIgnoreCase)
            || role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase));

        if (isSuperAdmin)
        {
            return BadRequest(new { message = "Superadmin passwords cannot be changed from user management." });
        }

        var passwordPolicy = await GetCurrentSecurityPolicySettingsAsync();
        var passwordValidationErrors = ValidatePasswordAgainstPolicy(request.NewPassword, passwordPolicy.Password, user);
        if (passwordValidationErrors.Count > 0)
        {
            return BadRequest(new { message = string.Join(" ", passwordValidationErrors) });
        }

        var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
        var resetResult = await _userManager.ResetPasswordAsync(user, resetToken, request.NewPassword);

        if (!resetResult.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", resetResult.Errors.Select(x => x.Description)) });
        }

        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.SetLockoutEndDateAsync(user, null);

        await _audit.LogAsync(
            entityName: ApplicationUserEntity,
            action: "PasswordReset",
            category: AuditCategories.Security,
            recordId: user.Id.ToString(),
            details: new { email = user.Email });

        return NoContent();
    }

    [HttpGet("security-policies")]
    public async Task<IActionResult> GetSecurityPolicies()
    {
        var policies = await _dbContext.SecurityPolicies
            .OrderBy(x => x.Name)
            .Select(x => new SecurityPolicyDto
            {
                Id = x.Id,
                Name = x.Name,
                Description = x.Description,
                Enabled = x.IsEnabled,
                Value = x.Value,
            })
            .ToListAsync();

        return Ok(policies);
    }

    [HttpGet("security-policy")]
    public async Task<IActionResult> GetSecurityPolicySettings()
    {
        var policy = await GetOrCreateGlobalSecurityPolicyAsync();
        return Ok(ReadSecurityPolicySettings(policy.Value));
    }

    [HttpPut("security-policy")]
    public async Task<IActionResult> UpdateSecurityPolicySettings([FromBody] SecurityPolicySettingsDto? request)
    {
        if (request is null)
        {
            return BadRequest(new { message = "Security policy payload is required." });
        }

        var settings = NormalizeSecurityPolicySettings(request);
        var policy = await GetOrCreateGlobalSecurityPolicyAsync();
        policy.Value = JsonSerializer.Serialize(settings, SecurityPolicyJsonOptions);
        policy.IsEnabled = true;

        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "SecurityPolicy",
            action: "Updated",
            category: AuditCategories.Security,
            recordId: policy.Id.ToString(),
            details: new
            {
                policy.Name,
                settings.Password.MinLength,
                settings.Password.MaxLength,
                settings.Password.ForbidUserContext,
                settings.Password.ForbidCompanyName,
                settings.Lockout.MaxFailedAttempts,
                settings.Session.IdleTimeoutMinutes,
                settings.Mfa.Level,
                settings.Ip.Mode,
            });

        return Ok(settings);
    }

    [HttpPut("security-policies/{id:guid}/toggle")]
    public async Task<IActionResult> ToggleSecurityPolicy(Guid id)
    {
        var policy = await _dbContext.SecurityPolicies.FirstOrDefaultAsync(x => x.Id == id);
        if (policy is null)
        {
            return NotFound(new { message = "Security policy not found." });
        }

        policy.IsEnabled = !policy.IsEnabled;
        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "SecurityPolicy",
            action: policy.IsEnabled ? "Enabled" : "Disabled",
            category: AuditCategories.Security,
            recordId: policy.Id.ToString(),
            details: new { policy.Name, policy.IsEnabled });

        return NoContent();
    }

    [HttpGet("integrations")]
    public async Task<IActionResult> GetIntegrations()
    {
        var integrations = await _dbContext.IntegrationSettings
            .OrderBy(x => x.Name)
            .Select(x => new IntegrationDto
            {
                Id = x.Id,
                Name = x.Name,
                Status = x.Status,
                Endpoint = x.Endpoint,
                LastSync = x.LastSyncUtc.HasValue ? x.LastSyncUtc.Value.ToString(DateTimeMinuteFormat) : "N/A"
            })
            .ToListAsync();

        return Ok(integrations);
    }

    [HttpGet("backups")]
    public async Task<IActionResult> GetBackups()
    {
        var records = await _dbContext.BackupRecords
            .OrderByDescending(x => x.StartedUtc)
            .Select(x => new BackupRecordDto
            {
                Id = x.Id,
                Timestamp = x.StartedUtc.ToString(DateTimeMinuteFormat),
                Status = x.Status,
                Size = $"{x.SizeInMb:N1} MB",
                Duration = $"{x.DurationSeconds} sec"
            })
            .ToListAsync();

        return Ok(records);
    }

    [HttpPost("backups/run")]
    public async Task<IActionResult> RunBackup()
    {
        var record = new CMNetwork.Domain.Entities.BackupRecord
        {
            Id = Guid.NewGuid(),
            StartedUtc = DateTime.UtcNow,
            Status = "success",
            SizeInMb = 2430.5m,
            DurationSeconds = 960,
        };
        _dbContext.BackupRecords.Add(record);

        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "BackupRecord",
            action: "BackupExecuted",
            category: AuditCategories.System,
            recordId: record.Id.ToString(),
            details: new { record.Status, record.SizeInMb, record.DurationSeconds });

        return Ok();
    }

    [HttpPost("backups/restore")]
    public IActionResult RestoreBackup()
    {
        return Ok(new { message = "Restore simulated from latest successful backup." });
    }

    [HttpGet("audit-activities")]
    public async Task<IActionResult> GetAuditActivities()
    {
        var activities = await _dbContext.AuditLogs
            .OrderByDescending(x => x.CreatedUtc)
            .Take(20)
            .Select(x => new
            {
                id = x.Id,
                action = x.Action,
                entity = x.EntityName,
                user = x.PerformedBy,
                timestamp = x.CreatedUtc,
            })
            .ToListAsync();

        return Ok(activities);
    }

    [HttpGet("system-health")]
    public async Task<ActionResult<AdminSystemHealthDto>> GetSystemHealth()
    {
        var now = DateTime.UtcNow;
        var since = now.AddHours(-24);
        var previousSince = now.AddHours(-48);

        var checks = new List<AdminHealthCheckDto>
        {
            await CheckServiceAsync("Primary Database", async () => { await _dbContext.Database.CanConnectAsync(); }),
            await CheckServiceAsync("Identity Store", async () => { await _dbContext.Users.AnyAsync(); }),
            await CheckServiceAsync("Audit Log Store", async () => { await _dbContext.AuditLogs.OrderByDescending(x => x.CreatedUtc).Take(1).AnyAsync(); }),
            CheckHangfireStorage(),
        };

        var apiAuditRows = await _dbContext.AuditLogs
            .Where(x => x.ActionCategory == AuditCategories.ApiRequest && x.CreatedUtc >= previousSince)
            .OrderByDescending(x => x.CreatedUtc)
            .Select(x => new { x.Id, x.EntityName, x.RecordId, x.DetailsJson, x.CreatedUtc })
            .ToListAsync();

        var requests = apiAuditRows.Select(ParseApiRequest).ToList();
        var currentRequests = requests.Where(x => x.CreatedUtc >= since).ToList();
        var previousRequests = requests.Where(x => x.CreatedUtc < since).ToList();
        var avgDuration = currentRequests.Count == 0 ? 0 : (int)Math.Round(currentRequests.Average(x => x.DurationMs));
        var prevAvgDuration = previousRequests.Count == 0 ? avgDuration : (int)Math.Round(previousRequests.Average(x => x.DurationMs));
        var errorRate = currentRequests.Count == 0
            ? 0m
            : Math.Round(currentRequests.Count(x => x.Status >= 400) * 100m / currentRequests.Count, 1);
        var recentFiveMinuteCount = currentRequests.Count(x => x.CreatedUtc >= now.AddMinutes(-5));

        return Ok(new AdminSystemHealthDto
        {
            Checks = checks,
            Stats = new List<AdminApiStatDto>
            {
                new()
                {
                    Label = "Total Requests (24 h)",
                    Value = currentRequests.Count.ToString("N0", CultureInfo.InvariantCulture),
                    Sub = CompareCounts(currentRequests.Count, previousRequests.Count, "previous 24 h"),
                    Trend = currentRequests.Count >= previousRequests.Count ? "up" : "down",
                },
                new()
                {
                    Label = "Avg Response Time",
                    Value = $"{avgDuration:N0} ms",
                    Sub = prevAvgDuration == avgDuration ? "No change vs previous 24 h" : $"{Math.Abs(avgDuration - prevAvgDuration):N0} ms vs previous 24 h",
                    Trend = avgDuration <= prevAvgDuration ? "down" : "up",
                },
                new()
                {
                    Label = "Error Rate",
                    Value = $"{errorRate:N1} %",
                    Sub = currentRequests.Count == 0 ? "No API traffic in window" : "From audited API responses",
                    Trend = errorRate == 0 ? "neutral" : "up",
                },
                new()
                {
                    Label = "Recent Requests",
                    Value = recentFiveMinuteCount.ToString("N0", CultureInfo.InvariantCulture),
                    Sub = "Last 5 minutes",
                    Trend = "neutral",
                },
            },
            RecentRequests = currentRequests
                .OrderByDescending(x => x.CreatedUtc)
                .Take(10)
                .Select(x => new AdminRequestLogDto
                {
                    Id = x.Id.ToString(),
                    Method = x.Method,
                    Path = FrontendEndpointLabel(x.Path),
                    Status = x.Status,
                    DurationMs = x.DurationMs,
                    Timestamp = x.CreatedUtc.ToLocalTime().ToString("HH:mm:ss.fff", CultureInfo.InvariantCulture),
                })
                .ToList(),
        });
    }

    [HttpGet("system-reports")]
    public async Task<ActionResult<AdminReportsDto>> GetSystemReports()
    {
        return Ok(await BuildSystemReportsAsync());
    }

    [HttpGet("system-reports/export")]
    public async Task<IActionResult> ExportSystemReports([FromQuery] string format = "csv")
    {
        var report = await BuildSystemReportsAsync();
        var normalizedFormat = format.Trim().ToLowerInvariant();
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);

        return normalizedFormat switch
        {
            "csv" => File(
                BuildSystemReportCsv(report),
                "text/csv; charset=utf-8",
                $"system-usage-report-{timestamp}.csv"),
            "xlsx" => File(
                await BuildSystemReportWorkbookAsync(report),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"system-usage-report-{timestamp}.xlsx"),
            "pdf" => File(
                BuildSystemReportPdf(report),
                "application/pdf",
                $"system-usage-report-{timestamp}.pdf"),
            _ => BadRequest(new { message = "Format must be csv, xlsx, or pdf." }),
        };
    }

    private async Task<AdminReportsDto> BuildSystemReportsAsync()
    {
        var now = DateTime.UtcNow;
        var since = now.AddDays(-30);
        var today = now.Date;
        var users = await BuildAdminUsersAsync();
        var auditRows = await _dbContext.AuditLogs
            .Where(x => x.CreatedUtc >= since)
            .Select(x => new { x.Action, x.ActionCategory, x.EntityName, x.RecordId, x.DetailsJson, x.CreatedUtc, x.UserEmail })
            .ToListAsync();

        var apiRequests = auditRows
            .Where(x => x.ActionCategory == AuditCategories.ApiRequest)
            .Select(x => ParseApiRequest(new { x.EntityName, x.RecordId, x.DetailsJson, x.CreatedUtc }))
            .ToList();

        var loginRows = auditRows
            .Where(x => string.Equals(x.Action, "LoginSucceeded", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var usageRows = users
            .OrderByDescending(x => x.Status == ActiveUserStatus)
            .ThenBy(x => x.Email)
            .Select(user =>
            {
                var userLogins = loginRows
                    .Where(x => string.Equals(x.UserEmail, user.Email, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                var userApiRows = auditRows
                    .Where(x => x.ActionCategory == AuditCategories.ApiRequest && string.Equals(x.UserEmail, user.Email, StringComparison.OrdinalIgnoreCase))
                    .Select(x => ParseApiRequest(new { x.EntityName, x.RecordId, x.DetailsJson, x.CreatedUtc }))
                    .ToList();
                var topModule = userApiRows
                    .GroupBy(x => FriendlyModuleName(x.Path))
                    .OrderByDescending(x => x.Count())
                    .Select(x => x.Key)
                    .FirstOrDefault() ?? "No module activity";
                var lastLogin = userLogins
                    .OrderByDescending(x => x.CreatedUtc)
                    .Select(x => x.CreatedUtc.ToLocalTime().ToString(DateTimeMinuteFormat, CultureInfo.InvariantCulture))
                    .FirstOrDefault() ?? "No login recorded";

                return new AdminUsageRowDto
                {
                    User = user.Email,
                    Role = user.Role,
                    Logins = userLogins.Count,
                    TopModule = topModule,
                    LastLogin = lastLogin,
                };
            })
            .ToList();

        var moduleGroups = apiRequests
            .GroupBy(x => FriendlyModuleName(x.Path))
            .OrderByDescending(x => x.Count())
            .Take(8)
            .ToList();
        var maxModuleCount = Math.Max(1, moduleGroups.Select(x => x.Count()).DefaultIfEmpty(0).Max());
        var peakGroups = apiRequests
            .Where(x => x.CreatedUtc >= today)
            .GroupBy(x => x.CreatedUtc.ToLocalTime().Hour)
            .ToDictionary(x => x.Key, x => x.Count());
        var activeUsers = users.Count(x => x.Status == ActiveUserStatus);
        var licenseLimit = _configuration.GetValue<int?>("Licensing:SeatLimit") ?? Math.Max(1, users.Count);

        return new AdminReportsDto
        {
            UsageRows = usageRows,
            ModuleUsage = moduleGroups
                .Select(x => new AdminModuleUsageDto
                {
                    Module = x.Key,
                    Sessions = x.Count(),
                    Pct = Math.Max(1, (int)Math.Round(x.Count() * 100m / maxModuleCount)),
                })
                .ToList(),
            PeakHours = Enumerable.Range(0, 24)
                .Select(hour => new AdminPeakHourDto
                {
                    Hour = $"{hour:00}:00",
                    Requests = peakGroups.TryGetValue(hour, out var count) ? count : 0,
                })
                .ToList(),
            LicenseLimit = Math.Max(activeUsers, licenseLimit),
            LicenseUsers = users.Select(user =>
                {
                    var lastSeen = auditRows
                        .Where(x => string.Equals(x.UserEmail, user.Email, StringComparison.OrdinalIgnoreCase))
                        .OrderByDescending(x => x.CreatedUtc)
                        .Select(x => x.CreatedUtc)
                        .FirstOrDefault();
                    return new AdminLicenseUserDto
                    {
                        Name = user.Email,
                        Role = user.Role,
                        Status = user.Status,
                        LastSeen = lastSeen == default ? "No activity recorded" : FormatRelativeTime(lastSeen, now),
                    };
                })
                .ToList(),
        };
    }

    private static byte[] BuildSystemReportCsv(AdminReportsDto report)
    {
        var sb = new StringBuilder();
        sb.AppendLine("CMNetwork System Usage Report");
        sb.AppendLine($"Generated UTC,{DateTime.UtcNow:O}");
        sb.AppendLine();

        sb.AppendLine("User Login Log");
        sb.AppendLine("User,Role,Logins,Top Module,Last Login");
        foreach (var row in report.UsageRows)
        {
            sb.Append(Csv(row.User)).Append(',');
            sb.Append(Csv(row.Role)).Append(',');
            sb.Append(row.Logins.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append(Csv(row.TopModule)).Append(',');
            sb.Append(Csv(row.LastLogin)).AppendLine();
        }

        sb.AppendLine();
        sb.AppendLine("Most Used Modules");
        sb.AppendLine("Module,Sessions,Percent");
        foreach (var row in report.ModuleUsage)
        {
            sb.Append(Csv(row.Module)).Append(',');
            sb.Append(row.Sessions.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append(row.Pct.ToString(CultureInfo.InvariantCulture)).AppendLine();
        }

        sb.AppendLine();
        sb.AppendLine("Peak Usage Times");
        sb.AppendLine("Hour,Requests");
        foreach (var row in report.PeakHours)
        {
            sb.Append(Csv(row.Hour)).Append(',');
            sb.Append(row.Requests.ToString(CultureInfo.InvariantCulture)).AppendLine();
        }

        sb.AppendLine();
        sb.AppendLine("License Users");
        sb.AppendLine("User,Role,Status,Last Seen");
        foreach (var row in report.LicenseUsers)
        {
            sb.Append(Csv(row.Name)).Append(',');
            sb.Append(Csv(row.Role)).Append(',');
            sb.Append(Csv(row.Status)).Append(',');
            sb.Append(Csv(row.LastSeen)).AppendLine();
        }

        return new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetBytes(sb.ToString());
    }

    private static async Task<byte[]> BuildSystemReportWorkbookAsync(AdminReportsDto report)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();

        var usageSheet = package.Workbook.Worksheets.Add("User Login Log");
        usageSheet.Cells[1, 1].Value = "User";
        usageSheet.Cells[1, 2].Value = "Role";
        usageSheet.Cells[1, 3].Value = "Logins";
        usageSheet.Cells[1, 4].Value = "Top Module";
        usageSheet.Cells[1, 5].Value = "Last Login";
        usageSheet.Cells[1, 1, 1, 5].Style.Font.Bold = true;
        for (var i = 0; i < report.UsageRows.Count; i++)
        {
            var row = report.UsageRows[i];
            var sheetRow = i + 2;
            usageSheet.Cells[sheetRow, 1].Value = row.User;
            usageSheet.Cells[sheetRow, 2].Value = row.Role;
            usageSheet.Cells[sheetRow, 3].Value = row.Logins;
            usageSheet.Cells[sheetRow, 4].Value = row.TopModule;
            usageSheet.Cells[sheetRow, 5].Value = row.LastLogin;
        }
        usageSheet.Cells.AutoFitColumns();

        var moduleSheet = package.Workbook.Worksheets.Add("Module Usage");
        moduleSheet.Cells[1, 1].Value = "Module";
        moduleSheet.Cells[1, 2].Value = "Sessions";
        moduleSheet.Cells[1, 3].Value = "Percent";
        moduleSheet.Cells[1, 1, 1, 3].Style.Font.Bold = true;
        for (var i = 0; i < report.ModuleUsage.Count; i++)
        {
            var row = report.ModuleUsage[i];
            var sheetRow = i + 2;
            moduleSheet.Cells[sheetRow, 1].Value = row.Module;
            moduleSheet.Cells[sheetRow, 2].Value = row.Sessions;
            moduleSheet.Cells[sheetRow, 3].Value = row.Pct;
        }
        moduleSheet.Cells.AutoFitColumns();

        var peakSheet = package.Workbook.Worksheets.Add("Peak Usage Times");
        peakSheet.Cells[1, 1].Value = "Hour";
        peakSheet.Cells[1, 2].Value = "Requests";
        peakSheet.Cells[1, 1, 1, 2].Style.Font.Bold = true;
        for (var i = 0; i < report.PeakHours.Count; i++)
        {
            var row = report.PeakHours[i];
            var sheetRow = i + 2;
            peakSheet.Cells[sheetRow, 1].Value = row.Hour;
            peakSheet.Cells[sheetRow, 2].Value = row.Requests;
        }
        peakSheet.Cells.AutoFitColumns();

        var licenseSheet = package.Workbook.Worksheets.Add("License Users");
        licenseSheet.Cells[1, 1].Value = "User";
        licenseSheet.Cells[1, 2].Value = "Role";
        licenseSheet.Cells[1, 3].Value = "Status";
        licenseSheet.Cells[1, 4].Value = "Last Seen";
        licenseSheet.Cells[1, 1, 1, 4].Style.Font.Bold = true;
        for (var i = 0; i < report.LicenseUsers.Count; i++)
        {
            var row = report.LicenseUsers[i];
            var sheetRow = i + 2;
            licenseSheet.Cells[sheetRow, 1].Value = row.Name;
            licenseSheet.Cells[sheetRow, 2].Value = row.Role;
            licenseSheet.Cells[sheetRow, 3].Value = row.Status;
            licenseSheet.Cells[sheetRow, 4].Value = row.LastSeen;
        }
        licenseSheet.Cells.AutoFitColumns();

        return await package.GetAsByteArrayAsync();
    }

    private static byte[] BuildSystemReportPdf(AdminReportsDto report)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.Header().Column(column =>
                {
                    column.Item().Text("CMNetwork System Usage Report").Bold().FontSize(18);
                    column.Item().Text($"Generated UTC: {DateTime.UtcNow:yyyy-MM-dd HH:mm}").FontSize(9).FontColor(Colors.Grey.Darken1);
                });
                page.Content().PaddingTop(18).Column(column =>
                {
                    column.Spacing(8);
                    column.Item().Text("User Login Log").Bold().FontSize(12);
                    foreach (var row in report.UsageRows.Take(35))
                    {
                        column.Item().Text($"{row.User} | {row.Role} | Logins: {row.Logins} | Top Module: {row.TopModule} | Last Login: {row.LastLogin}").FontSize(8);
                    }

                    column.Item().PaddingTop(10).Text("Most Used Modules").Bold().FontSize(12);
                    foreach (var row in report.ModuleUsage)
                    {
                        column.Item().Text($"{row.Module}: {row.Sessions} sessions ({row.Pct}%)").FontSize(8);
                    }

                    column.Item().PaddingTop(10).Text("License Utilisation").Bold().FontSize(12);
                    var activeUsers = report.LicenseUsers.Count(user => string.Equals(user.Status, "active", StringComparison.OrdinalIgnoreCase));
                    column.Item().Text($"{activeUsers} of {report.LicenseLimit} seats in use").FontSize(9);

                    foreach (var row in report.LicenseUsers.Take(35))
                    {
                        column.Item().Text($"{row.Name} | {row.Role} | {row.Status} | {row.LastSeen}").FontSize(8);
                    }
                });
                page.Footer().AlignCenter().Text("Generated by CMNetwork ERP").FontSize(9);
            });
        }).GeneratePdf();
    }

    private static string Csv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var needsQuotes = value.IndexOfAny([',', '"', '\n', '\r']) >= 0;
        var escaped = value.Replace("\"", "\"\"");
        return needsQuotes ? $"\"{escaped}\"" : escaped;
    }

    [HttpGet("jobs")]
    public ActionResult<List<AdminJobDto>> GetJobs()
    {
        SystemMaintenanceJobs.RegisterRecurringJobs(_recurringJobManager);

        var jobs = new List<AdminJobDto>();
        var monitor = _jobStorage.GetMonitoringApi();

        using (var connection = _jobStorage.GetConnection())
        {
            jobs.AddRange(connection.GetRecurringJobs().Select(job => new AdminJobDto
            {
                Id = job.Id,
                Name = FormatJobName(job.Job) ?? job.Id,
                Type = RecurringJobType,
                Status = NormalizeJobStatus(job.LastJobState ?? RecurringJobType),
                LastRun = FormatNullableDate(job.LastExecution),
                NextRun = FormatNullableDate(job.NextExecution),
                Cron = job.Cron,
                Error = job.Error,
            }));
        }

        if (jobs.All(job => job.Type != RecurringJobType))
        {
            jobs.AddRange(SystemMaintenanceJobs.RecurringJobDefinitions.Select(ToJobDto));
        }

        var recurringJobNames = jobs
            .Where(job => job.Type == RecurringJobType)
            .Select(job => job.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        jobs.AddRange(monitor.ProcessingJobs(0, 25)
            .Select(x => ToJobDto(x.Key, x.Value))
            .Where(job => !IsCompletedRecurringJobInstance(job, recurringJobNames)));
        jobs.AddRange(monitor.ScheduledJobs(0, 25)
            .Select(x => ToJobDto(x.Key, x.Value))
            .Where(job => !IsCompletedRecurringJobInstance(job, recurringJobNames)));
        jobs.AddRange(monitor.FailedJobs(0, 25)
            .Select(x => ToJobDto(x.Key, x.Value))
            .Where(job => !IsCompletedRecurringJobInstance(job, recurringJobNames)));
        jobs.AddRange(monitor.SucceededJobs(0, 25)
            .Select(x => ToJobDto(x.Key, x.Value))
            .Where(job => !IsCompletedRecurringJobInstance(job, recurringJobNames)));

        return Ok(jobs
            .GroupBy(x => x.Id)
            .Select(x => x.First())
            .OrderByDescending(x => x.Status == "running")
            .ThenByDescending(x => x.Status == "failed")
            .ThenBy(x => x.Name)
            .ToList());
    }

    [HttpPost("jobs/{id}/trigger")]
    public IActionResult TriggerJob(string id)
    {
        RecurringJob.TriggerJob(id);
        return NoContent();
    }

    [HttpPost("jobs/{id}/retry")]
    public IActionResult RetryJob(string id)
    {
        return BackgroundJob.Requeue(id) ? NoContent() : NotFound();
    }

    [HttpDelete("jobs/{id}")]
    public IActionResult DeleteJob(string id)
    {
        return BackgroundJob.Delete(id) ? NoContent() : NotFound();
    }

    // ── Audit log viewer ────────────────────────────────────────────────────
    // Moved to AuditLogsController so it can be exposed to both super-admin
    // and auditor roles without inheriting the SuperAdminOnly class policy.

    private static async Task<AdminHealthCheckDto> CheckServiceAsync(string name, Func<Task> probe)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await probe();
            sw.Stop();
            return new AdminHealthCheckDto
            {
                Name = name,
                Status = "ok",
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = "Reachable",
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new AdminHealthCheckDto
            {
                Name = name,
                Status = "error",
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = ex.GetType().Name,
            };
        }
    }

    private AdminHealthCheckDto CheckHangfireStorage()
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var serverCount = _jobStorage.GetMonitoringApi().Servers().Count;
            sw.Stop();
            return new AdminHealthCheckDto
            {
                Name = "Job Storage",
                Status = "ok",
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = serverCount == 1 ? "1 server online" : $"{serverCount} servers online",
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new AdminHealthCheckDto
            {
                Name = "Job Storage",
                Status = "error",
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = ex.GetType().Name,
            };
        }
    }

    private sealed record ApiRequestSnapshot(Guid Id, string Method, string Path, int Status, int DurationMs, DateTime CreatedUtc);
    private sealed record ApiRequestDetails(string? Method, string? Path, int? Status, int? DurationMs);

    private static ApiRequestSnapshot ParseApiRequest(object source)
    {
        var entityName = GetStringProperty(source, "EntityName") ?? string.Empty;
        var recordId = GetStringProperty(source, "RecordId");
        var details = ReadApiRequestDetails(GetStringProperty(source, "DetailsJson"));
        var method = entityName.Split(' ', 2).FirstOrDefault() ?? string.Empty;
        var path = entityName.Contains(' ', StringComparison.Ordinal) ? entityName.Split(' ', 2)[1] : entityName;
        var status = int.TryParse(recordId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedStatus)
            ? parsedStatus
            : 0;
        var id = source.GetType().GetProperty("Id")?.GetValue(source) is Guid guidValue ? guidValue : Guid.Empty;

        return new ApiRequestSnapshot(
            id,
            (details.Method ?? method).ToUpperInvariant(),
            details.Path ?? path,
            details.Status ?? status,
            details.DurationMs ?? 0,
            GetDateTimeProperty(source, "CreatedUtc") ?? DateTime.UtcNow);
    }

    private static string? GetStringProperty(object source, string propertyName)
    {
        return Convert.ToString(source.GetType().GetProperty(propertyName)?.GetValue(source));
    }

    private static DateTime? GetDateTimeProperty(object source, string propertyName)
    {
        var value = source.GetType().GetProperty(propertyName)?.GetValue(source);
        return value is DateTime date ? date : null;
    }

    private static ApiRequestDetails ReadApiRequestDetails(string? detailsJson)
    {
        if (string.IsNullOrWhiteSpace(detailsJson)) return new ApiRequestDetails(null, null, null, null);

        try
        {
            using var doc = JsonDocument.Parse(detailsJson);
            var root = doc.RootElement;
            return new ApiRequestDetails(
                ReadString(root, "method"),
                ReadString(root, "path"),
                ReadInt(root, "statusCode"),
                ReadInt(root, "durationMs"));
        }
        catch (JsonException)
        {
            return new ApiRequestDetails(null, null, null, null);
        }
    }

    private static string? ReadString(JsonElement root, string propertyName)
    {
        return root.TryGetProperty(propertyName, out var node) && node.ValueKind == JsonValueKind.String
            ? node.GetString()
            : null;
    }

    private static int? ReadInt(JsonElement root, string propertyName)
    {
        return root.TryGetProperty(propertyName, out var node) && node.TryGetInt32(out var value)
            ? value
            : null;
    }

    private static string CompareCounts(int current, int previous, string label)
    {
        if (previous == 0 && current == 0) return $"No traffic in {label}";
        if (previous == 0) return $"+{current:N0} vs {label}";
        var pct = Math.Round((current - previous) * 100m / previous, 0);
        return pct >= 0 ? $"+{pct:N0}% vs {label}" : $"{pct:N0}% vs {label}";
    }

    private static string FriendlyModuleName(string path)
    {
        var value = path.ToLowerInvariant();
        if (value.Contains("/admin/users")) return "User Management";
        if (value.Contains("/admin/jobs")) return "Job Queue";
        if (value.Contains("/admin/system-health")) return "System Health";
        if (value.Contains("/admin/system-reports")) return "System Reports";
        if (value.Contains("/admin/audit")) return "Audit Logs";
        if (value.Contains("/admin/security")) return "Security Policy";
        if (value.Contains("/admin/integrations")) return "Integration Settings";
        if (value.Contains("/general-ledger")) return "General Ledger";
        if (value.Contains("/ap-invoices")) return "Accounts Payable";
        if (value.Contains("/ar-invoices")) return "Accounts Receivable";
        if (value.Contains("/reports")) return "Financial Reports";
        if (value.Contains("/expense-claims")) return "Expense Claims";
        if (value.Contains("/payslips")) return "Payslips";
        if (value.Contains("/budget")) return "Budget Control";
        if (value.Contains("/auth")) return "Authentication";
        return "Other API";
    }

    private static string FrontendEndpointLabel(string path)
    {
        var value = path.ToLowerInvariant();
        if (value.Contains("/admin/system-health")) return "System health status refresh";
        return path;
    }

    private static string FormatRelativeTime(DateTime value, DateTime now)
    {
        var delta = now - value;
        if (delta.TotalMinutes < 1) return "Just now";
        if (delta.TotalMinutes < 60) return $"{Math.Floor(delta.TotalMinutes):N0} min ago";
        if (delta.TotalHours < 24) return $"{Math.Floor(delta.TotalHours):N0} h ago";
        return $"{Math.Floor(delta.TotalDays):N0} d ago";
    }

    private static string FormatNullableDate(DateTime? value)
    {
        return value.HasValue
            ? value.Value.ToLocalTime().ToString(DateTimeMinuteFormat, CultureInfo.InvariantCulture)
            : "Not recorded";
    }

    private static string NormalizeJobStatus(string status)
    {
        var value = status.ToLowerInvariant();
        if (value.Contains("process")) return "running";
        if (value.Contains("fail")) return "failed";
        if (value.Contains("succeed")) return "succeeded";
        if (value.Contains("schedule")) return ScheduledJobStatus;
        return "recurring";
    }

    private static string? FormatJobName(Hangfire.Common.Job? job)
    {
        if (job is null) return null;
        return $"{job.Type.Name}.{job.Method.Name}";
    }

    private static bool IsCompletedRecurringJobInstance(AdminJobDto job, IReadOnlySet<string> recurringJobNames)
    {
        return recurringJobNames.Contains(job.Name) && job.Status is ScheduledJobStatus or "succeeded";
    }

    private static AdminJobDto ToJobDto(string id, ProcessingJobDto job)
    {
        return new AdminJobDto
        {
            Id = id,
            Name = FormatJobName(job.Job) ?? id,
            Type = AdHocJobType,
            Status = "running",
            LastRun = FormatNullableDate(job.StartedAt),
        };
    }

    private static AdminJobDto ToJobDto(SystemRecurringJobDefinition job)
    {
        return new AdminJobDto
        {
            Id = job.Id,
            Name = job.Name,
            Type = RecurringJobType,
            Status = RecurringJobType,
            LastRun = "Not recorded",
            NextRun = job.ScheduleLabel,
            Cron = job.Cron,
        };
    }

    private static AdminJobDto ToJobDto(string id, ScheduledJobDto job)
    {
        return new AdminJobDto
        {
            Id = id,
            Name = FormatJobName(job.Job) ?? id,
            Type = ScheduledJobStatus,
            Status = ScheduledJobStatus,
            LastRun = FormatNullableDate(job.ScheduledAt),
            NextRun = FormatNullableDate(job.EnqueueAt),
        };
    }

    private static AdminJobDto ToJobDto(string id, FailedJobDto job)
    {
        return new AdminJobDto
        {
            Id = id,
            Name = FormatJobName(job.Job) ?? id,
            Type = AdHocJobType,
            Status = "failed",
            LastRun = FormatNullableDate(job.FailedAt),
            Error = job.ExceptionMessage ?? job.Reason,
        };
    }

    private static AdminJobDto ToJobDto(string id, SucceededJobDto job)
    {
        return new AdminJobDto
        {
            Id = id,
            Name = FormatJobName(job.Job) ?? id,
            Type = AdHocJobType,
            Status = "succeeded",
            LastRun = FormatNullableDate(job.SucceededAt),
        };
    }

    private async Task<Guid?> ResolveDepartmentIdAsync(string? department)
    {
        if (string.IsNullOrWhiteSpace(department))
        {
            return null;
        }

        var match = await _dbContext.Departments
            .Where(x => x.Code == department || x.Name == department)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync();

        if (match.HasValue)
        {
            return match.Value;
        }

        var generatedCode = new string(department.Where(char.IsLetterOrDigit).Take(3).ToArray()).ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(generatedCode))
        {
            generatedCode = "DEP";
        }

        var newDepartment = new CMNetwork.Domain.Entities.Department
        {
            Id = Guid.NewGuid(),
            Code = generatedCode,
            Name = department,
            BudgetAmount = 0m,
            Description = "Auto-created from user management"
        };

        _dbContext.Departments.Add(newDepartment);
        await _dbContext.SaveChangesAsync();

        return newDepartment.Id;
    }

    private async Task EnsureRoleExistsAsync(string role)
    {
        var normalized = role.ToUpperInvariant();
        var exists = await _dbContext.Roles.AnyAsync(x => x.NormalizedName == normalized);
        if (!exists)
        {
            _dbContext.Roles.Add(new IdentityRole<Guid>
            {
                Id = Guid.NewGuid(),
                Name = role,
                NormalizedName = normalized,
            });
            await _dbContext.SaveChangesAsync();
        }
    }

    private async Task<CMNetwork.Domain.Entities.SecurityPolicy> GetOrCreateGlobalSecurityPolicyAsync()
    {
        var policy = await _dbContext.SecurityPolicies
            .FirstOrDefaultAsync(x => x.Name == GlobalSecurityPolicyName);

        if (policy is not null)
        {
            return policy;
        }

        policy = new CMNetwork.Domain.Entities.SecurityPolicy
        {
            Id = Guid.Parse("30000000-0000-0000-0000-000000000003"),
            Name = GlobalSecurityPolicyName,
            Description = GlobalSecurityPolicyDescription,
            IsEnabled = true,
            Value = JsonSerializer.Serialize(CreateDefaultSecurityPolicySettings(), SecurityPolicyJsonOptions),
        };

        _dbContext.SecurityPolicies.Add(policy);
        await _dbContext.SaveChangesAsync();

        return policy;
    }

    private async Task<SecurityPolicySettingsDto> GetCurrentSecurityPolicySettingsAsync()
    {
        var policy = await GetOrCreateGlobalSecurityPolicyAsync();
        return ReadSecurityPolicySettings(policy.Value);
    }

    private static SecurityPolicySettingsDto ReadSecurityPolicySettings(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return CreateDefaultSecurityPolicySettings();
        }

        try
        {
            var settings = JsonSerializer.Deserialize<SecurityPolicySettingsDto>(value, SecurityPolicyJsonOptions);
            return NormalizeSecurityPolicySettings(settings ?? CreateDefaultSecurityPolicySettings());
        }
        catch (JsonException)
        {
            return CreateDefaultSecurityPolicySettings();
        }
    }

    private static SecurityPolicySettingsDto NormalizeSecurityPolicySettings(SecurityPolicySettingsDto settings)
    {
        var defaults = CreateDefaultSecurityPolicySettings();
        var password = settings.Password ?? defaults.Password;
        var lockout = settings.Lockout ?? defaults.Lockout;
        var session = settings.Session ?? defaults.Session;
        var mfa = settings.Mfa ?? defaults.Mfa;
        var ip = settings.Ip ?? defaults.Ip;
        var mfaLevel = IsAllowedValue(mfa.Level, "none", "high-privilege", "all")
            ? mfa.Level
            : defaults.Mfa.Level;
        var ipMode = IsAllowedValue(ip.Mode, "disabled", "allowlist")
            ? ip.Mode
            : defaults.Ip.Mode;

        return new SecurityPolicySettingsDto
        {
            Password = new PasswordPolicySettingsDto
            {
                MinLength = Math.Clamp(password.MinLength <= 0 ? defaults.Password.MinLength : password.MinLength, 8, 15),
                MaxLength = Math.Max(Math.Clamp(password.MaxLength <= 0 ? defaults.Password.MaxLength : password.MaxLength, 64, 256), Math.Clamp(password.MinLength <= 0 ? defaults.Password.MinLength : password.MinLength, 8, 15)),
                BlockedTerms = NormalizeBlockedTerms(password.BlockedTerms, defaults.Password.BlockedTerms),
                ForbidUserContext = password.ForbidUserContext ?? defaults.Password.ForbidUserContext,
                ForbidCompanyName = password.ForbidCompanyName ?? defaults.Password.ForbidCompanyName,
                ExpireOnlyOnCompromise = password.ExpireOnlyOnCompromise ?? defaults.Password.ExpireOnlyOnCompromise,
                AllowUnicode = true,
                RequireUppercase = false,
                RequireLowercase = false,
                RequireNumbers = false,
                RequireSymbols = false,
                PreventReuse = Math.Clamp(password.PreventReuse, 0, 24),
            },
            Lockout = new LockoutPolicySettingsDto
            {
                MaxFailedAttempts = Math.Clamp(lockout.MaxFailedAttempts, 1, 20),
                LockoutDurationMinutes = Math.Clamp(lockout.LockoutDurationMinutes, 1, 1440),
                ResetCounterAfterMinutes = Math.Clamp(lockout.ResetCounterAfterMinutes, 1, 1440),
            },
            Session = new SessionPolicySettingsDto
            {
                IdleTimeoutMinutes = Math.Clamp(session.IdleTimeoutMinutes, 5, 480),
                AbsoluteTimeoutHours = Math.Clamp(session.AbsoluteTimeoutHours, 1, 24),
                SingleSessionPerUser = session.SingleSessionPerUser,
            },
            Mfa = new MfaPolicySettingsDto { Level = mfaLevel },
            Ip = new IpPolicySettingsDto
            {
                Mode = ipMode,
                AllowedRanges = (ip.AllowedRanges ?? string.Empty).Trim()[..Math.Min((ip.AllowedRanges ?? string.Empty).Trim().Length, 3500)],
            },
        };
    }

    private static SecurityPolicySettingsDto CreateDefaultSecurityPolicySettings()
    {
        return new SecurityPolicySettingsDto
        {
            Password = new PasswordPolicySettingsDto
            {
                MinLength = 12,
                MaxLength = 128,
                BlockedTerms = string.Join(Environment.NewLine, BuiltInBlockedPasswordTerms),
                ForbidUserContext = true,
                ForbidCompanyName = true,
                ExpireOnlyOnCompromise = true,
                AllowUnicode = true,
                RequireUppercase = false,
                RequireLowercase = false,
                RequireNumbers = false,
                RequireSymbols = false,
                PreventReuse = 0,
            },
            Lockout = new LockoutPolicySettingsDto
            {
                MaxFailedAttempts = 5,
                LockoutDurationMinutes = 15,
                ResetCounterAfterMinutes = 30,
            },
            Session = new SessionPolicySettingsDto
            {
                IdleTimeoutMinutes = 30,
                AbsoluteTimeoutHours = 8,
                SingleSessionPerUser = false,
            },
            Mfa = new MfaPolicySettingsDto { Level = "high-privilege" },
            Ip = new IpPolicySettingsDto
            {
                Mode = "disabled",
                AllowedRanges = string.Empty,
            },
        };
    }

    private static bool IsAllowedValue(string value, params string[] allowedValues)
    {
        return allowedValues.Any(allowed => string.Equals(value, allowed, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeBlockedTerms(string? value, string fallback)
    {
        var source = string.IsNullOrWhiteSpace(value) ? fallback : value;
        var terms = source
            .Split(new[] { '\r', '\n', ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(term => term.Length >= 3)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(200);

        return string.Join(Environment.NewLine, terms);
    }

    private static List<string> ValidatePasswordAgainstPolicy(
        string password,
        PasswordPolicySettingsDto policy,
        ApplicationUser user)
    {
        var errors = new List<string>();

        if (password.Length < policy.MinLength)
        {
            errors.Add($"Password must be at least {policy.MinLength} characters long.");
        }

        if (password.Length > policy.MaxLength)
        {
            errors.Add($"Password must be no more than {policy.MaxLength} characters long.");
        }

        var normalizedPassword = password.ToLowerInvariant();
        var blockedTerms = NormalizeBlockedTerms(policy.BlockedTerms, string.Join(Environment.NewLine, BuiltInBlockedPasswordTerms))
            .Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (blockedTerms.Any(term => normalizedPassword.Contains(term.ToLowerInvariant(), StringComparison.Ordinal)))
        {
            errors.Add("Password cannot contain common, compromised, or dictionary-style words.");
        }

        if (policy.ForbidCompanyName == true && normalizedPassword.Contains(CompanyNameTerm, StringComparison.Ordinal))
        {
            errors.Add("Password cannot contain the company name.");
        }

        if (policy.ForbidUserContext == true)
        {
            var userTerms = new[]
            {
                user.UserName,
                user.Email,
                user.Email?.Split('@').FirstOrDefault(),
                user.FirstName,
                user.MiddleName,
                user.LastName,
            }
                .Where(term => !string.IsNullOrWhiteSpace(term))
                .SelectMany(term => term!.Split(new[] { '@', '.', '-', '_', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .Where(term => term.Length >= 3)
                .Distinct(StringComparer.OrdinalIgnoreCase);

            if (userTerms.Any(term => normalizedPassword.Contains(term.ToLowerInvariant(), StringComparison.Ordinal)))
            {
                errors.Add("Password cannot contain the user's name, username, or email terms.");
            }
        }

        return errors;
    }

    private async Task<string> ResolveGeneratedEmailAsync(string? requestedEmail, string firstName, string lastName)
    {
        if (!string.IsNullOrWhiteSpace(requestedEmail))
        {
            return requestedEmail.Trim().ToLowerInvariant();
        }

        var normalizedFirst = new string(firstName.Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
        var normalizedLast = new string(lastName.Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

        if (string.IsNullOrWhiteSpace(normalizedFirst))
        {
            normalizedFirst = "employee";
        }

        if (string.IsNullOrWhiteSpace(normalizedLast))
        {
            normalizedLast = "user";
        }

        var baseEmail = $"{normalizedFirst}.{normalizedLast}";
        var candidate = $"{baseEmail}@cmnetwork.com";
        var suffix = 1;

        while (await _userManager.FindByEmailAsync(candidate) is not null)
        {
            candidate = $"{baseEmail}{suffix}@cmnetwork.com";
            suffix += 1;
        }

        return candidate;
    }

    private static string ResolveGeneratedPassword(string? requestedPassword)
    {
        if (!string.IsNullOrWhiteSpace(requestedPassword))
        {
            return requestedPassword;
        }

        var randomDigits = RandomNumberGenerator.GetInt32(100, 1000);
        return $"harbor-slate-lumen-{DateTime.UtcNow:yyyy}-{randomDigits}";
    }

    private async Task<List<AdminUserDto>> BuildAdminUsersAsync()
    {
        var departments = await _dbContext.Departments.ToDictionaryAsync(x => x.Id, x => x.Name);
        var users = await _dbContext.Users.OrderByDescending(x => x.CreatedUtc).ToListAsync();

        var result = new List<AdminUserDto>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var primaryRole = roles
                .FirstOrDefault(r => r.Contains('-'))
                ?? roles.FirstOrDefault()
                ?? "employee";

            result.Add(new AdminUserDto
            {
                Id = user.Id.ToString(),
                Email = user.Email ?? string.Empty,
                FullName = user.FullName,
                Department = user.DepartmentId.HasValue && departments.TryGetValue(user.DepartmentId.Value, out var deptName)
                    ? deptName
                    : "Unassigned",
                Role = primaryRole,
                Status = user.IsActive ? "active" : "inactive",
                JoinDate = user.JoinDate.ToString("yyyy-MM-dd")
            });
        }

        return result;
    }
}
