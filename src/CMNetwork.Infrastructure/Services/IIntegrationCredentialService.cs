namespace CMNetwork.Infrastructure.Services;

public sealed record PayMongoRuntimeCredentials(
    string PublicKey,
    string SecretKey,
    string WebhookSecret,
    string BaseUrl,
    string Mode,
    bool AllowMockOnFailure);

public sealed record PayMongoAdminSettings(
    string PublicKey,
    string Mode,
    bool SecretKeyConfigured,
    bool WebhookSecretConfigured,
    string? BaseUrl,
    int Version,
    DateTime? UpdatedAtUtc,
    string? UpdatedByUserId);

public sealed record PayMongoConnectionTestResult(bool Success, string Message);

public interface IIntegrationCredentialService
{
    Task<PayMongoRuntimeCredentials> GetPayMongoRuntimeCredentialsAsync(CancellationToken cancellationToken = default);
    Task<PayMongoAdminSettings> GetPayMongoAdminSettingsAsync(CancellationToken cancellationToken = default);
    Task<PayMongoAdminSettings> UpsertPayMongoSettingsAsync(
        string publicKey,
        string secretKey,
        string mode,
        string? webhookSecret,
        string? baseUrl,
        string updatedByUserId,
        CancellationToken cancellationToken = default);
    Task<PayMongoConnectionTestResult> TestPayMongoConnectionAsync(
        string? secretKey,
        string? baseUrl,
        CancellationToken cancellationToken = default);
}
