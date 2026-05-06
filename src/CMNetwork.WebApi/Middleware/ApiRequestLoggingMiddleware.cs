using System.Diagnostics;
using CMNetwork.Infrastructure.Services;

namespace CMNetwork.Middleware;

/// <summary>
/// Records every authenticated, non-trivial API call into the AuditLogs
/// table with <c>ActionCategory = "ApiRequest"</c>. Static assets, the
/// Hangfire dashboard and audit-log read endpoints are excluded to keep
/// noise low.
/// </summary>
public class ApiRequestLoggingMiddleware
{
    private static readonly string[] IgnoredPathPrefixes =
    {
        "/hangfire",
        "/swagger",
        "/_framework",
        "/_vs",
        "/favicon",
        "/api/admin/audit", // viewing the audit log is itself audited via export action
        "/api/dashboard",   // dashboard is polled frequently and produces noise
        "/api/auth/health",
        "/api/auth/validate",
        "/api/auth/refresh", // already audited explicitly with category Auth
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<ApiRequestLoggingMiddleware> _logger;

    public ApiRequestLoggingMiddleware(RequestDelegate next, ILogger<ApiRequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IAuditEventLogger audit)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Only log API requests; skip static content and ignored paths.
        var shouldLog = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
                        && !IgnoredPathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));

        if (!shouldLog)
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();

            // Fire-and-forget the audit write; failures are swallowed by the logger.
            try
            {
                await audit.LogAsync(
                    entityName: $"{context.Request.Method} {path}",
                    action: context.Request.Method,
                    category: AuditCategories.ApiRequest,
                    recordId: context.Response.StatusCode.ToString(),
                    details: new
                    {
                        path,
                        method = context.Request.Method,
                        statusCode = context.Response.StatusCode,
                        durationMs = sw.ElapsedMilliseconds,
                        queryString = context.Request.QueryString.HasValue
                            ? context.Request.QueryString.Value
                            : null,
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to write API request audit log for {Path}", path);
            }
        }
    }
}
