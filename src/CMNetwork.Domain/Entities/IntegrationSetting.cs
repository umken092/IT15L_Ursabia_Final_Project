namespace CMNetwork.Domain.Entities;

public class IntegrationSetting
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public DateTime? LastSyncUtc { get; set; }
}
