using CMNetwork.Models;

namespace CMNetwork.Services;

public interface IDashboardService
{
    Task<DashboardMetricsResponse> GetMetricsAsync(string role);
    Task<ChartDataResponse> GetChartDataAsync();
    Task<ApprovalsResponse> GetApprovalsAsync();
    Task<AuditActivityResponse> GetAuditActivitiesAsync();
}
