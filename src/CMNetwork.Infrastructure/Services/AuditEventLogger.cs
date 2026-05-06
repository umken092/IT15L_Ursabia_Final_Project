using System.Text.Json;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

public sealed class AuditEventLogger : IAuditEventLogger
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<AuditEventLogger> _logger;

    public AuditEventLogger(
        IServiceScopeFactory scopeFactory,
        ICurrentUserService currentUser,
        ILogger<AuditEventLogger> logger)
    {
        _scopeFactory = scopeFactory;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task LogAsync(
        string entityName,
        string action,
        string category,
        string? recordId = null,
        object? details = null,
        string? performedByOverride = null,
        string? userEmailOverride = null,
        string? ipAddressOverride = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Use a fresh scope so audit writes never interfere with the
            // outer DbContext's change tracker or its own SaveChanges call.
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CMNetworkDbContext>();

            var entry = new AuditLogEntry
            {
                Id = Guid.NewGuid(),
                EntityName = Truncate(entityName, 128) ?? string.Empty,
                Action = Truncate(action, 64) ?? string.Empty,
                ActionCategory = Truncate(string.IsNullOrWhiteSpace(category) ? AuditCategories.System : category, 32) ?? AuditCategories.System,
                RecordId = Truncate(recordId, 128),
                PerformedBy = Truncate(performedByOverride ?? _currentUser.UserId ?? _currentUser.DisplayName, 256) ?? "system",
                UserEmail = Truncate(userEmailOverride ?? _currentUser.UserEmail, 256),
                IpAddress = Truncate(ipAddressOverride ?? _currentUser.IpAddress, 64),
                UserAgent = Truncate(_currentUser.UserAgent, 512),
                DetailsJson = details is null ? null : JsonSerializer.Serialize(details, JsonOptions),
                CreatedUtc = DateTime.UtcNow,
            };

            db.AuditLogs.Add(entry);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Audit failures must never break the calling business operation.
            _logger.LogError(ex, "Failed to write audit log entry for {Entity}/{Action}", entityName, action);
        }
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= max ? value : value[..max];
    }
}
