using CMNetwork.Models;

namespace CMNetwork.Services;

public interface IEmailServiceFactory
{
    IEmailService GetEmailService(SmtpSettingsDto settings);
}

public sealed class EmailServiceFactory : IEmailServiceFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<EmailServiceFactory> _logger;

    public EmailServiceFactory(IServiceProvider serviceProvider, ILogger<EmailServiceFactory> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public IEmailService GetEmailService(SmtpSettingsDto settings)
    {
        var provider = string.IsNullOrWhiteSpace(settings.Provider) ? "smtp" : settings.Provider.ToLowerInvariant().Trim();

        return provider switch
        {
            "sendgrid" => _serviceProvider.GetRequiredService<SendGridEmailService>(),
            "smtp" or _ => _serviceProvider.GetRequiredService<SmtpEmailService>(),
        };
    }
}
