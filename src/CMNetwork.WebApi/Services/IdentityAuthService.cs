using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CMNetwork.Services;

public class IdentityAuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly JwtTokenService _jwtTokenService;
    private readonly CMNetworkDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<IdentityAuthService> _logger;

    public IdentityAuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        JwtTokenService jwtTokenService,
        CMNetworkDbContext db,
        IConfiguration configuration,
        ILogger<IdentityAuthService> logger)
    {
        _userManager    = userManager;
        _signInManager  = signInManager;
        _jwtTokenService = jwtTokenService;
        _db             = db;
        _configuration  = configuration;
        _logger         = logger;
    }

    // ── Login ────────────────────────────────────────────────────────────────
    public async Task<LoginResponse?> LoginAsync(LoginRequest request, string? ipAddress = null)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || !user.IsActive)
        {
            _logger.LogWarning("Login failed for {Email}: user not found or inactive", request.Email);
            return null;
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            _logger.LogWarning("Login failed for {Email}: bad password or locked", request.Email);
            return null;
        }

        // MFA required?
        if (user.TwoFactorEnabled)
        {
            var mfaSessionToken = await _userManager.GenerateTwoFactorTokenAsync(user, "MfaSession");
            return new LoginResponse
            {
                RequiresMfa     = true,
                MfaSessionToken = mfaSessionToken,
                User            = await BuildUserDtoAsync(user),
            };
        }

        return await BuildAuthResponseAsync(user, ipAddress);
    }

    // ── MFA verify + complete login ──────────────────────────────────────────
    public async Task<LoginResponse?> VerifyMfaAndLoginAsync(MfaVerifyRequest request, string? ipAddress = null)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null) return null;

        var isValid = await _userManager.VerifyTwoFactorTokenAsync(
            user, TokenOptions.DefaultAuthenticatorProvider, request.Code);

        if (!isValid)
        {
            _logger.LogWarning("MFA verify failed for {Email}", request.Email);
            return null;
        }

        return await BuildAuthResponseAsync(user, ipAddress);
    }

    // ── Token validation ─────────────────────────────────────────────────────
    public Task<TokenValidationResponse> ValidateTokenAsync(string token)
    {
        var secret = _configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret missing");

        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey        = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer          = false,
                ValidateAudience        = false,
                ClockSkew               = TimeSpan.Zero
            }, out _);

            var userId   = principal.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? string.Empty;
            var email    = principal.FindFirstValue(JwtRegisteredClaimNames.Email) ?? string.Empty;
            var fullName = principal.FindFirstValue("fullName") ?? string.Empty;
            var role     = principal.FindFirstValue("role") ?? string.Empty;
            var deptId   = principal.FindFirstValue("departmentId");
            var roles    = principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

            return Task.FromResult(new TokenValidationResponse
            {
                IsValid = true,
                User    = new UserDto
                {
                    Id           = userId,
                    Email        = email,
                    FullName     = fullName,
                    Role         = role,
                    Roles        = roles,
                    DepartmentId = string.IsNullOrEmpty(deptId) ? null : deptId,
                }
            });
        }
        catch
        {
            return Task.FromResult(new TokenValidationResponse { IsValid = false });
        }
    }

    // ── Logout ───────────────────────────────────────────────────────────────
    public async Task LogoutAsync(string token)
    {
        // Refresh tokens are revoked; access tokens expire naturally
        await Task.CompletedTask;
    }

    // ── Refresh token ────────────────────────────────────────────────────────
    public async Task<RefreshTokenResponse?> RefreshTokenAsync(string refreshToken, string? ipAddress = null)
    {
        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == refreshToken);

        if (stored is null || !stored.IsActive)
        {
            _logger.LogWarning("Refresh token invalid or expired");
            return null;
        }

        // Rotate: revoke old, issue new
        stored.IsRevoked    = true;
        stored.RevokedUtc   = DateTime.UtcNow;
        stored.RevokedReason = "Replaced";

        var newRefresh = _jwtTokenService.GenerateRefreshToken(stored.UserId, ipAddress);
        stored.ReplacedByToken = newRefresh.Token;
        _db.RefreshTokens.Add(newRefresh);

        var accessToken = await _jwtTokenService.GenerateAccessTokenAsync(stored.User);
        stored.User.LastLoginUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new RefreshTokenResponse
        {
            AccessToken  = accessToken,
            RefreshToken = newRefresh.Token
        };
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken)
    {
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.Token == refreshToken);
        if (stored is null || !stored.IsActive) return;

        stored.IsRevoked    = true;
        stored.RevokedUtc   = DateTime.UtcNow;
        stored.RevokedReason = "Revoked by user";
        await _db.SaveChangesAsync();
    }

    // ── MFA setup ────────────────────────────────────────────────────────────
    public async Task<MfaSetupResponse> GetMfaSetupAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found");

        await _userManager.ResetAuthenticatorKeyAsync(user);
        var key = await _userManager.GetAuthenticatorKeyAsync(user)
            ?? throw new InvalidOperationException("Could not generate authenticator key");

        var uri = GenerateQrCodeUri(user.Email!, key);
        return new MfaSetupResponse { SharedKey = key, AuthenticatorUri = uri };
    }

    public async Task<bool> EnableMfaAsync(string userId, string code)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return false;

        var isValid = await _userManager.VerifyTwoFactorTokenAsync(
            user, TokenOptions.DefaultAuthenticatorProvider, code);

        if (!isValid) return false;

        await _userManager.SetTwoFactorEnabledAsync(user, true);
        return true;
    }

    public async Task<bool> DisableMfaAsync(string userId, string password)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return false;

        var passwordOk = await _userManager.CheckPasswordAsync(user, password);
        if (!passwordOk) return false;

        await _userManager.SetTwoFactorEnabledAsync(user, false);
        await _userManager.ResetAuthenticatorKeyAsync(user);
        return true;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private async Task<LoginResponse> BuildAuthResponseAsync(ApplicationUser user, string? ipAddress)
    {
        var accessToken   = await _jwtTokenService.GenerateAccessTokenAsync(user);
        var refreshToken  = _jwtTokenService.GenerateRefreshToken(user.Id, ipAddress);
        _db.RefreshTokens.Add(refreshToken);
        user.LastLoginUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new LoginResponse
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken.Token,
            User         = await BuildUserDtoAsync(user),
        };
    }

    private async Task<UserDto> BuildUserDtoAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var normalizedRoles = roles
            .Select(RoleNormalizationTransformation.Normalize)
            .ToList();
        return new UserDto
        {
            Id               = user.Id.ToString(),
            Email            = user.Email!,
            FullName         = user.FullName,
            Role             = normalizedRoles.FirstOrDefault() ?? "employee",
            Roles            = normalizedRoles,
            DepartmentId     = user.DepartmentId?.ToString(),
            TwoFactorEnabled = user.TwoFactorEnabled,
        };
    }

    private static string GenerateQrCodeUri(string email, string key)
    {
        const string issuer = "CMNetwork ERP";
        return $"otpauth://totp/{UrlEncoder.Default.Encode(issuer)}:{UrlEncoder.Default.Encode(email)}" +
               $"?secret={key}&issuer={UrlEncoder.Default.Encode(issuer)}&digits=6&period=30";
    }
}
