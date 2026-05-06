namespace CMNetwork.Infrastructure.Services;

/// <summary>
/// Categories used for the AuditLogs.ActionCategory column.
/// Values are stored as strings so they remain stable across deployments.
/// </summary>
public static class AuditCategories
{
    public const string DataChange = "DataChange";
    public const string Login      = "Login";
    public const string Logout     = "Logout";
    public const string Auth       = "Auth";
    public const string Approval   = "Approval";
    public const string Export     = "Export";
    public const string Security   = "Security";
    public const string UserMgmt   = "UserManagement";
    public const string ApiRequest = "ApiRequest";
    public const string System     = "System";
    public const string Review     = "Review";
}

/// <summary>
/// Persists non-EF audit events (logins, approvals, exports, settings
/// changes, etc.) directly to the AuditLogs table. The current user, IP
/// and user agent are resolved automatically from <see cref="ICurrentUserService"/>
/// when not supplied explicitly.
/// </summary>
public interface IAuditEventLogger
{
    Task LogAsync(
        string entityName,
        string action,
        string category,
        string? recordId = null,
        object? details = null,
        string? performedByOverride = null,
        string? userEmailOverride = null,
        string? ipAddressOverride = null,
        CancellationToken cancellationToken = default);
}
