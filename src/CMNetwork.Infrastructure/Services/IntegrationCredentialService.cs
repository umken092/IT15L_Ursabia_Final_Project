using System.Net.Http.Headers;
using System.Text;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

public sealed class IntegrationCredentialService : IIntegrationCredentialService
{
    private const string PayMongoProvider = "paymongo";
    private readonly CMNetworkDbContext _dbContext;
    private readonly IDataProtector _protector;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly ILogger<IntegrationCredentialService> _logger;

    public IntegrationCredentialService(
        CMNetworkDbContext dbContext,
        IDataProtectionProvider dataProtectionProvider,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IHostEnvironment hostEnvironment,
        ILogger<IntegrationCredentialService> logger)
    {
        _dbContext = dbContext;
        _protector = dataProtectionProvider.CreateProtector("CMNetwork.IntegrationCredentials.v1");
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _hostEnvironment = hostEnvironment;
        _logger = logger;
    }

    public async Task<PayMongoRuntimeCredentials> GetPayMongoRuntimeCredentialsAsync(CancellationToken cancellationToken = default)
    {
        var credential = await _dbContext.Set<IntegrationCredential>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Provider == PayMongoProvider && x.IsActive, cancellationToken);

        if (credential is null)
        {
            return BuildFallbackFromConfiguration();
        }

        var secretKey = DecryptOrEmpty(credential.SecretKeyEncrypted);
        var webhookSecret = DecryptOrEmpty(credential.WebhookSecretEncrypted);

        if (string.IsNullOrWhiteSpace(secretKey))
        {
            _logger.LogWarning("PayMongo DB credential exists but has no decryptable secret key. Falling back to configuration.");
            return BuildFallbackFromConfiguration();
        }

        var baseUrl = string.IsNullOrWhiteSpace(credential.BaseUrl)
            ? _configuration["PayMongo:BaseUrl"] ?? "https://api.paymongo.com"
            : credential.BaseUrl.Trim();

        var allowMockOnFailure = _configuration.GetValue<bool?>("PayMongo:AllowMockOnFailure")
            ?? _hostEnvironment.IsDevelopment();

