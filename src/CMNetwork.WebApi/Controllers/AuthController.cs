using System.Security.Claims;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Models;
using CMNetwork.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IAuditEventLogger _audit;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, IAuditEventLogger audit, ILogger<AuthController> logger)
    {
        _authService = authService;
        _audit       = audit;
        _logger      = logger;
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

    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new { status = "Auth service is healthy", timestamp = DateTime.UtcNow });
}
