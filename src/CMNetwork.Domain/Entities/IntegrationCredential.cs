namespace CMNetwork.Domain.Entities;

public class IntegrationCredential
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Mode { get; set; } = "test";
    public string PublicKey { get; set; } = string.Empty;
    public string SecretKeyEncrypted { get; set; } = string.Empty;
    public string? WebhookSecretEncrypted { get; set; }
    public string? BaseUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int Version { get; set; } = 1;
    public string UpdatedByUserId { get; set; } = "system";
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
