using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CurrentCustomerService : ICurrentCustomerService
{
    private readonly IHttpContextAccessor _accessor;
    private readonly CMNetworkDbContext _db;

    public CurrentCustomerService(IHttpContextAccessor accessor, CMNetworkDbContext db)
    {
        _accessor = accessor;
        _db = db;
    }

    public Guid? CustomerId
    {
        get
        {
            var principal = _accessor.HttpContext?.User;
            if (principal?.Identity?.IsAuthenticated != true)
            {
                return null;
            }

            var claim = principal.FindFirstValue("customerId")
                ?? principal.FindFirstValue("customer_id");

            if (Guid.TryParse(claim, out var customerId))
            {
                return customerId;
            }

            // Fallback for older tokens: infer by account email.
            var email = principal.FindFirstValue(JwtRegisteredClaimNames.Email)
                ?? principal.FindFirstValue(ClaimTypes.Email);

            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return _db.Customers
                .Where(x => x.Email != null && x.Email.ToLower() == email.ToLower())
                .Select(x => (Guid?)x.Id)
                .FirstOrDefault();
        }
    }

    public bool HasCustomerScope => CustomerId.HasValue;
}
