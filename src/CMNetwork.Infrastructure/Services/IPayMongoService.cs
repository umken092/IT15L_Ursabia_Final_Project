namespace CMNetwork.Infrastructure.Services;

public interface IPayMongoService
{
    Task<CreateCheckoutSessionResult> CreateCheckoutSessionAsync(
        decimal amount,
        string description,
        string successUrl,
        string cancelUrl,
        CancellationToken cancellationToken = default);

    Task<string> GetCheckoutSessionStatusAsync(
        string checkoutSessionId,
        CancellationToken cancellationToken = default);

    bool VerifyWebhookSignature(string rawPayload, string signatureHeader);
}

public sealed record CreateCheckoutSessionResult(string CheckoutSessionId, string CheckoutUrl);
