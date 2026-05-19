using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

public sealed class PayMongoService : IPayMongoService
{
    private const string UnknownStatus = "unknown";
    
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
                _logger.LogWarning("Returning mock 'paid' status for mock checkout session {SessionId}", checkoutSessionId);
                return "paid";
            }

            throw new InvalidOperationException("Unable to verify PayMongo checkout session.");
        }

        using var doc = JsonDocument.Parse(body);

        if (!doc.RootElement.TryGetProperty("data", out var dataEl) ||
            !dataEl.TryGetProperty("attributes", out var attrsEl))
        {
            _logger.LogWarning("PayMongo checkout session response missing data/attributes. Body={Body}", body);
            return UnknownStatus;
        }

        // PayMongo checkout sessions can report status in multiple ways:
        // 1. payment_status field (most common): "paid", "unpaid", "expired", etc.
        // 2. status field (sometimes used): "open", "completed", etc.
        // 3. payments array with individual payment statuses
        
        if (attrsEl.TryGetProperty("payment_status", out var paymentStatusEl) &&
            paymentStatusEl.ValueKind == JsonValueKind.String)
        {
            return paymentStatusEl.GetString() ?? UnknownStatus;
        }

        if (attrsEl.TryGetProperty("status", out var statusEl) &&
            statusEl.ValueKind == JsonValueKind.String)
        {
            var status = statusEl.GetString() ?? UnknownStatus;
            
            // Map status field values to payment status if needed
            if (status.Equals("completed", StringComparison.OrdinalIgnoreCase))
                return "paid";
            
            return status;
        }

        // Fall back: if there is a successful payment in the payments array, treat as paid
        if (attrsEl.TryGetProperty("payments", out var paymentsEl) &&
            paymentsEl.ValueKind == JsonValueKind.Array)
        {
            var paymentCount = paymentsEl.GetArrayLength();
            _logger.LogInformation("PayMongo checkout session {SessionId} has {PaymentCount} payments", checkoutSessionId, paymentCount);
            
            foreach (var p in paymentsEl.EnumerateArray())
            {
                if (p.TryGetProperty("attributes", out var pAttrs) &&
                    pAttrs.TryGetProperty("status", out var pStatus) &&
                    pStatus.ValueKind == JsonValueKind.String)
                {
                    var paymentStatus = pStatus.GetString() ?? string.Empty;
                    _logger.LogInformation("Payment status in checkout session {SessionId}: {PaymentStatus}", checkoutSessionId, paymentStatus);
                    
                    if (string.Equals(paymentStatus, "paid", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(paymentStatus, "completed", StringComparison.OrdinalIgnoreCase))
                    {
                        return "paid";
                    }
                }
            }
        }

        _logger.LogWarning(
            "PayMongo checkout session {SessionId} had no recognizable status field. Full attributes: {@Attributes}",
            checkoutSessionId, attrsEl);
        return UnknownStatus;
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

        // PayMongo webhook signature format: t=timestamp,v1=signature_value
        foreach (var part in signatureHeader.Split(','))
        {
            var trimmedPart = part.Trim();
            var kv = trimmedPart.Split('=', 2);
            if (kv.Length != 2) continue;
            
            var key = kv[0].Trim();
            var value = kv[1].Trim();
            
            if (key == "t") 
                timestamp = value;
            if (key == "v1")  // PayMongo v1 signature
                signature = value;
        }

        if (string.IsNullOrWhiteSpace(timestamp) || string.IsNullOrWhiteSpace(signature))
        {
            _logger.LogWarning("Missing timestamp or signature in PayMongo webhook header. Header={Header}", signatureHeader);
            return false;
        }

        var payloadBytes = Encoding.UTF8.GetBytes($"{timestamp}.{rawPayload}");
        var secretBytes = Encoding.UTF8.GetBytes(webhookSecret);

        using var hmac = new HMACSHA256(secretBytes);
        var computed = Convert.ToHexString(hmac.ComputeHash(payloadBytes)).ToLowerInvariant();
        var incomingSignature = signature.ToLowerInvariant();
        
        var isValid = computed == incomingSignature;
        
        if (!isValid)
        {
            _logger.LogWarning(
                "PayMongo webhook signature mismatch. Computed={Computed}, Incoming={Incoming}",
                computed, incomingSignature);
        }

        return isValid;
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
