using CMNetwork.Models;

namespace CMNetwork.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request, string? ipAddress = null);
    Task<TokenValidationResponse> ValidateTokenAsync(string token);
    Task LogoutAsync(string token);
    Task<RefreshTokenResponse?> RefreshTokenAsync(string refreshToken, string? ipAddress = null);
    Task RevokeRefreshTokenAsync(string refreshToken);
    Task<MfaSetupResponse> GetMfaSetupAsync(string userId);
    Task<bool> EnableMfaAsync(string userId, string code);
    Task<LoginResponse?> VerifyMfaAndLoginAsync(MfaVerifyRequest request, string? ipAddress = null);
    Task<bool> DisableMfaAsync(string userId, string password);
}
