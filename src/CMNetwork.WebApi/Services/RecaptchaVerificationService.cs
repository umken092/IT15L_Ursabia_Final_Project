using System.Text.Json;
using CMNetwork.Infrastructure.Services;

namespace CMNetwork.Services;

public sealed class RecaptchaVerificationService : IRecaptchaVerificationService
{
    private readonly IIntegrationCredentialService _integrationCredentialService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RecaptchaVerificationService> _logger;

    public RecaptchaVerificationService(
        IIntegrationCredentialService integrationCredentialService,
        IHttpClientFactory httpClientFactory,
        ILogger<RecaptchaVerificationService> logger)
    {
        _integrationCredentialService = integrationCredentialService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<RecaptchaVerificationResult> VerifyAsync(
        string? token,
        string expectedAction,
        string? remoteIp,
        CancellationToken cancellationToken = default)
    {
        var settings = await _integrationCredentialService.GetRecaptchaRuntimeSettingsAsync(cancellationToken);
        if (!settings.Enabled)
        {
            // If no secret/site key is configured yet, do not block auth flows.
            return new RecaptchaVerificationResult(true, "reCAPTCHA is not configured.");
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return new RecaptchaVerificationResult(false, "Missing reCAPTCHA token.");
        }

        try
        {
            var form = new List<KeyValuePair<string, string>>
            {
                new("secret", settings.SecretKey),
                new("response", token.Trim()),
            };

            if (!string.IsNullOrWhiteSpace(remoteIp))
            {
                form.Add(new("remoteip", remoteIp));
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, settings.VerifyEndpoint)
            {
                Content = new FormUrlEncodedContent(form),
            };

            var client = _httpClientFactory.CreateClient();
            using var response = await client.SendAsync(request, cancellationToken);
            var payload = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("reCAPTCHA verification HTTP failure: {StatusCode}", response.StatusCode);
                return new RecaptchaVerificationResult(false, "reCAPTCHA verification failed.");
            }

            var parsed = JsonSerializer.Deserialize<RecaptchaVerifyResponse>(payload, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });

            if (parsed is null)
            {
                return new RecaptchaVerificationResult(false, "Invalid reCAPTCHA verification response.");
            }

            if (!parsed.Success)
            {
                return new RecaptchaVerificationResult(false, "reCAPTCHA challenge failed.", parsed.Score, parsed.Action);
            }

            if (!string.Equals(parsed.Action, expectedAction, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("reCAPTCHA action mismatch. Expected {ExpectedAction}, actual {ActualAction}", expectedAction, parsed.Action);
                return new RecaptchaVerificationResult(false, "reCAPTCHA action mismatch.", parsed.Score, parsed.Action);
            }

            if (parsed.Score.GetValueOrDefault(0d) < settings.MinScore)
            {
                return new RecaptchaVerificationResult(false, "reCAPTCHA score too low.", parsed.Score, parsed.Action);
            }

            return new RecaptchaVerificationResult(true, "reCAPTCHA verified.", parsed.Score, parsed.Action);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "reCAPTCHA verification exception.");
            return new RecaptchaVerificationResult(false, "Unable to verify reCAPTCHA right now.");
        }
    }

    private sealed class RecaptchaVerifyResponse
    {
        public bool Success { get; set; }
        public double? Score { get; set; }
        public string? Action { get; set; }
    }
}
