using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CMNetwork.WebApi.Controllers;

[ApiController]
[Route("api/loan-review")]
public class LoanReviewController : ControllerBase
{
    private const decimal MinimumLoanAmount = 10000m;

    private static readonly LoanTierViewModel[] DefaultInterestTiers =
    [
        new(3, 5m),
        new(6, 7m),
        new(12, 10m),
        new(24, 14m),
        new(36, 18m)
    ];

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
                approvedAmount = x.ApprovedAmount,
                requestedTermMonths = x.TermMonths,
                approvedTermMonths = x.ApprovedTermMonths,
                purpose = x.Purpose,
                interestRate = x.InterestRate,
                status = x.Status.ToString(),
                submittedAt = x.SubmittedAtUtc
            })
            .ToListAsync();

        return Ok(applications);
    }

    [Authorize(Roles = "accountant")]
    [HttpGet("applications/{applicationId:guid}")]
    public async Task<IActionResult> GetApplicationForReview(Guid applicationId)
    {
        var app = await _dbContext.CustomerLoanApplications
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        var exposure = await CalculateCurrentExposureAsync(app.CustomerId);
        var availableCredit = GetAvailableCredit(app.Customer?.CreditLimit ?? 0m, exposure);

        return Ok(new
        {
            id = app.Id,
            customerId = app.CustomerId,
            customerName = app.Customer?.Name,
            requestedAmount = app.RequestedAmount,
            approvedAmount = app.ApprovedAmount,
            requestedTermMonths = app.TermMonths,
            approvedTermMonths = app.ApprovedTermMonths,
            interestRate = app.InterestRate,
            purpose = app.Purpose,
            status = app.Status.ToString(),
            accountantReviewNotes = app.AccountantReviewNotes,
            cfoNotes = app.CfoNotes,
            submittedAt = app.SubmittedAtUtc,
            reviewedAt = app.ReviewedAtUtc,
            approvedOrRejectedAt = app.ApprovedOrRejectedAtUtc,
            creditLimit = app.Customer?.CreditLimit ?? 0m,
            currentExposure = exposure,
            availableCredit
        });
    }

    [Authorize(Roles = "accountant")]
    [HttpPost("applications/{applicationId:guid}/review")]
    public async Task<IActionResult> ReviewApplicationForCfo(
        Guid applicationId,
        [FromBody] ReviewLoanApplicationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AccountantNotes))
            return BadRequest(new { message = "Review notes are required." });

        var app = await _dbContext.CustomerLoanApplications
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        if (app.Status != LoanApplicationStatus.Submitted)
            return BadRequest(new { message = "Only submitted applications can be reviewed." });

        var effectiveAmount = request.ApprovedAmount ?? app.ApprovedAmount ?? app.RequestedAmount;
        var effectiveTermMonths = request.ApprovedTermMonths ?? app.ApprovedTermMonths ?? app.TermMonths;

        if (effectiveAmount < MinimumLoanAmount)
            return BadRequest(new { message = $"Approved amount must be at least {MinimumLoanAmount:N0}." });

        var annualRate = await ResolveAnnualRateAsync(effectiveTermMonths);
        if (!annualRate.HasValue)
        {
            var terms = (await GetActiveInterestTiersAsync()).Select(x => x.TermMonths).ToArray();
            return BadRequest(new { message = "Selected term is not available in current loan policy.", availableTerms = terms });
        }

        var customer = app.Customer;
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var exposure = await CalculateCurrentExposureAsync(customer.Id);
        if (WouldExceedCreditLimit(customer.CreditLimit, exposure, effectiveAmount))
        {
            return BadRequest(new
            {
                message = "Approved amount exceeds customer available credit.",
                creditLimit = customer.CreditLimit,
                currentExposure = exposure,
                availableCredit = GetAvailableCredit(customer.CreditLimit, exposure)
            });
        }

        var userId = GetCurrentUserId();
        app.AccountantReviewNotes = request.AccountantNotes.Trim();
        app.ReviewedAtUtc = DateTime.UtcNow;
        app.ReviewedByUserId = userId;
        app.ApprovedAmount = effectiveAmount;
        app.ApprovedTermMonths = effectiveTermMonths;
        app.InterestRate = annualRate.Value;

        _dbContext.CustomerLoanApplications.Update(app);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Accountant {UserId} reviewed loan application {ApplicationId} with amount {Amount:C} and term {Term} months", 
            userId, applicationId, effectiveAmount, effectiveTermMonths);

        return Ok(new
        {
            message = "Application forwarded to CFO for approval decision.",
            applicationId = app.Id,
            status = app.Status.ToString(),
            approvedAmount = app.ApprovedAmount,
            approvedTermMonths = app.ApprovedTermMonths,
            annualInterestRate = app.InterestRate
        });
    }

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
                approvedAmount = x.ApprovedAmount,
                requestedTermMonths = x.TermMonths,
                approvedTermMonths = x.ApprovedTermMonths,
                annualInterestRate = x.InterestRate,
                purpose = x.Purpose,
                accountantNotes = x.AccountantReviewNotes,
                reviewedAt = x.ReviewedAtUtc
            })
            .ToListAsync();

        return Ok(applications);
    }

    [Authorize(Roles = "cfo")]
    [HttpPost("applications/{applicationId:guid}/approve")]
    public async Task<IActionResult> ApproveLoanApplication(
        Guid applicationId,
        [FromBody] ApproveLoanApplicationRequest request)
    {
        var app = await _dbContext.CustomerLoanApplications
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == applicationId);

        if (app is null)
            return NotFound(new { message = "Application not found." });

        if (app.Status != LoanApplicationStatus.Submitted)
            return BadRequest(new { message = "Only submitted applications can be approved." });

        if (app.ReviewedAtUtc is null)
            return BadRequest(new { message = "Application must be reviewed by accountant first." });

        var finalAmount = request.ApprovedAmount ?? app.ApprovedAmount ?? app.RequestedAmount;
        var finalTermMonths = request.ApprovedTermMonths ?? app.ApprovedTermMonths ?? app.TermMonths;

        if (finalAmount < MinimumLoanAmount)
            return BadRequest(new { message = $"Approved amount must be at least {MinimumLoanAmount:N0}." });

        var annualRate = await ResolveAnnualRateAsync(finalTermMonths);
        if (!annualRate.HasValue)
        {
            var terms = (await GetActiveInterestTiersAsync()).Select(x => x.TermMonths).ToArray();
            return BadRequest(new { message = "Selected term is not available in current loan policy.", availableTerms = terms });
        }

        var customer = app.Customer;
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var exposure = await CalculateCurrentExposureAsync(customer.Id);
        if (WouldExceedCreditLimit(customer.CreditLimit, exposure, finalAmount))
        {
            return BadRequest(new
            {
                message = "Approved amount exceeds customer available credit.",
                creditLimit = customer.CreditLimit,
                currentExposure = exposure,
                availableCredit = GetAvailableCredit(customer.CreditLimit, exposure)
            });
        }

        var userId = GetCurrentUserId();
        app.Status = LoanApplicationStatus.Approved;
        app.CfoNotes = request.CfoNotes?.Trim() ?? string.Empty;
        app.ApprovedOrRejectedAtUtc = DateTime.UtcNow;
        app.ApprovedOrRejectedByUserId = userId;
        app.ApprovedAmount = finalAmount;
        app.ApprovedTermMonths = finalTermMonths;
        app.InterestRate = annualRate.Value;

        _dbContext.CustomerLoanApplications.Update(app);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("CFO {UserId} approved loan application {ApplicationId} amount {Amount:C} term {Term} months",
            userId, applicationId, finalAmount, finalTermMonths);

        return Ok(new
        {
            message = "Loan application approved. Ready for disbursement by accountant.",
            applicationId = app.Id,
            status = app.Status.ToString(),
            approvedAmount = app.ApprovedAmount,
            approvedTermMonths = app.ApprovedTermMonths,
            annualInterestRate = app.InterestRate
        });
    }

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
                approvedAmount = x.ApprovedAmount,
                requestedTermMonths = x.TermMonths,
                approvedTermMonths = x.ApprovedTermMonths,
                purpose = x.Purpose,
                interestRate = x.InterestRate,
                approvedAt = x.ApprovedOrRejectedAtUtc
            })
            .ToListAsync();

        return Ok(applications);
    }

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

        var existingLoan = await _dbContext.CustomerLoans
            .FirstOrDefaultAsync(x => x.LoanApplicationId == applicationId);

        if (existingLoan is not null)
            return BadRequest(new { message = "Loan has already been disbursed." });

        var customer = await _dbContext.Customers
            .FirstOrDefaultAsync(x => x.Id == app.CustomerId);

        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var finalAmount = app.ApprovedAmount ?? app.RequestedAmount;
        var finalTermMonths = app.ApprovedTermMonths ?? app.TermMonths;

        var annualRate = await ResolveAnnualRateAsync(finalTermMonths);
        if (!annualRate.HasValue)
        {
            return BadRequest(new { message = "Loan cannot be disbursed because selected term has no active interest tier." });
        }

        app.InterestRate = annualRate.Value;

        var userId = GetCurrentUserId();

        var loan = new CustomerLoan
        {
            CustomerId = app.CustomerId,
            LoanApplicationId = app.Id,
            PrincipalAmount = finalAmount,
            OutstandingPrincipal = finalAmount,
            InterestRate = annualRate.Value,
            TermMonths = finalTermMonths,
            Status = LoanStatus.Active,
            DisbursedAtUtc = DateTime.UtcNow,
            StatusNotes = "Loan disbursed and active"
        };

        _dbContext.CustomerLoans.Add(loan);
        await _dbContext.SaveChangesAsync();

        var monthlyPayment = CalculateMonthlyPayment(finalAmount, annualRate.Value, finalTermMonths);

        var scheduledPayments = new List<CustomerLoanPayment>();
        var baseDate = DateTime.UtcNow.AddMonths(1);

        for (int month = 1; month <= finalTermMonths; month++)
        {
            var dueDate = baseDate.AddMonths(month - 1);
            var principalPortion = finalAmount / finalTermMonths;
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

        _dbContext.CustomerLoanApplications.Update(app);
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
            annualInterestRate = loan.InterestRate,
            monthlyPayment,
            totalPayments = finalTermMonths
        });
    }

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

    private async Task<List<LoanTierViewModel>> GetActiveInterestTiersAsync()
    {
        try
        {
            var tiers = await _dbContext.LoanInterestTiers
                .AsNoTracking()
                .Where(x => x.IsActive)
                .OrderBy(x => x.TermMonths)
                .Select(x => new LoanTierViewModel(x.TermMonths, x.AnnualInterestRate))
                .ToListAsync();

            if (tiers.Count > 0)
                return tiers;
        }
        catch
        {
            // Fallback for older schema where LoanInterestTiers table is unavailable.
        }

        return [.. DefaultInterestTiers];
    }

    private async Task<decimal?> ResolveAnnualRateAsync(int termMonths)
    {
        var tiers = await GetActiveInterestTiersAsync();
        var matchedTier = tiers.FirstOrDefault(x => x.TermMonths == termMonths);
        return matchedTier?.AnnualInterestRate;
    }

    private async Task<decimal> CalculateCurrentExposureAsync(Guid customerId)
    {
        var outstandingLoanPrincipal = await _dbContext.CustomerLoans
            .Where(x => x.CustomerId == customerId &&
                        (x.Status == LoanStatus.Active || x.Status == LoanStatus.Overdue || x.Status == LoanStatus.Restructured))
            .SumAsync(x => (decimal?)x.OutstandingPrincipal) ?? 0m;

        var openArInvoices = await _dbContext.ARInvoices
            .Where(x => x.CustomerId == customerId &&
                        !x.IsDeleted &&
                        (x.Status == ARInvoiceStatus.Sent || x.Status == ARInvoiceStatus.Approved))
            .SumAsync(x => (decimal?)x.TotalAmount) ?? 0m;

        return outstandingLoanPrincipal + openArInvoices;
    }

    private static bool WouldExceedCreditLimit(decimal creditLimit, decimal currentExposure, decimal requestedAmount)
    {
        if (creditLimit <= 0)
            return true;

        return (currentExposure + requestedAmount) > creditLimit;
    }

    private static decimal GetAvailableCredit(decimal creditLimit, decimal currentExposure)
    {
        if (creditLimit <= 0)
            return 0m;

        return Math.Max(0m, creditLimit - currentExposure);
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

    private sealed record LoanTierViewModel(int TermMonths, decimal AnnualInterestRate);
}

public record ReviewLoanApplicationRequest(
    string AccountantNotes,
    decimal? ApprovedAmount = null,
    int? ApprovedTermMonths = null);

public record ApproveLoanApplicationRequest(
    string? CfoNotes = null,
    decimal? ApprovedAmount = null,
    int? ApprovedTermMonths = null);

public record RejectLoanApplicationRequest(string RejectionReason);