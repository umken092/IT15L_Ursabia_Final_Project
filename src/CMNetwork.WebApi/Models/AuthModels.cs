namespace CMNetwork.Models;

// ── Login ────────────────────────────────────────────────────────────────────
public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? RecaptchaToken { get; set; }
    public string? MfaCode { get; set; }
}

public class LoginResponse
{
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public bool RequiresMfa { get; set; }
    public string? MfaSessionToken { get; set; }
    public UserDto User { get; set; } = new();

    // backward-compat alias
    public string Token => AccessToken ?? string.Empty;
}

// ── User DTO ─────────────────────────────────────────────────────────────────
public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public string? DepartmentId { get; set; }
    public bool TwoFactorEnabled { get; set; }
}

// ── Token ────────────────────────────────────────────────────────────────────
public class TokenValidationRequest
{
    public string Token { get; set; } = string.Empty;
}

public class TokenValidationResponse
{
    public bool IsValid { get; set; }
    public UserDto? User { get; set; }
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class RefreshTokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
}

// ── MFA ──────────────────────────────────────────────────────────────────────
public class MfaSetupResponse
{
    public string SharedKey { get; set; } = string.Empty;
    public string AuthenticatorUri { get; set; } = string.Empty;
}

public class MfaEnableRequest
{
    public string Code { get; set; } = string.Empty;
}

public class MfaVerifyRequest
{
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string MfaSessionToken { get; set; } = string.Empty;
}

public class MfaDisableRequest
{
    public string Password { get; set; } = string.Empty;
}

// ── Generic ──────────────────────────────────────────────────────────────────
public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
}
