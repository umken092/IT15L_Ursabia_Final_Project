namespace CMNetwork.Services;

public sealed record RecaptchaVerificationResult(
    bool IsValid,
    string Message,
    double? Score = null,
    string? Action = null);

public interface IRecaptchaVerificationService
{
    Task<RecaptchaVerificationResult> VerifyAsync(
        string? token,
        string expectedAction,
        string? remoteIp,
        CancellationToken cancellationToken = default);
}
