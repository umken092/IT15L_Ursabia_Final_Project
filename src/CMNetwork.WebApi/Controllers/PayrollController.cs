using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Models;
using CMNetwork.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/payroll")]
[Authorize]
public class PayrollController : ControllerBase
{
    private readonly IPayrollService _payrollService;

    public PayrollController(IPayrollService payrollService)
    {
        _payrollService = payrollService;
    }

    [HttpPost("pay-periods")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> CreatePayPeriod([FromBody] CreatePayPeriodRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await _payrollService.CreatePayPeriodAsync(request, GetCurrentUserId());
            return CreatedAtAction(nameof(GetPayPeriods), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("pay-periods")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> GetPayPeriods()
    {
        var result = await _payrollService.GetPayPeriodsAsync();
        return Ok(result);
    }

    [HttpGet("runs")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> GetPayrollRuns([FromQuery] PayrollRunStatus? status = null, [FromQuery] Guid? payPeriodId = null)
    {
        var result = await _payrollService.GetPayrollRunsAsync(status, payPeriodId);
        return Ok(result);
    }

    [HttpGet("runs/{payPeriodId:guid}/setup")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> GetPayrollSetup(Guid payPeriodId)
    {
        try
        {
            var result = await _payrollService.GetPayrollSetupAsync(payPeriodId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payPeriodId:guid}/calculate")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> CalculatePayroll(Guid payPeriodId, [FromBody] CalculatePayrollRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await _payrollService.CalculatePayrollAsync(payPeriodId, request, GetCurrentUserId());
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payrollRunId:guid}/submit")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> SubmitPayroll(Guid payrollRunId)
    {
        try
        {
            var result = await _payrollService.SubmitPayrollAsync(payrollRunId, GetCurrentUserId());
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payrollRunId:guid}/withdraw")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> WithdrawPayroll(Guid payrollRunId, [FromBody] WithdrawPayrollRequest? request)
    {
        try
        {
            var result = await _payrollService.WithdrawPayrollAsync(
                payrollRunId,
                GetCurrentUserId(),
                User.IsInRole("super-admin"),
                request?.WithdrawalReason);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("runs/{payrollRunId:guid}/register")]
    [Authorize(Roles = "cfo,super-admin")]
    public async Task<IActionResult> GetPayrollRegister(Guid payrollRunId)
    {
        try
        {
            var result = await _payrollService.GetPayrollRegisterAsync(payrollRunId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payrollRunId:guid}/approve")]
    [Authorize(Roles = "cfo,super-admin")]
    public async Task<IActionResult> ApprovePayroll(Guid payrollRunId, [FromBody] ApprovePayrollRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await _payrollService.ApprovePayrollAsync(payrollRunId, request, GetCurrentUserId());
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payrollRunId:guid}/reject")]
    [Authorize(Roles = "cfo,super-admin")]
    public async Task<IActionResult> RejectPayroll(Guid payrollRunId, [FromBody] RejectPayrollRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await _payrollService.RejectPayrollAsync(payrollRunId, request, GetCurrentUserId());
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payrollRunId:guid}/re-open")]
    [Authorize(Roles = "cfo,super-admin")]
    public async Task<IActionResult> ReopenPayroll(Guid payrollRunId, [FromBody] ReopenPayrollRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await _payrollService.ReopenPayrollAsync(
                payrollRunId,
                request,
                GetCurrentUserId(),
                User.IsInRole("super-admin"),
                User.IsInRole("cfo"));
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("runs/{payrollRunId:guid}/post-to-gl")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> PostToGeneralLedger(Guid payrollRunId)
    {
        try
        {
            var result = await _payrollService.PostToGeneralLedgerAsync(payrollRunId, GetCurrentUserId());
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("payslips/my-payslips")]
    [Authorize(Roles = "employee,super-admin")]
    public async Task<IActionResult> GetMyPayslips()
    {
        var result = await _payrollService.GetMyPayslipsAsync(GetCurrentUserId());
        return Ok(result);
    }

    [HttpGet("payslips/{payslipId:guid}")]
    [Authorize(Roles = "employee,accountant,cfo,super-admin")]
    public async Task<IActionResult> DownloadPayslip(Guid payslipId)
    {
        var canViewAny = User.IsInRole("accountant") || User.IsInRole("cfo") || User.IsInRole("super-admin");

        try
        {
            var bytes = await _payrollService.GetPayslipPdfAsync(payslipId, GetCurrentUserId(), canViewAny);
            return File(bytes, "application/pdf", $"payslip-{payslipId}.pdf");
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("tax-tables")]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> CreateTaxTable([FromBody] CreateTaxTableRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var result = await _payrollService.CreateTaxTableAsync(request);
            return CreatedAtAction(nameof(GetTaxTables), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("tax-tables")]
    [Authorize(Roles = "super-admin,accountant,cfo")]
    public async Task<IActionResult> GetTaxTables([FromQuery] int? year = null, [FromQuery] TaxTableType? type = null)
    {
        var result = await _payrollService.GetTaxTablesAsync(year, type);
        return Ok(result);
    }

    [HttpPut("tax-tables/{id:guid}")]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> UpdateTaxTable(Guid id, [FromBody] CreateTaxTableRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            var result = await _payrollService.UpdateTaxTableAsync(id, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("tax-tables/{id:guid}")]
    [Authorize(Roles = "super-admin")]
    public async Task<IActionResult> DeleteTaxTable(Guid id)
    {
        try
        {
            await _payrollService.DeleteTaxTableAsync(id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("integration-capabilities")]
    [Authorize(Roles = "super-admin,accountant,cfo")]
    public async Task<IActionResult> GetIntegrationCapabilities()
    {
        var result = await _payrollService.GetIntegrationCapabilitiesAsync();
        return Ok(result);
    }

    private string GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? string.Empty;
    }
}
