using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CMNetwork.WebApi.Controllers;

/// <summary>
/// Loan review workflow for accountants and CFOs.
/// Accountant: review applications and forward to CFO
/// CFO: approve/reject applications
/// Accountant: disburse approved loans and post GL entries
/// </summary>
[ApiController]
[Route("api/loan-review")]
public class LoanReviewController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<LoanReviewController> _logger;

    public LoanReviewController(
        CMNetworkDbContext dbContext,
        ILogger<LoanReviewController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// [ACCOUNTANT] Get all pending loan applications awaiting review.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpGet("pending-applications")]
    public async Task<IActionResult> GetPendingApplications()
    {
        var applications = await _dbContext.CustomerLoanApplications
            .Where(x => x.Status == LoanApplicationStatus.Submitted)
            .Include(x => x.Customer)
            .OrderBy(x => x.SubmittedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer!.Name,
                requestedAmount = x.RequestedAmount,
                purpose = x.Purpose,
                interestRate = x.InterestRate,
                termMonths = x.TermMonths,
                status = x.Status.ToString(),
                submittedAt = x.SubmittedAtUtc
            })
            .ToListAsync();

        return Ok(applications);
    }

    /// <summary>
    /// [ACCOUNTANT] Get application details for review.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpGet("applications/{applicationId:guid}")]
    public async Task<IActionResult> GetApplicationForReview(Guid applicationId)
    {
        var app = await _dbContext.CustomerLoanApplications
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        return Ok(new
        {
            id = app.Id,
            customerId = app.CustomerId,
            customerName = app.Customer?.Name,
            requestedAmount = app.RequestedAmount,
            interestRate = app.InterestRate,
            termMonths = app.TermMonths,
            purpose = app.Purpose,
            status = app.Status.ToString(),
            accountantReviewNotes = app.AccountantReviewNotes,
            cfoNotes = app.CfoNotes,
            submittedAt = app.SubmittedAtUtc,
            reviewedAt = app.ReviewedAtUtc,
            approvedOrRejectedAt = app.ApprovedOrRejectedAtUtc
        });
    }

    /// <summary>
    /// [ACCOUNTANT] Review loan application and forward to CFO.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpPost("applications/{applicationId:guid}/review")]
    public async Task<IActionResult> ReviewApplicationForCfo(
        Guid applicationId,
        [FromBody] ReviewLoanApplicationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AccountantNotes))
            return BadRequest(new { message = "Review notes are required." });

        var app = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        if (app.Status != LoanApplicationStatus.Submitted)
            return BadRequest(new { message = "Only submitted applications can be reviewed." });

        var userId = GetCurrentUserId();
        app.AccountantReviewNotes = request.AccountantNotes.Trim();
        app.ReviewedAtUtc = DateTime.UtcNow;
        app.ReviewedByUserId = userId;
        // Don't change status - remain "Submitted" until CFO acts

        _dbContext.CustomerLoanApplications.Update(app);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Accountant {UserId} reviewed loan application {ApplicationId}", 
            userId, applicationId);

        return Ok(new
        {
            message = "Application forwarded to CFO for approval decision.",
            applicationId = app.Id,
            status = app.Status.ToString()
        });
    }

    /// <summary>
    /// [CFO] Get all applications pending CFO approval (those reviewed by accountant).
    /// </summary>
    [Authorize(Roles = "cfo")]
    [HttpGet("pending-cfo-approval")]
    public async Task<IActionResult> GetPendingCfoApproval()
    {
        var applications = await _dbContext.CustomerLoanApplications
            .Where(x => x.Status == LoanApplicationStatus.Submitted && x.ReviewedAtUtc != null)
            .Include(x => x.Customer)
            .OrderBy(x => x.ReviewedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer!.Name,
                requestedAmount = x.RequestedAmount,
                purpose = x.Purpose,
                accountantNotes = x.AccountantReviewNotes,
                reviewedAt = x.ReviewedAtUtc
            })
            .ToListAsync();

        return Ok(applications);
    }

    /// <summary>
    /// [CFO] Approve a loan application.
    /// </summary>
    [Authorize(Roles = "cfo")]
    [HttpPost("applications/{applicationId:guid}/approve")]
    public async Task<IActionResult> ApproveLoanApplication(
        Guid applicationId,
        [FromBody] ApproveLoanApplicationRequest request)
    {
        var app = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        if (app.Status != LoanApplicationStatus.Submitted)
            return BadRequest(new { message = "Only submitted applications can be approved." });

        if (app.ReviewedAtUtc is null)
            return BadRequest(new { message = "Application must be reviewed by accountant first." });

        var userId = GetCurrentUserId();
        app.Status = LoanApplicationStatus.Approved;
        app.CfoNotes = request.CfoNotes?.Trim() ?? string.Empty;
        app.ApprovedOrRejectedAtUtc = DateTime.UtcNow;
        app.ApprovedOrRejectedByUserId = userId;

        _dbContext.CustomerLoanApplications.Update(app);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("CFO {UserId} approved loan application {ApplicationId}", 
            userId, applicationId);

        return Ok(new
        {
            message = "Loan application approved. Ready for disbursement by accountant.",
            applicationId = app.Id,
            status = app.Status.ToString()
        });
    }

    /// <summary>
    /// [CFO] Reject a loan application.
    /// </summary>
    [Authorize(Roles = "cfo")]
    [HttpPost("applications/{applicationId:guid}/reject")]
    public async Task<IActionResult> RejectLoanApplication(
        Guid applicationId,
        [FromBody] RejectLoanApplicationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RejectionReason))
            return BadRequest(new { message = "Rejection reason is required." });

        var app = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        if (app.Status != LoanApplicationStatus.Submitted)
            return BadRequest(new { message = "Only submitted applications can be rejected." });

        var userId = GetCurrentUserId();
        app.Status = LoanApplicationStatus.Rejected;
        app.CfoNotes = request.RejectionReason.Trim();
        app.ApprovedOrRejectedAtUtc = DateTime.UtcNow;
        app.ApprovedOrRejectedByUserId = userId;

        _dbContext.CustomerLoanApplications.Update(app);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("CFO {UserId} rejected loan application {ApplicationId}", 
            userId, applicationId);

        return Ok(new
        {
            message = "Loan application rejected.",
            applicationId = app.Id,
            status = app.Status.ToString()
        });
    }

    /// <summary>
    /// [ACCOUNTANT] Get approved applications ready for disbursement.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpGet("approved-for-disbursement")]
    public async Task<IActionResult> GetApprovedForDisbursement()
    {
        var applications = await _dbContext.CustomerLoanApplications
            .Where(x => x.Status == LoanApplicationStatus.Approved)
            .Include(x => x.Customer)
            .OrderBy(x => x.ApprovedOrRejectedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer!.Name,
                requestedAmount = x.RequestedAmount,
                purpose = x.Purpose,
                interestRate = x.InterestRate,
                termMonths = x.TermMonths,
                approvedAt = x.ApprovedOrRejectedAtUtc
            })
            .ToListAsync();

        return Ok(applications);
    }

    /// <summary>
    /// [ACCOUNTANT] Disburse an approved loan and create active loan record.
    /// Creates CustomerLoan record and schedules payment plan.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpPost("applications/{applicationId:guid}/disburse")]
    public async Task<IActionResult> DisburseLoan(Guid applicationId)
    {
        var app = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        if (app.Status != LoanApplicationStatus.Approved)
            return BadRequest(new { message = "Only approved applications can be disbursed." });

        // Check if already disbursed
        var existingLoan = await _dbContext.CustomerLoans
            .FirstOrDefaultAsync(x => x.LoanApplicationId == applicationId);

        if (existingLoan is not null)
            return BadRequest(new { message = "Loan has already been disbursed." });

        var customer = await _dbContext.Customers
            .FirstOrDefaultAsync(x => x.Id == app.CustomerId);

        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var userId = GetCurrentUserId();

        // Create active loan record
        var loan = new CustomerLoan
        {
            CustomerId = app.CustomerId,
            LoanApplicationId = app.Id,
            PrincipalAmount = app.RequestedAmount,
            OutstandingPrincipal = app.RequestedAmount,
            InterestRate = app.InterestRate,
            TermMonths = app.TermMonths,
            Status = LoanStatus.Active,
            DisbursedAtUtc = DateTime.UtcNow,
            StatusNotes = "Loan disbursed and active"
        };

        _dbContext.CustomerLoans.Add(loan);
        await _dbContext.SaveChangesAsync();

        // Schedule payments (monthly installments)
        var monthlyPayment = CalculateMonthlyPayment(
            app.RequestedAmount, app.InterestRate, app.TermMonths);

        var scheduledPayments = new List<CustomerLoanPayment>();
        var baseDate = DateTime.UtcNow.AddMonths(1);

        for (int month = 1; month <= app.TermMonths; month++)
        {
            var dueDate = baseDate.AddMonths(month - 1);
            var principalPortion = app.RequestedAmount / app.TermMonths;
            var interestPortion = monthlyPayment - principalPortion;

            var payment = new CustomerLoanPayment
            {
                LoanId = loan.Id,
                PrincipalAmount = principalPortion,
                InterestAmount = interestPortion,
                TotalAmount = monthlyPayment,
                PaymentMethod = "Scheduled",
                Status = LoanPaymentStatus.Scheduled,
                DueAtUtc = dueDate
            };

            scheduledPayments.Add(payment);
            loan.TotalInterestAccrued += interestPortion;
        }

        _dbContext.CustomerLoanPayments.AddRange(scheduledPayments);
        _dbContext.CustomerLoans.Update(loan);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Accountant {UserId} disbursed loan {LoanId} for application {ApplicationId}. Monthly payment: {MonthlyPayment:C}",
            userId, loan.Id, applicationId, monthlyPayment);

        return Ok(new
        {
            message = "Loan disbursed successfully. Payment schedule created.",
            loanId = loan.Id,
            principalAmount = loan.PrincipalAmount,
            monthlyPayment,
            totalPayments = app.TermMonths
        });
    }

    private decimal CalculateMonthlyPayment(decimal principal, decimal annualRate, int months)
    {
        if (annualRate == 0)
            return principal / months;

        var monthlyRate = annualRate / 100 / 12;
        var numerator = monthlyRate * (decimal)Math.Pow(1 + (double)monthlyRate, months);
        var denominator = (decimal)Math.Pow(1 + (double)monthlyRate, months) - 1;
        return principal * (numerator / denominator);
    }

    /// <summary>
    /// [ACCOUNTANT] Get active loans for monitoring.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpGet("active-loans")]
    public async Task<IActionResult> GetActiveLoans()
    {
        var loans = await _dbContext.CustomerLoans
            .Where(x => x.Status == LoanStatus.Active)
            .Include(x => x.Customer)
            .Include(x => x.Payments)
            .OrderBy(x => x.DisbursedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer!.Name,
                principalAmount = x.PrincipalAmount,
                outstandingPrincipal = x.OutstandingPrincipal,
                interestRate = x.InterestRate,
                disbursedAt = x.DisbursedAtUtc,
                nextPaymentDue = x.Payments
                    .Where(p => p.Status == LoanPaymentStatus.Scheduled)
                    .Min(p => (DateTime?)p.DueAtUtc),
                overduePayments = x.Payments.Count(p => p.Status == LoanPaymentStatus.Overdue)
            })
            .ToListAsync();

        return Ok(loans);
    }
}

// Request/Response DTOs
public record ReviewLoanApplicationRequest(string AccountantNotes);
public record ApproveLoanApplicationRequest(string? CfoNotes = null);
public record RejectLoanApplicationRequest(string RejectionReason);
