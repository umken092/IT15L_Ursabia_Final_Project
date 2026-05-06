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
    private static readonly HashSet<string> KnownRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "super-admin", "admin", "accountant", "auditor", "budget-manager",
        "budget-officer", "employee", "vendor", "faculty-admin", "cfo",
        "authorized-viewer"
    };

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
        if (string.IsNullOrWhiteSpace(role) || !KnownRoles.Contains(role))
        {
            return BadRequest(new { message = $"Unknown role '{role}'. No metrics available." });
        }

        var response = await _dashboardService.GetMetricsAsync(role);
        return Ok(response);
    }

    [HttpGet("charts")]
    public async Task<IActionResult> GetChartData()
    {
        var response = await _dashboardService.GetChartDataAsync();
        return Ok(response);
    }

    [HttpGet("approvals")]
    public async Task<IActionResult> GetApprovals()
    {
        var response = await _dashboardService.GetApprovalsAsync();
        return Ok(response);
    }

    [HttpGet("audit-activities")]
    public async Task<IActionResult> GetAuditActivities()
    {
        var response = await _dashboardService.GetAuditActivitiesAsync();
        return Ok(response);
    }

    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health()
    {
        return Ok(new { status = "Dashboard service is healthy", timestamp = DateTime.UtcNow });
    }

    [HttpGet("budget-control")]
    public async Task<IActionResult> GetBudgetControl([FromQuery] int? year = null)
    {
        var response = await _dashboardService.GetBudgetControlAsync(year);
        return Ok(response);
    }
}
