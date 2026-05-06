namespace CMNetwork.Domain.Entities;

public class SecurityPolicy
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public string Value { get; set; } = string.Empty;
}
