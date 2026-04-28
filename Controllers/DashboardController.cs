using CMNetwork.Models;
using CMNetwork.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IDashboardService dashboardService, ILogger<DashboardController> logger)
    {
        _dashboardService = dashboardService;
        _logger = logger;
    }

    [HttpGet("{role}/metrics")]
    public async Task<IActionResult> GetMetrics(string role)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(role))
            {
                return BadRequest(new { message = "Role is required" });
            }

            var response = await _dashboardService.GetMetricsAsync(role);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting metrics for role {role}: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred while retrieving metrics" });
        }
    }

    [HttpGet("charts")]
    public async Task<IActionResult> GetChartData()
    {
        try
        {
            var response = await _dashboardService.GetChartDataAsync();
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting chart data: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred while retrieving chart data" });
        }
    }

    [HttpGet("approvals")]
    public async Task<IActionResult> GetApprovals()
    {
        try
        {
            var response = await _dashboardService.GetApprovalsAsync();
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting approvals: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred while retrieving approvals" });
        }
    }

    [HttpGet("audit-activities")]
    public async Task<IActionResult> GetAuditActivities()
    {
        try
        {
            var response = await _dashboardService.GetAuditActivitiesAsync();
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting audit activities: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred while retrieving audit activities" });
        }
    }

    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health()
    {
        return Ok(new { status = "Dashboard service is healthy", timestamp = DateTime.UtcNow });
    }
}
