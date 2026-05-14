using CMNetwork.Models;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace CMNetwork.Services;

public sealed class SendGridEmailService : IEmailService
{
    private readonly ILogger<SendGridEmailService> _logger;

    public SendGridEmailService(ILogger<SendGridEmailService> logger)
    {
        _logger = logger;
    }

    public async Task<EmailSendResult> SendEmailAsync(
        SmtpSettingsDto settings,
        string recipientEmail,
        string subject,
        string body,
        bool isBodyHtml = false,
        string? recipientName = null,
        CancellationToken cancellationToken = default)
    {
        // Validate settings
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            return new EmailSendResult(false, "SendGrid API key is not configured.");
        }

        if (string.IsNullOrWhiteSpace(settings.FromEmail))
        {
            return new EmailSendResult(false, "Sender email address is required.");
        }

        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            return new EmailSendResult(false, "Recipient email address is required.");
        }

        if (string.IsNullOrWhiteSpace(subject))
        {
            return new EmailSendResult(false, "Email subject is required.");
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            return new EmailSendResult(false, "Email body is required.");
        }

        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            var client = new SendGridClient(settings.ApiKey.Trim());
            
            var from = new EmailAddress(
                settings.FromEmail.Trim(),
                string.IsNullOrWhiteSpace(settings.FromName) ? "CMNetwork" : settings.FromName.Trim());
            
            var to = string.IsNullOrWhiteSpace(recipientName)
                ? new EmailAddress(recipientEmail.Trim())
                : new EmailAddress(recipientEmail.Trim(), recipientName.Trim());
            
            var msg = new SendGridMessage()
            {
                From = from,
                Subject = subject,
                HtmlContent = isBodyHtml ? body : null,
                PlainTextContent = !isBodyHtml ? body : null,
            };
            
            msg.AddTo(to);

            var response = await client.SendEmailAsync(msg, cancellationToken);

            if (response.StatusCode == System.Net.HttpStatusCode.OK || 
                response.StatusCode == System.Net.HttpStatusCode.Accepted)
            {
                return new EmailSendResult(true, $"Email sent to {recipientEmail.Trim()}.");
            }

            var errorBody = await response.Body.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("SendGrid API returned {StatusCode}: {Response}", response.StatusCode, errorBody);
            return new EmailSendResult(false, $"SendGrid returned error {response.StatusCode}. Check API key and sender domain.");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "SendGrid HTTP request failed.");
            return new EmailSendResult(false, "Failed to connect to SendGrid API. Check your network connection.");
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(ex, "SendGrid email failed because of an invalid address.");
            return new EmailSendResult(false, "The sender or recipient email address is invalid.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SendGrid email failed with unexpected error.");
            return new EmailSendResult(false, "Unable to send the email through SendGrid. Check your configuration.");
        }
    }

    public async Task<EmailSendResult> SendTestEmailAsync(
        SmtpSettingsDto settings,
        string recipientEmail,
        string? recipientName = null,
        CancellationToken cancellationToken = default)
    {
        var result = await SendEmailAsync(
            settings,
            recipientEmail,
            subject: "CMNetwork SendGrid test email",
            body: BuildBody(settings),
            isBodyHtml: false,
            recipientName: recipientName,
            cancellationToken: cancellationToken);

        if (!result.Success)
        {
            return result;
        }

        return new EmailSendResult(true, $"Test email sent to {recipientEmail.Trim()}.");
    }

    private static string BuildBody(SmtpSettingsDto settings)
    {
        return $"""
            CMNetwork Email Configuration Test

            Provider: SendGrid
            From: {settings.FromEmail}
            From Name: {settings.FromName}

            If you received this email, the email service is configured correctly.
            """;
    }
}
