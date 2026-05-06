namespace CMNetwork.Models;

public class ErrorViewModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}

/// <summary>
/// Standard API error response shape used by all controllers and the global exception handler.
/// Frontend can always rely on <c>{ status, message, errors?, traceId? }</c>.
/// </summary>
public class ApiError
{
    public int Status { get; set; }
    public string Message { get; set; } = string.Empty;
    /// <summary>Field-level validation errors keyed by field name.</summary>
    public Dictionary<string, string[]>? Errors { get; set; }
    public string? TraceId { get; set; }

    public static ApiError From(int status, string message, string? traceId = null)
        => new() { Status = status, Message = message, TraceId = traceId };
}
