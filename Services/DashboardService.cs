using CMNetwork.Models;

namespace CMNetwork.Services;

public class DashboardService : IDashboardService
{
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(ILogger<DashboardService> logger)
    {
        _logger = logger;
    }

    public async Task<DashboardMetricsResponse> GetMetricsAsync(string role)
    {
        try
        {
            // Simulate async operation
            await Task.Delay(300);

            var metrics = role.ToLowerInvariant() switch
            {
                "super-admin" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Server Status",
                        Value = "Online",
                        Subtitle = "All systems operational",
                        TrendDirection = "stable"
                    },
                    new MetricDto
                    {
                        Title = "Active Users",
                        Value = "247",
                        Subtitle = "Peak at 2:30 PM",
                        TrendDirection = "up",
                        TrendValue = "+12%"
                    },
                    new MetricDto
                    {
                        Title = "Scheduled Jobs",
                        Value = "8/10",
                        ProgressPercentage = 80,
                        Subtitle = "2 jobs pending"
                    }
                },
                "accountant" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Pending Invoices",
                        Value = "23",
                        Subtitle = "Total value: $1.2M",
                        TrendDirection = "up",
                        TrendValue = "+3"
                    },
                    new MetricDto
                    {
                        Title = "Unreconciled Items",
                        Value = "7",
                        Subtitle = "From last week",
                        TrendDirection = "down",
                        TrendValue = "-2"
                    },
                    new MetricDto
                    {
                        Title = "Month-End Checklist",
                        Value = "85%",
                        ProgressPercentage = 85,
                        Subtitle = "5 tasks remaining"
                    }
                },
                "faculty-admin" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Department Budget",
                        Value = "74%",
                        ProgressPercentage = 74,
                        Subtitle = "$125K of $170K used"
                    },
                    new MetricDto
                    {
                        Title = "Pending Approvals",
                        Value = "4",
                        Subtitle = "Awaiting your action",
                        TrendDirection = "up",
                        TrendValue = "+1"
                    }
                },
                "employee" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Latest Payslip",
                        Value = "$4,250",
                        Subtitle = "Paid on 04/25/2026"
                    },
                    new MetricDto
                    {
                        Title = "Expense Claim Status",
                        Value = "1 Pending",
                        Subtitle = "Submitted 04/20/2026",
                        TrendDirection = "up"
                    },
                    new MetricDto
                    {
                        Title = "Leave Balance",
                        Value = "12 Days",
                        Subtitle = "YTD: Used 8 days"
                    }
                },
                "authorized-viewer" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Total Revenue MTD",
                        Value = "$1.2M",
                        Subtitle = "vs $1.1M last month",
                        TrendDirection = "up",
                        TrendValue = "+9%"
                    },
                    new MetricDto
                    {
                        Title = "Total Expenses MTD",
                        Value = "$850K",
                        Subtitle = "vs $920K last month",
                        TrendDirection = "down",
                        TrendValue = "-8%"
                    },
                    new MetricDto
                    {
                        Title = "Net Income",
                        Value = "$350K",
                        Subtitle = "Margin: 29%",
                        TrendDirection = "up",
                        TrendValue = "+12%"
                    }
                },
                "auditor" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "High-Risk Anomalies",
                        Value = "3",
                        Subtitle = "Require immediate review",
                        TrendDirection = "up",
                        TrendValue = "+1"
                    },
                    new MetricDto
                    {
                        Title = "Recent Audit Log Entries",
                        Value = "156",
                        Subtitle = "Last 7 days"
                    }
                },
                "cfo" => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Cash Position",
                        Value = "$2.5M",
                        Subtitle = "Available liquidity",
                        TrendDirection = "up",
                        TrendValue = "+8%"
                    },
                    new MetricDto
                    {
                        Title = "Budget vs Actual",
                        Value = "92%",
                        ProgressPercentage = 92,
                        Subtitle = "FY 2026 Q2"
                    },
                    new MetricDto
                    {
                        Title = "Pending Approvals",
                        Value = "12",
                        Subtitle = "Awaiting CFO review",
                        TrendDirection = "up",
                        TrendValue = "+3"
                    }
                },
                _ => new List<MetricDto>
                {
                    new MetricDto
                    {
                        Title = "Dashboard",
                        Value = "Loading...",
                        Subtitle = "Role not recognized"
                    }
                }
            };

            return new DashboardMetricsResponse { Metrics = metrics };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting metrics for role {role}: {ex.Message}");
            return new DashboardMetricsResponse { Metrics = new List<MetricDto>() };
        }
    }

    public async Task<ChartDataResponse> GetChartDataAsync()
    {
        try
        {
            // Simulate async operation
            await Task.Delay(300);

            var months = new[] { "Jan", "Feb", "Mar", "Apr", "May", "Jun" };
            var chartData = new List<ChartDataPoint>();

            for (int i = 0; i < months.Length; i++)
            {
                chartData.Add(new ChartDataPoint
                {
                    Label = months[i],
                    Series = new List<SeriesData>
                    {
                        new SeriesData
                        {
                            Name = "Revenue",
                            Values = new List<double> { 45000 + (i * 5000) }
                        },
                        new SeriesData
                        {
                            Name = "Expenses",
                            Values = new List<double> { 32000 + (i * 3000) }
                        }
                    }
                });
            }

            return new ChartDataResponse
            {
                Data = chartData,
                Type = "line"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting chart data: {ex.Message}");
            return new ChartDataResponse { Data = new List<ChartDataPoint>(), Type = "line" };
        }
    }

    public async Task<ApprovalsResponse> GetApprovalsAsync()
    {
        try
        {
            // Simulate async operation
            await Task.Delay(300);

            var approvals = new List<ApprovalDto>
            {
                new ApprovalDto
                {
                    Id = "APR-001",
                    Title = "Q2 Budget Request",
                    Description = "Finance department budget increase",
                    Status = "pending",
                    RequestedBy = "John Smith",
                    RequestedDate = DateTime.UtcNow.AddDays(-5),
                    Amount = 50000
                },
                new ApprovalDto
                {
                    Id = "APR-002",
                    Title = "IT Infrastructure Upgrade",
                    Description = "Server replacement and network expansion",
                    Status = "pending",
                    RequestedBy = "Sarah Johnson",
                    RequestedDate = DateTime.UtcNow.AddDays(-3),
                    Amount = 125000
                },
                new ApprovalDto
                {
                    Id = "APR-003",
                    Title = "Travel Expense Reimbursement",
                    Description = "Conference attendance expenses",
                    Status = "approved",
                    RequestedBy = "Michael Brown",
                    RequestedDate = DateTime.UtcNow.AddDays(-2),
                    Amount = 2500
                }
            };

            return new ApprovalsResponse { Approvals = approvals };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting approvals: {ex.Message}");
            return new ApprovalsResponse { Approvals = new List<ApprovalDto>() };
        }
    }

    public async Task<AuditActivityResponse> GetAuditActivitiesAsync()
    {
        try
        {
            // Simulate async operation
            await Task.Delay(300);

            var activities = new List<AuditActivityDto>
            {
                new AuditActivityDto
                {
                    Id = "ACT-001",
                    Action = "User Login",
                    User = "john.doe@cmnetwork.com",
                    Entity = "Authentication",
                    Status = "success",
                    Timestamp = DateTime.UtcNow.AddMinutes(-15)
                },
                new AuditActivityDto
                {
                    Id = "ACT-002",
                    Action = "Report Generated",
                    User = "sarah.johnson@cmnetwork.com",
                    Entity = "Financial Report - Q2",
                    Status = "success",
                    Timestamp = DateTime.UtcNow.AddMinutes(-45)
                },
                new AuditActivityDto
                {
                    Id = "ACT-003",
                    Action = "Failed Login Attempt",
                    User = "unknown.user@cmnetwork.com",
                    Entity = "Authentication",
                    Status = "error",
                    Timestamp = DateTime.UtcNow.AddMinutes(-120)
                },
                new AuditActivityDto
                {
                    Id = "ACT-004",
                    Action = "Invoice Approved",
                    User = "michael.brown@cmnetwork.com",
                    Entity = "Invoice #INV-2026-00542",
                    Status = "success",
                    Timestamp = DateTime.UtcNow.AddHours(-2)
                },
                new AuditActivityDto
                {
                    Id = "ACT-005",
                    Action = "Unusual Transaction Detected",
                    User = "System",
                    Entity = "Bank Transfer - Amount Anomaly",
                    Status = "warning",
                    Timestamp = DateTime.UtcNow.AddHours(-4)
                }
            };

            return new AuditActivityResponse { Activities = activities };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting audit activities: {ex.Message}");
            return new AuditActivityResponse { Activities = new List<AuditActivityDto>() };
        }
    }
}
