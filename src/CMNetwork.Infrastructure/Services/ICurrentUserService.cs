namespace CMNetwork.Infrastructure.Services;

/// <summary>
/// Resolves contextual information about the user making the current
/// request. Falls back to "system" / null values when invoked outside an
/// HTTP request (e.g. background jobs, seeders).
/// </summary>
public interface ICurrentUserService
{
    /// <summary>The user identifier (typically the Identity GUID), or null when anonymous.</summary>
    string? UserId { get; }

    /// <summary>The user email, or null when anonymous.</summary>
    string? UserEmail { get; }

    /// <summary>The originating client IP, or null when not available.</summary>
    string? IpAddress { get; }

    /// <summary>The originating client User-Agent header, or null.</summary>
    string? UserAgent { get; }

    /// <summary>True when an authenticated user is associated with the current context.</summary>
    bool IsAuthenticated { get; }

    /// <summary>Returns a non-null label suitable for the audit <c>PerformedBy</c> column.</summary>
    string DisplayName { get; }
}
