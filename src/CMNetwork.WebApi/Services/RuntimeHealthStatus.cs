namespace CMNetwork.Services;

public sealed class RuntimeHealthStatus
{
    public DateTime StartedUtc { get; set; } = DateTime.UtcNow;
    public bool DatabaseAvailable { get; set; }
    public string? DatabaseStatusMessage { get; set; }
    public bool HangfireEnabled { get; set; }
    public bool HangfireStarted { get; set; }
}