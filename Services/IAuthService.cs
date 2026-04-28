using CMNetwork.Models;

namespace CMNetwork.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<TokenValidationResponse> ValidateTokenAsync(string token);
    Task LogoutAsync(string token);
    string GenerateJwtToken(UserDto user);
}
