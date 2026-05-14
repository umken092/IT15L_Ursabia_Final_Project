using System.Net;
using System.Net.Mail;
using CMNetwork.Models;

namespace CMNetwork.Services;

public sealed class SmtpEmailService : IEmailService
{
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(ILogger<SmtpEmailService> logger)
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
        var validationError = Validate(settings, recipientEmail);
        if (validationError is not null)
        {
            return new EmailSendResult(false, validationError);
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
            using var message = new MailMessage
            {
                From = new MailAddress(
                    settings.FromEmail.Trim(),
                    string.IsNullOrWhiteSpace(settings.FromName) ? "CMNetwork" : settings.FromName.Trim()),
                Subject = subject,
                Body = body,
                IsBodyHtml = isBodyHtml,
            };

            if (string.IsNullOrWhiteSpace(recipientName))
            {
                message.To.Add(new MailAddress(recipientEmail.Trim()));
            }
            else
            {
                message.To.Add(new MailAddress(recipientEmail.Trim(), recipientName.Trim()));
            }

            using var client = CreateClient(settings);
            await client.SendMailAsync(message);

            return new EmailSendResult(true, $"Email sent to {recipientEmail.Trim()}.");
        }
        catch (SmtpException ex)
        {
            _logger.LogWarning(ex, "SMTP email failed for host {Host}:{Port}.", settings.Host, settings.Port);
            return new EmailSendResult(false, $"SMTP rejected the message: {GetFriendlyMessage(ex)}");
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(ex, "SMTP email failed because of an invalid address.");
            return new EmailSendResult(false, "The sender or recipient email address is invalid.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMTP email failed for host {Host}:{Port}.", settings.Host, settings.Port);
            return new EmailSendResult(false, "Unable to send the email. Check the SMTP host, port, security, and credentials.");
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
            subject: "CMNetwork SMTP test email",
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

    private static SmtpClient CreateClient(SmtpSettingsDto settings)
    {
        return new SmtpClient
        {
            Host = settings.Host.Trim(),
            Port = settings.Port,
            EnableSsl = !string.Equals(settings.Security, "none", StringComparison.OrdinalIgnoreCase),
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(settings.Username.Trim(), settings.Password),
            Timeout = 15000,
        };
    }

    private static string? Validate(SmtpSettingsDto settings, string recipientEmail)
    {
        if (string.IsNullOrWhiteSpace(settings.Host))
        {
            return "SMTP host is required.";
        }

        if (settings.Port is < 1 or > 65535)
        {
            return "SMTP port must be between 1 and 65535.";
        }

        if (string.IsNullOrWhiteSpace(settings.Username))
        {
            return "SMTP username is required.";
        }

        if (string.IsNullOrWhiteSpace(settings.Password))
        {
            return "SMTP password is required.";
        }

        if (string.IsNullOrWhiteSpace(settings.FromEmail))
        {
            return "From email is required.";
        }

        try
        {
            _ = new MailAddress(settings.FromEmail.Trim());
            _ = new MailAddress(recipientEmail.Trim());
        }
        catch
        {
            return "Sender or recipient email address is invalid.";
        }

        if (!string.Equals(settings.Security, "none", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(settings.Security, "ssl", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(settings.Security, "starttls", StringComparison.OrdinalIgnoreCase))
        {
            return "SMTP security must be none, ssl, or starttls.";
        }

        return null;
    }

    private static string BuildBody(SmtpSettingsDto settings)
    {
        var security = string.IsNullOrWhiteSpace(settings.Security) ? "starttls" : settings.Security;
        return $"""
               Hello from CMNetwork,

               This is a test email from the SMTP / Email settings page.

               Host: {settings.Host.Trim()}
               Port: {settings.Port}
               Security: {security}
               Sent at: {DateTime.UtcNow:O}
               """;
    }

    private static string GetFriendlyMessage(SmtpException exception)
    {
        return string.IsNullOrWhiteSpace(exception.Message) ? "SMTP server returned an error." : exception.Message;
    }
}