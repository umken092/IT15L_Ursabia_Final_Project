using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace CMNetwork.Infrastructure.Identity;

/// <summary>
/// Normalizes PascalCase role claims (e.g. "FacultyAdmin") to the lowercase-hyphen
/// form expected by all [Authorize(Roles = ...)] attributes (e.g. "faculty-admin").
/// This allows users whose accounts were assigned either naming convention to pass
/// authorization checks consistently.
/// </summary>
public class RoleNormalizationTransformation : IClaimsTransformation
{
    private static readonly Dictionary<string, string> RoleMap =
        new(StringComparer.OrdinalIgnoreCase)
        {
            { "SuperAdmin",      "super-admin" },
            { "FacultyAdmin",    "faculty-admin" },
            { "Accountant",      "accountant" },
            { "Auditor",         "auditor" },
            { "Employee",        "employee" },
            { "CFO",             "cfo" },
            { "AuthorizedViewer","authorized-viewer" },
            { "BudgetManager",   "budget-manager" },
            { "BudgetOfficer",   "budget-officer" },
            { "Vendor",          "vendor" },
        };

    /// <summary>
    /// Returns the canonical lowercase-hyphen form of a role name.
    /// Unknown roles are returned as-is lowercased.
    /// </summary>
    public static string Normalize(string role) =>
        RoleMap.TryGetValue(role, out var mapped) ? mapped : role.ToLowerInvariant();

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identity)
            return Task.FromResult(principal);

        var roleClaims = identity.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .ToList();

        foreach (var claim in roleClaims)
        {
            if (RoleMap.TryGetValue(claim.Value, out var normalized) &&
                normalized != claim.Value)
            {
                identity.RemoveClaim(claim);
                identity.AddClaim(new Claim(ClaimTypes.Role, normalized));
            }
        }

        return Task.FromResult(principal);
    }
}
