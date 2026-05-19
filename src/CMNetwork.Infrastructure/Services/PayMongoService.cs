using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

public sealed class PayMongoService : IPayMongoService
{
    private readonly HttpClient _httpClient;
    private readonly IIntegrationCredentialService _credentialService;
    private readonly ILogger<PayMongoService> _logger;

    public PayMongoService(
        HttpClient httpClient,
        IIntegrationCredentialService credentialService,
        ILogger<PayMongoService> logger)
    {
        _httpClient = httpClient;
        _credentialService = credentialService;
        _logger = logger;
    }

    public async Task<CreateCheckoutSessionResult> CreateCheckoutSessionAsync(
        decimal amount,
        string description,
        string successUrl,
        string cancelUrl,
        CancellationToken cancellationToken = default)
    {
        var runtimeCredentials = await _credentialService.GetPayMongoRuntimeCredentialsAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(runtimeCredentials.SecretKey))
        {
            throw new InvalidOperationException("PayMongo secret key is not configured.");
        }

        var amountCentavos = (long)(amount * 100);

        var paymentMethodCandidates = new[]
        {
            new[] { "card", "gcash", "paymaya" },
            new[] { "card", "gcash", "maya" },
            new[] { "card", "gcash" },
        };

        string? lastBody = null;
        System.Net.HttpStatusCode lastStatusCode = System.Net.HttpStatusCode.BadRequest;

        foreach (var paymentMethodTypes in paymentMethodCandidates)
        {
            var payload = new
            {
                data = new
                {
                    attributes = new
                    {
                        send_email_receipt = false,
                        show_description = true,
                        show_line_items = true,
                        line_items = new[]
                        {
                            new
                            {
                                currency = "PHP",
                                amount = amountCentavos,
                                description,
                                name = "CMNetwork Payment",
                                quantity = 1
                            }
                        },
                        payment_method_types = paymentMethodTypes,
                        success_url = successUrl,
                        cancel_url = cancelUrl,
                        description
                    }
                }
            };

            using var request = CreateRequest(
                HttpMethod.Post,
                runtimeCredentials,
                "v1/checkout_sessions",
                new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));

            var response = await _httpClient.SendAsync(request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(body);
                var data = doc.RootElement.GetProperty("data");
                var checkoutSessionId = data.GetProperty("id").GetString()
                    ?? throw new InvalidOperationException("Missing PayMongo session id.");
                var checkoutUrl = data.GetProperty("attributes").GetProperty("checkout_url").GetString()
                    ?? throw new InvalidOperationException("Missing PayMongo checkout url.");

                return new CreateCheckoutSessionResult(checkoutSessionId, checkoutUrl);
            }

            lastBody = body;
            lastStatusCode = response.StatusCode;

            _logger.LogWarning(
                "PayMongo create checkout session failed for methods [{Methods}]: {StatusCode} {Body}",
                string.Join(',', paymentMethodTypes),
                response.StatusCode,
                body);

            var lowerBody = body.ToLowerInvariant();
            var hasMethodCompatibilityError = lowerBody.Contains("payment_method_types")
                || lowerBody.Contains("paymaya")
                || lowerBody.Contains("maya");

            if (!hasMethodCompatibilityError)
            {
                break;
            }
        }

        _logger.LogError("PayMongo create checkout session failed: {StatusCode} {Body}", lastStatusCode, lastBody);
        if (runtimeCredentials.AllowMockOnFailure)
        {
            _logger.LogWarning("Falling back to mock PayMongo checkout session in non-production mode.");
            var mockSessionId = $"mock_cs_{Guid.NewGuid():N}";
            var mockCheckoutUrl = successUrl;
            return new CreateCheckoutSessionResult(mockSessionId, mockCheckoutUrl);
        }

        var providerMessage = ExtractProviderErrorMessage(lastBody);
        throw new InvalidOperationException(
            string.IsNullOrWhiteSpace(providerMessage)
                ? "Unable to create PayMongo checkout session."
                : $"Unable to create PayMongo checkout session: {providerMessage}");
    }

    public async Task<string> GetCheckoutSessionStatusAsync(
        string checkoutSessionId,
        CancellationToken cancellationToken = default)
    {
        var runtimeCredentials = await _credentialService.GetPayMongoRuntimeCredentialsAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(runtimeCredentials.SecretKey))
        {
            throw new InvalidOperationException("PayMongo secret key is not configured.");
        }

        using var request = CreateRequest(
            HttpMethod.Get,
            runtimeCredentials,
            $"v1/checkout_sessions/{checkoutSessionId}");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayMongo get checkout session failed: {StatusCode} {Body}", response.StatusCode, body);
            if (runtimeCredentials.AllowMockOnFailure && checkoutSessionId.StartsWith("mock_cs_", StringComparison.OrdinalIgnoreCase))
            {
                return "paid";
            }

            throw new InvalidOperationException("Unable to verify PayMongo checkout session.");
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement
            .GetProperty("data")
            .GetProperty("attributes")
            .GetProperty("payment_status")
            .GetString() ?? "unknown";
    }

    public bool VerifyWebhookSignature(string rawPayload, string signatureHeader)
    {
        string webhookSecret;
        try
        {
            var runtimeCredentials = _credentialService.GetPayMongoRuntimeCredentialsAsync().GetAwaiter().GetResult();
            webhookSecret = runtimeCredentials.WebhookSecret;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unable to load PayMongo runtime credentials during webhook signature validation.");
            webhookSecret = string.Empty;
        }

        if (string.IsNullOrWhiteSpace(webhookSecret))
        {
            _logger.LogWarning("PayMongo webhook secret is not configured. Skipping signature verification.");
            return true;
        }

        string? timestamp = null;
        string? signature = null;

        foreach (var part in signatureHeader.Split(','))
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2) continue;
            if (kv[0] == "t") timestamp = kv[1];
            if (kv[0] is "te" or "li") signature = kv[1];
        }

        if (string.IsNullOrWhiteSpace(timestamp) || string.IsNullOrWhiteSpace(signature))
        {
            return false;
        }

        var payloadBytes = Encoding.UTF8.GetBytes($"{timestamp}.{rawPayload}");
        var secretBytes = Encoding.UTF8.GetBytes(webhookSecret);

        using var hmac = new HMACSHA256(secretBytes);
        var computed = Convert.ToHexString(hmac.ComputeHash(payloadBytes)).ToLowerInvariant();
        return computed == signature.ToLowerInvariant();
    }

    private static HttpRequestMessage CreateRequest(
        HttpMethod method,
        PayMongoRuntimeCredentials credentials,
        string relativePath,
        HttpContent? content = null)
    {
        var baseUri = credentials.BaseUrl.TrimEnd('/') + "/";
        var requestUri = new Uri(new Uri(baseUri), relativePath);
        var request = new HttpRequestMessage(method, requestUri);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes(credentials.SecretKey + ":")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = content;
        return request;
    }

    private static string ExtractProviderErrorMessage(string? responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return string.Empty;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("errors", out var errors)
                && errors.ValueKind == JsonValueKind.Array
                && errors.GetArrayLength() > 0)
            {
                var first = errors[0];
                if (first.TryGetProperty("detail", out var detail)
                    && detail.ValueKind == JsonValueKind.String)
                {
                    return detail.GetString() ?? string.Empty;
                }

                if (first.TryGetProperty("code", out var code)
                    && code.ValueKind == JsonValueKind.String)
                {
                    return code.GetString() ?? string.Empty;
                }
            }
        }
        catch
        {
            // Ignore parse errors and fall back to empty message.
        }

        return string.Empty;
    }
}
