using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

public sealed class PayMongoService : IPayMongoService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PayMongoService> _logger;
    private readonly string _webhookSecret;

    public PayMongoService(HttpClient httpClient, IConfiguration configuration, ILogger<PayMongoService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        var secretKey = configuration["PayMongo:SecretKey"]
            ?? throw new InvalidOperationException("PayMongo:SecretKey is not configured.");
        _webhookSecret = configuration["PayMongo:WebhookSecret"] ?? string.Empty;
        var baseUrl = configuration["PayMongo:BaseUrl"] ?? "https://api.paymongo.com";

        _httpClient.BaseAddress = new Uri(baseUrl);
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(secretKey + ":"));
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<CreateCheckoutSessionResult> CreateCheckoutSessionAsync(
        decimal amount,
        string description,
        string successUrl,
        string cancelUrl,
        CancellationToken cancellationToken = default)
    {
        var amountCentavos = (long)(amount * 100);

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
                            name = "CMNetwork Invoice Payment",
                            quantity = 1
                        }
                    },
                    payment_method_types = new[] { "card", "gcash", "paymaya" },
                    success_url = successUrl,
                    cancel_url = cancelUrl,
                    description
                }
            }
        };

        var response = await _httpClient.PostAsync(
            "/v1/checkout_sessions",
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
            cancellationToken);

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayMongo create checkout session failed: {StatusCode} {Body}", response.StatusCode, body);
            throw new InvalidOperationException("Unable to create PayMongo checkout session.");
        }

        using var doc = JsonDocument.Parse(body);
        var data = doc.RootElement.GetProperty("data");
        var checkoutSessionId = data.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Missing PayMongo session id.");
        var checkoutUrl = data.GetProperty("attributes").GetProperty("checkout_url").GetString()
            ?? throw new InvalidOperationException("Missing PayMongo checkout url.");

        return new CreateCheckoutSessionResult(checkoutSessionId, checkoutUrl);
    }

    public async Task<string> GetCheckoutSessionStatusAsync(
        string checkoutSessionId,
        CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.GetAsync($"/v1/checkout_sessions/{checkoutSessionId}", cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("PayMongo get checkout session failed: {StatusCode} {Body}", response.StatusCode, body);
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
        if (string.IsNullOrWhiteSpace(_webhookSecret))
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
        var secretBytes = Encoding.UTF8.GetBytes(_webhookSecret);

        using var hmac = new HMACSHA256(secretBytes);
        var computed = Convert.ToHexString(hmac.ComputeHash(payloadBytes)).ToLowerInvariant();
        return computed == signature.ToLowerInvariant();
    }
}
