using System.Security.Claims;
using System.Text;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using CMNetwork.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string SmtpSettingsPolicyName = "smtp-settings";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IAuthService _authService;
    private readonly IAuditEventLogger _audit;
    private readonly ILogger<AuthController> _logger;
    private readonly RuntimeHealthStatus _runtimeHealth;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly CMNetworkDbContext _dbContext;
    private readonly IEmailService _emailService;

    public AuthController(
        IAuthService authService,
        IAuditEventLogger audit,
        ILogger<AuthController> logger,
        RuntimeHealthStatus runtimeHealth,
        UserManager<ApplicationUser> userManager,
        CMNetworkDbContext dbContext,
        IEmailService emailService)
    {
        _authService = authService;
        _audit       = audit;
        _logger      = logger;
        _runtimeHealth = runtimeHealth;
        _userManager = userManager;
        _dbContext = dbContext;
        _emailService = emailService;
    }

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid request" });

        var ip       = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _authService.LoginAsync(request, ip);

        if (response is null)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "LoginFailed",
                category: AuditCategories.Login,
                details: new { email = request.Email, reason = "InvalidCredentialsOrLocked" },
                performedByOverride: request.Email,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);
            return Unauthorized(new { message = "Invalid credentials or account locked." });
        }

        if (response.RequiresMfa)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "LoginMfaChallenge",
                category: AuditCategories.Login,
                details: new { email = request.Email },
                performedByOverride: request.Email,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);
            return Ok(new { requiresMfa = true, mfaSessionToken = response.MfaSessionToken, email = request.Email });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "LoginSucceeded",
            category: AuditCategories.Login,
            recordId: response.User.Id,
            details: new { email = response.User.Email, role = response.User.Role },
            performedByOverride: response.User.Id,
            userEmailOverride: response.User.Email,
            ipAddressOverride: ip);

        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? body)
    {
        if (!string.IsNullOrWhiteSpace(body?.RefreshToken))
            await _authService.RevokeRefreshTokenAsync(body.RefreshToken);

        await _audit.LogAsync(
            entityName: "Auth",
            action: "Logout",
            category: AuditCategories.Logout,
            recordId: User.FindFirstValue(JwtRegisteredClaimNames.Sub));

        return Ok(new { message = "Logged out successfully." });
    }

    [HttpPost("validate")]
    public async Task<IActionResult> ValidateToken([FromBody] TokenValidationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { message = "Token is required." });

        var response = await _authService.ValidateTokenAsync(request.Token);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "Refresh token is required." });

        var ip     = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.RefreshTokenAsync(request.RefreshToken, ip);

        if (result is null)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "RefreshTokenRejected",
                category: AuditCategories.Auth,
                details: new { reason = "InvalidOrExpired" },
                ipAddressOverride: ip);
            return Unauthorized(new { message = "Invalid or expired refresh token." });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "RefreshTokenIssued",
            category: AuditCategories.Auth,
            ipAddressOverride: ip);

        return Ok(result);
    }

    [HttpGet("mfa/setup")]
    [Authorize]
    public async Task<IActionResult> MfaSetup()
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId is null) return Unauthorized();

        var result = await _authService.GetMfaSetupAsync(userId);
        return Ok(result);
    }

    [HttpPost("mfa/enable")]
    [Authorize]
    public async Task<IActionResult> MfaEnable([FromBody] MfaEnableRequest request)
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId is null) return Unauthorized();

        var ok = await _authService.EnableMfaAsync(userId, request.Code);
        if (!ok) return BadRequest(new { message = "Invalid verification code." });

        await _audit.LogAsync(
            entityName: "Auth",
            action: "MfaEnabled",
            category: AuditCategories.Security,
            recordId: userId);

        return Ok(new { message = "Two-factor authentication enabled." });
    }

    [HttpPost("mfa/verify")]
    public async Task<IActionResult> MfaVerify([FromBody] MfaVerifyRequest request)
    {
        var ip     = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.VerifyMfaAndLoginAsync(request, ip);

        if (result is null)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "MfaVerificationFailed",
                category: AuditCategories.Login,
                details: new { email = request.Email },
                performedByOverride: request.Email,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);
            return Unauthorized(new { message = "Invalid MFA code." });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "MfaLoginSucceeded",
            category: AuditCategories.Login,
            recordId: result.User.Id,
            details: new { email = result.User.Email },
            performedByOverride: result.User.Id,
            userEmailOverride: result.User.Email,
            ipAddressOverride: ip);

        return Ok(result);
    }

    [HttpPost("mfa/disable")]
    [Authorize]
    public async Task<IActionResult> MfaDisable([FromBody] MfaDisableRequest request)
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId is null) return Unauthorized();

        var ok = await _authService.DisableMfaAsync(userId, request.Password);
        if (!ok) return BadRequest(new { message = "Invalid password." });

        await _audit.LogAsync(
            entityName: "Auth",
            action: "MfaDisabled",
            category: AuditCategories.Security,
            recordId: userId);

        return Ok(new { message = "Two-factor authentication disabled." });
    }

    [HttpPost("password/forgot")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required." });
        }

        var normalizedEmail = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user is not null && user.IsActive)
        {
            var smtpSettings = await GetSmtpSettingsAsync();
            if (smtpSettings is not null)
            {
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
                var resetUrl = BuildResetUrl(request.ResetUrl, normalizedEmail, encodedToken);

                var body = $"""
                           Hello {user.FullName},

                           We received a request to reset your CMNetwork password.
                           Use the link below to continue:

                           {resetUrl}

                           If you did not request this, you can ignore this email.
                           """;

                var sendResult = await _emailService.SendEmailAsync(
                    smtpSettings,
                    recipientEmail: normalizedEmail,
                    subject: "CMNetwork password reset",
                    body: body,
                    isBodyHtml: false,
                    recipientName: user.FullName);

                if (!sendResult.Success)
                {
                    _logger.LogWarning("Forgot-password email send failed for {Email}: {Message}", normalizedEmail, sendResult.Message);
                }
            }
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "PasswordResetRequested",
            category: AuditCategories.Security,
            details: new { email = normalizedEmail },
            performedByOverride: normalizedEmail,
            userEmailOverride: normalizedEmail,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new { message = "If the account exists, a password reset email has been sent." });
    }

    [HttpPost("password/reset")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email)
            || string.IsNullOrWhiteSpace(request.Token)
            || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Email, token, and new password are required." });
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive)
        {
            return BadRequest(new { message = "Invalid reset request." });
        }

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token.Trim()));
        }
        catch
        {
            return BadRequest(new { message = "Invalid reset token." });
        }

        var result = await _userManager.ResetPasswordAsync(user, decodedToken, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = string.Join(" ", result.Errors.Select(x => x.Description)) });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "PasswordReset",
            category: AuditCategories.Security,
            recordId: user.Id.ToString(),
            details: new { email = user.Email },
            performedByOverride: user.Id.ToString(),
            userEmailOverride: user.Email,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new { message = "Password reset successful." });
    }

    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new
        {
            status = _runtimeHealth.DatabaseAvailable ? "healthy" : "degraded",
            service = "Auth service is running",
            timestamp = DateTime.UtcNow,
            startedUtc = _runtimeHealth.StartedUtc,
            database = new
            {
                available = _runtimeHealth.DatabaseAvailable,
                message = _runtimeHealth.DatabaseStatusMessage
            },
            hangfire = new
            {
                enabled = _runtimeHealth.HangfireEnabled,
                started = _runtimeHealth.HangfireStarted
            }
        });

    private async Task<SmtpSettingsDto?> GetSmtpSettingsAsync()
    {
        var policy = await _dbContext.SecurityPolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Name == SmtpSettingsPolicyName);

        if (policy is null || string.IsNullOrWhiteSpace(policy.Value))
        {
            return null;
        }

        try
        {
            var dto = JsonSerializer.Deserialize<SmtpSettingsDto>(policy.Value, JsonOptions);
            if (dto is null || string.IsNullOrWhiteSpace(dto.Host) || string.IsNullOrWhiteSpace(dto.FromEmail))
            {
                return null;
            }

            return dto;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildResetUrl(string? resetUrl, string email, string token)
    {
        if (string.IsNullOrWhiteSpace(resetUrl))
        {
            return $"https://example.invalid/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
        }

        var separator = resetUrl.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        return $"{resetUrl}{separator}email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
    }
}
