using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace CMNetwork.Infrastructure.Services;

public sealed class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUserService(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public string? UserId =>
        Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

    public string? UserEmail =>
        Principal?.FindFirstValue(JwtRegisteredClaimNames.Email)
        ?? Principal?.FindFirstValue(ClaimTypes.Email);

    public string? IpAddress
    {
        get
        {
            var ctx = _accessor.HttpContext;
            if (ctx is null) return null;

            // Honour standard reverse-proxy header when present.
            if (ctx.Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded) &&
                !string.IsNullOrWhiteSpace(forwarded))
            {
                return forwarded.ToString().Split(',')[0].Trim();
            }

            return ctx.Connection.RemoteIpAddress?.ToString();
        }
    }

    public string? UserAgent
    {
        get
        {
            var ctx = _accessor.HttpContext;
            if (ctx is null) return null;
            var ua = ctx.Request.Headers.UserAgent.ToString();
            return string.IsNullOrWhiteSpace(ua) ? null : ua;
        }
    }

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public string DisplayName => UserEmail ?? UserId ?? "system";
}
