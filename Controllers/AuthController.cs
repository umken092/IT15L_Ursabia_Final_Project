using CMNetwork.Models;
using CMNetwork.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { message = "Invalid request", errors = ModelState.Values.SelectMany(v => v.Errors) });
            }

            var response = await _authService.LoginAsync(request);
            if (response == null)
            {
                _logger.LogWarning($"Login failed for email: {request.Email}");
                return Unauthorized(new { message = "Invalid email or password" });
            }

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Login error: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred during login" });
        }
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        try
        {
            var token = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
            await _authService.LogoutAsync(token);
            return Ok(new { message = "Logged out successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Logout error: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred during logout" });
        }
    }

    [HttpPost("validate")]
    public async Task<IActionResult> ValidateToken([FromBody] TokenValidationRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest(new { message = "Token is required" });
            }

            var response = await _authService.ValidateTokenAsync(request.Token);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Token validation error: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred during token validation" });
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "Auth service is healthy", timestamp = DateTime.UtcNow });
    }
}
