using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CMNetwork.Models;
using Microsoft.IdentityModel.Tokens;

namespace CMNetwork.Services;

public class AuthService : IAuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly Dictionary<string, UserDto> _users;
    private readonly HashSet<string> _revokedTokens;

    public AuthService(IConfiguration configuration, ILogger<AuthService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _revokedTokens = new HashSet<string>();

        // Mock users with roles
        _users = new Dictionary<string, UserDto>
        {
            {
                "super-admin@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "super-admin@cmnetwork.com",
                    FullName = "System Administrator",
                    Role = "super-admin",
                    Roles = new List<string> { "super-admin" },
                    DepartmentId = null
                }
            },
            {
                "accountant@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "accountant@cmnetwork.com",
                    FullName = "John Accountant",
                    Role = "accountant",
                    Roles = new List<string> { "accountant" },
                    DepartmentId = "dept-001"
                }
            },
            {
                "faculty-admin@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "faculty-admin@cmnetwork.com",
                    FullName = "Dr. Faculty Admin",
                    Role = "faculty-admin",
                    Roles = new List<string> { "faculty-admin" },
                    DepartmentId = "dept-002"
                }
            },
            {
                "employee@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "employee@cmnetwork.com",
                    FullName = "Jane Employee",
                    Role = "employee",
                    Roles = new List<string> { "employee" },
                    DepartmentId = "dept-003"
                }
            },
            {
                "viewer@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "viewer@cmnetwork.com",
                    FullName = "Bob Viewer",
                    Role = "authorized-viewer",
                    Roles = new List<string> { "authorized-viewer" },
                    DepartmentId = "dept-004"
                }
            },
            {
                "auditor@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "auditor@cmnetwork.com",
                    FullName = "Alice Auditor",
                    Role = "auditor",
                    Roles = new List<string> { "auditor" },
                    DepartmentId = null
                }
            },
            {
                "cfo@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "cfo@cmnetwork.com",
                    FullName = "Chief Financial Officer",
                    Role = "cfo",
                    Roles = new List<string> { "cfo" },
                    DepartmentId = null
                }
            },
            {
                "multi-cfo-accountant@cmnetwork.com",
                new UserDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = "multi-cfo-accountant@cmnetwork.com",
                    FullName = "Multi-Role User",
                    Role = "cfo",
                    Roles = new List<string> { "cfo", "accountant" },
                    DepartmentId = "dept-001"
                }
            }
        };
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        try
        {
            // Simulate async operation
            await Task.Delay(500);

            // Validate credentials
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                _logger.LogWarning("Login attempt with empty credentials");
                return null;
            }

            var email = request.Email.ToLowerInvariant();
            UserDto? user = null;

            // Try exact match first
            if (_users.TryGetValue(email, out var exactMatch))
            {
                user = exactMatch;
            }
            else
            {
                // Infer roles from email (for flexibility)
                user = InferUserFromEmail(email);
            }

            if (user == null)
            {
                _logger.LogWarning($"Login failed for email: {email}");
                return null;
            }

            // In production, validate password hash
            // For now, accept any non-empty password
            if (request.Password.Length < 1)
                return null;

            var token = GenerateJwtToken(user);

            return new LoginResponse
            {
                Token = token,
                User = user
            };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Login error: {ex.Message}");
            return null;
        }
    }

    public async Task<TokenValidationResponse> ValidateTokenAsync(string token)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token))
                return new TokenValidationResponse { IsValid = false };

            if (_revokedTokens.Contains(token))
                return new TokenValidationResponse { IsValid = false };

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Secret"] ?? "fallback-secret-key-change-in-production");

            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = false,
                ClockSkew = TimeSpan.Zero
            }, out SecurityToken validatedToken);

            var jwtToken = (JwtSecurityToken)validatedToken;
            var emailClaim = jwtToken.Claims.FirstOrDefault(x => x.Type == ClaimTypes.Email)?.Value;

            if (emailClaim == null)
                return new TokenValidationResponse { IsValid = false };

            var userEmail = emailClaim.ToLowerInvariant();
            UserDto? user = null;

            if (_users.TryGetValue(userEmail, out var exactMatch))
            {
                user = exactMatch;
            }
            else
            {
                user = InferUserFromEmail(userEmail);
            }

            return user != null
                ? new TokenValidationResponse { IsValid = true, User = user }
                : new TokenValidationResponse { IsValid = false };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Token validation error: {ex.Message}");
            return new TokenValidationResponse { IsValid = false };
        }
    }

    public async Task LogoutAsync(string token)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(token))
            {
                _revokedTokens.Add(token);
                await Task.Delay(100); // Simulate async operation
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Logout error: {ex.Message}");
        }
    }

    public string GenerateJwtToken(UserDto user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Secret"] ?? "fallback-secret-key-change-in-production");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim("Role", user.Role)
        };

        // Add all roles as claims
        foreach (var role in user.Roles)
        {
            claims.Add(new Claim("roles", role));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(24),
            Issuer = _configuration["Jwt:Issuer"] ?? "cmnetwork",
            Audience = _configuration["Jwt:Audience"] ?? "cmnetwork-client",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private UserDto? InferUserFromEmail(string email)
    {
        // Infer roles from email keywords
        var roles = new List<string>();

        if (email.Contains("admin")) roles.Add("super-admin");
        if (email.Contains("accountant")) roles.Add("accountant");
        if (email.Contains("faculty")) roles.Add("faculty-admin");
        if (email.Contains("employee")) roles.Add("employee");
        if (email.Contains("viewer")) roles.Add("authorized-viewer");
        if (email.Contains("auditor")) roles.Add("auditor");
        if (email.Contains("cfo")) roles.Add("cfo");

        if (roles.Count == 0)
            roles.Add("employee"); // Default role

        var primaryRole = roles[0];

        return new UserDto
        {
            Id = Guid.NewGuid().ToString(),
            Email = email,
            FullName = ExtractNameFromEmail(email),
            Role = primaryRole,
            Roles = roles,
            DepartmentId = "dept-001"
        };
    }

    private string ExtractNameFromEmail(string email)
    {
        var namePart = email.Split('@')[0];
        return string.Concat(namePart.Select(c => char.IsUpper(c) ? " " + c : c.ToString())).TrimStart();
    }
}