        return new PayMongoRuntimeCredentials(
            PublicKey: credential.PublicKey,
            SecretKey: secretKey,
            WebhookSecret: webhookSecret,
            BaseUrl: baseUrl,
            Mode: NormalizeMode(credential.Mode),
            AllowMockOnFailure: allowMockOnFailure);
    }

    public async Task<PayMongoAdminSettings> GetPayMongoAdminSettingsAsync(CancellationToken cancellationToken = default)
    {
        var credential = await _dbContext.Set<IntegrationCredential>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Provider == PayMongoProvider && x.IsActive, cancellationToken);

        if (credential is null)
        {
            return new PayMongoAdminSettings(
                PublicKey: string.Empty,
                Mode: "test",
                SecretKeyConfigured: !string.IsNullOrWhiteSpace(_configuration["PayMongo:SecretKey"]),
                WebhookSecretConfigured: !string.IsNullOrWhiteSpace(_configuration["PayMongo:WebhookSecret"]),
                BaseUrl: _configuration["PayMongo:BaseUrl"] ?? "https://api.paymongo.com",
                Version: 0,
                UpdatedAtUtc: null,
                UpdatedByUserId: null);
        }

        return new PayMongoAdminSettings(
            PublicKey: credential.PublicKey,
            Mode: NormalizeMode(credential.Mode),
            SecretKeyConfigured: !string.IsNullOrWhiteSpace(credential.SecretKeyEncrypted),
            WebhookSecretConfigured: !string.IsNullOrWhiteSpace(credential.WebhookSecretEncrypted),
            BaseUrl: credential.BaseUrl,
            Version: credential.Version,
            UpdatedAtUtc: credential.UpdatedAtUtc,
            UpdatedByUserId: credential.UpdatedByUserId);
    }

    public async Task<PayMongoAdminSettings> UpsertPayMongoSettingsAsync(
        string publicKey,
        string secretKey,
        string mode,
        string? webhookSecret,
        string? baseUrl,
        string updatedByUserId,
        CancellationToken cancellationToken = default)
    {
        var normalizedMode = NormalizeMode(mode);

        var credential = await _dbContext.Set<IntegrationCredential>()
            .FirstOrDefaultAsync(x => x.Provider == PayMongoProvider && x.IsActive, cancellationToken);

        if (credential is null)
        {
            credential = new IntegrationCredential
            {
                Id = Guid.NewGuid(),
                Provider = PayMongoProvider,
                IsActive = true,
                Version = 0,
            };
            _dbContext.Set<IntegrationCredential>().Add(credential);
        }

        credential.Mode = normalizedMode;
        credential.PublicKey = publicKey.Trim();
        credential.BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim();
        credential.UpdatedByUserId = string.IsNullOrWhiteSpace(updatedByUserId) ? "system" : updatedByUserId;
        credential.UpdatedAtUtc = DateTime.UtcNow;
        credential.Version += 1;

        if (!string.IsNullOrWhiteSpace(secretKey))
        {
            credential.SecretKeyEncrypted = _protector.Protect(secretKey.Trim());
        }

        if (webhookSecret is not null)
        {
            credential.WebhookSecretEncrypted = string.IsNullOrWhiteSpace(webhookSecret)
                ? null
                : _protector.Protect(webhookSecret.Trim());
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await GetPayMongoAdminSettingsAsync(cancellationToken);
    }

    public async Task<PayMongoConnectionTestResult> TestPayMongoConnectionAsync(
        string? secretKey,
        string? baseUrl,
        CancellationToken cancellationToken = default)
    {
        var keyToUse = string.IsNullOrWhiteSpace(secretKey)
            ? (await GetPayMongoRuntimeCredentialsAsync(cancellationToken)).SecretKey
            : secretKey.Trim();

        if (string.IsNullOrWhiteSpace(keyToUse))
        {
            return new PayMongoConnectionTestResult(false, "Secret key is required to test PayMongo connection.");
        }

        var resolvedBaseUrl = string.IsNullOrWhiteSpace(baseUrl)
            ? _configuration["PayMongo:BaseUrl"] ?? "https://api.paymongo.com"
            : baseUrl.Trim();

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(new Uri(resolvedBaseUrl.TrimEnd('/') + "/"), "v1/webhooks"));
            var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(keyToUse + ":"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var client = _httpClientFactory.CreateClient();
            var response = await client.SendAsync(request, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return new PayMongoConnectionTestResult(true, "PayMongo connection successful.");
            }

            if ((int)response.StatusCode is 401 or 403)
            {
                return new PayMongoConnectionTestResult(false, "PayMongo rejected the credentials. Check your secret key.");
            }

            _logger.LogWarning("PayMongo test connection returned non-success: {StatusCode} {Body}", response.StatusCode, responseBody);
            return new PayMongoConnectionTestResult(false, $"PayMongo responded with {(int)response.StatusCode}.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PayMongo test connection failed.");
            return new PayMongoConnectionTestResult(false, "Unable to reach PayMongo. Check internet access, base URL, and key.");
        }
    }

    private PayMongoRuntimeCredentials BuildFallbackFromConfiguration()
    {
        var secretKey = _configuration["PayMongo:SecretKey"] ?? string.Empty;
        var publicKey = _configuration["PayMongo:PublicKey"] ?? string.Empty;
        var webhookSecret = _configuration["PayMongo:WebhookSecret"] ?? string.Empty;
        var baseUrl = _configuration["PayMongo:BaseUrl"] ?? "https://api.paymongo.com";
        var mode = NormalizeMode(_configuration["PayMongo:Mode"] ?? "test");
        var allowMockOnFailure = _configuration.GetValue<bool?>("PayMongo:AllowMockOnFailure")
            ?? _hostEnvironment.IsDevelopment();

        return new PayMongoRuntimeCredentials(publicKey, secretKey, webhookSecret, baseUrl, mode, allowMockOnFailure);
    }

    private string DecryptOrEmpty(string? cipherText)
    {
        if (string.IsNullOrWhiteSpace(cipherText))
        {
            return string.Empty;
        }

        try
        {
            return _protector.Unprotect(cipherText);
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string NormalizeMode(string mode)
        => string.Equals(mode, "live", StringComparison.OrdinalIgnoreCase) ? "live" : "test";
}
