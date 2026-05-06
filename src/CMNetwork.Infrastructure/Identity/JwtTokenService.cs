using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CMNetwork.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CMNetwork.Infrastructure.Identity;

public class JwtTokenService
{
    private readonly IConfiguration _configuration;
    private readonly UserManager<ApplicationUser> _userManager;

    public JwtTokenService(IConfiguration configuration, UserManager<ApplicationUser> userManager)
    {
        _configuration = configuration;
        _userManager = userManager;
    }

    public async Task<string> GenerateAccessTokenAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var primaryRole = roles.FirstOrDefault() ?? "employee";

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("fullName",     user.FullName),
            new("role",         primaryRole),
            new("departmentId", user.DepartmentId?.ToString() ?? string.Empty),
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var secret = _configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expiry = DateTime.UtcNow.AddMinutes(
            int.TryParse(_configuration["Jwt:AccessTokenMinutes"], out var m) ? m : 15);

        var token = new JwtSecurityToken(
            issuer:             _configuration["Jwt:Issuer"] ?? "cmnetwork",
            audience:           _configuration["Jwt:Audience"] ?? "cmnetwork-client",
            claims:             claims,
            notBefore:          DateTime.UtcNow,
            expires:            expiry,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public RefreshToken GenerateRefreshToken(Guid userId, string? ipAddress = null)
    {
        return new RefreshToken
        {
            Id           = Guid.NewGuid(),
            UserId       = userId,
            Token        = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
            ExpiresUtc   = DateTime.UtcNow.AddDays(7),
            CreatedUtc   = DateTime.UtcNow,
            CreatedByIp  = ipAddress,
        };
    }
}
