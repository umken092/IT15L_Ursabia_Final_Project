using CMNetwork.Models;

namespace CMNetwork.Services;

public interface IEmailService
{
    Task<EmailSendResult> SendEmailAsync(
        SmtpSettingsDto settings,
        string recipientEmail,
        string subject,
        string body,
        bool isBodyHtml = false,
        string? recipientName = null,
        CancellationToken cancellationToken = default);

    Task<EmailSendResult> SendTestEmailAsync(
        SmtpSettingsDto settings,
        string recipientEmail,
        string? recipientName = null,
        CancellationToken cancellationToken = default);
}

public sealed record EmailSendResult(bool Success, string Message);