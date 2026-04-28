namespace CMNetwork.Models;

public class DashboardMetricsResponse
{
    public List<MetricDto> Metrics { get; set; } = new();
}

public class MetricDto
{
    public string Title { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public int? ProgressPercentage { get; set; }
    public string? TrendDirection { get; set; } // "up", "down", "stable"
    public string? TrendValue { get; set; }
}

public class ChartDataResponse
{
    public List<ChartDataPoint> Data { get; set; } = new();
    public string Type { get; set; } = "line"; // "line", "bar", "column"
}

public class ChartDataPoint
{
    public string Label { get; set; } = string.Empty;
    public List<SeriesData> Series { get; set; } = new();
}

public class SeriesData
{
    public string Name { get; set; } = string.Empty;
    public List<double> Values { get; set; } = new();
}

public class ApprovalsResponse
{
    public List<ApprovalDto> Approvals { get; set; } = new();
}

public class ApprovalDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // "pending", "approved", "rejected"
    public string RequestedBy { get; set; } = string.Empty;
    public DateTime RequestedDate { get; set; }
    public double? Amount { get; set; }
}

public class AuditActivityResponse
{
    public List<AuditActivityDto> Activities { get; set; } = new();
}

public class AuditActivityDto
{
    public string Id { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string User { get; set; } = string.Empty;
    public string Entity { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // "success", "warning", "error"
    public DateTime Timestamp { get; set; }
}
