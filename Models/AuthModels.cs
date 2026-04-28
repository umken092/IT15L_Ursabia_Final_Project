namespace CMNetwork.Models;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; } = new();
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public string? DepartmentId { get; set; }
}

public class TokenValidationRequest
{
    public string Token { get; set; } = string.Empty;
}

public class TokenValidationResponse
{
    public bool IsValid { get; set; }
    public UserDto? User { get; set; }
}

public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
}
