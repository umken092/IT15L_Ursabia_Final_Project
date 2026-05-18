using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.WebApi.Controllers;

[Authorize(Roles = "customer")]
[Route("api/customer")]
[ApiController]
public class LoansController : ControllerBase
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
    private readonly ICurrentCustomerService _currentCustomerService;
    private readonly ILogger<LoansController> _logger;

    public LoansController(
        CMNetworkDbContext dbContext,
        ICurrentCustomerService currentCustomerService,
        ILogger<LoansController> logger)
    {
        _dbContext = dbContext;
        _currentCustomerService = currentCustomerService;
        _logger = logger;
    }

    [HttpGet("loans/interest-tiers")]
    public async Task<IActionResult> GetInterestTiers()
    {
        var tiers = await GetActiveInterestTiersAsync();
        return Ok(tiers);
    }

    [HttpGet("loans/estimate")]
    public async Task<IActionResult> EstimateLoan([FromQuery] decimal requestedAmount, [FromQuery] int termMonths)
    {
        if (requestedAmount < MinimumLoanAmount)
            return BadRequest(new { message = $"Requested amount must be at least {MinimumLoanAmount:N0}." });

        if (termMonths <= 0)
            return BadRequest(new { message = "Term must be greater than zero." });

        var annualRate = await ResolveAnnualRateAsync(termMonths);
        if (!annualRate.HasValue)
        {
            var terms = (await GetActiveInterestTiersAsync()).Select(x => x.TermMonths).ToArray();
            return BadRequest(new { message = "Selected term is not available in current loan policy.", availableTerms = terms });
        }

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var exposure = await CalculateCurrentExposureAsync(customer.Id);
        var availableCredit = GetAvailableCredit(customer.CreditLimit, exposure);
        var monthlyPayment = CalculateMonthlyPayment(requestedAmount, annualRate.Value, termMonths);

        return Ok(new
        {
            requestedAmount,
            termMonths,
            annualInterestRate = annualRate.Value,
            monthlyPayment,
            totalRepayment = monthlyPayment * termMonths,
            totalInterest = (monthlyPayment * termMonths) - requestedAmount,
            availableCredit
        });
    }

    [HttpPost("loans/apply")]
    public async Task<IActionResult> ApplyForLoan([FromBody] ApplyLoanRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var gateResult = await ValidateLoanAccessAsync(customer);
        if (!gateResult.IsAllowed)
            return BadRequest(new { message = gateResult.Message });

        if (request.RequestedAmount < MinimumLoanAmount)
            return BadRequest(new { message = $"Requested amount must be at least {MinimumLoanAmount:N0}." });

        if (request.TermMonths <= 0)
            return BadRequest(new { message = "Term must be greater than zero." });

        if (string.IsNullOrWhiteSpace(request.Purpose))
            return BadRequest(new { message = "Purpose is required." });

        var annualRate = await ResolveAnnualRateAsync(request.TermMonths);
        if (!annualRate.HasValue)
        {
            var terms = (await GetActiveInterestTiersAsync()).Select(x => x.TermMonths).ToArray();
            return BadRequest(new { message = "Selected term is not available in current loan policy.", availableTerms = terms });
        }

        var pendingApp = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.CustomerId == customer.Id && x.Status == LoanApplicationStatus.Submitted);

        if (pendingApp is not null)
            return BadRequest(new { message = "You already have a pending loan application under review." });

        var exposure = await CalculateCurrentExposureAsync(customer.Id);
        if (WouldExceedCreditLimit(customer.CreditLimit, exposure, request.RequestedAmount))
        {
            return BadRequest(new
            {
                message = "Requested amount exceeds your available credit.",
                creditLimit = customer.CreditLimit,
                currentExposure = exposure,
                availableCredit = GetAvailableCredit(customer.CreditLimit, exposure)
            });
        }

        var application = new CustomerLoanApplication
        {
            CustomerId = customer.Id,
            RequestedAmount = request.RequestedAmount,
            InterestRate = annualRate.Value,
            TermMonths = request.TermMonths,
            Purpose = request.Purpose.Trim(),
            Status = LoanApplicationStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow
        };

        _dbContext.CustomerLoanApplications.Add(application);
        await _dbContext.SaveChangesAsync();

        var monthlyPayment = CalculateMonthlyPayment(request.RequestedAmount, annualRate.Value, request.TermMonths);

        _logger.LogInformation("Customer {CustomerId} submitted loan application {ApplicationId} for {Amount:C} at {Rate}% annual",
            customer.Id, application.Id, request.RequestedAmount, annualRate.Value);

        return Ok(new
        {
            message = "Loan application submitted successfully. An accountant will review it within 2-3 business days.",
            applicationId = application.Id,
            status = "Submitted",
            annualInterestRate = annualRate.Value,
            estimatedMonthlyPayment = monthlyPayment
        });
    }

    [HttpGet("loans")]
    public async Task<IActionResult> GetMyLoans()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var loans = await _dbContext.CustomerLoans
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.DisbursedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                principalAmount = x.PrincipalAmount,
                outstandingPrincipal = x.OutstandingPrincipal,
                interestRate = x.InterestRate,
                termMonths = x.TermMonths,
                status = x.Status.ToString(),
                disbursedAt = x.DisbursedAtUtc,
                fullyPaidAt = x.FullyPaidAtUtc,
                overdueSince = x.OverdueSinceUtc
            })
            .ToListAsync();

        var applications = await _dbContext.CustomerLoanApplications
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.SubmittedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                requestedAmount = x.RequestedAmount,
                approvedAmount = x.ApprovedAmount,
                requestedTermMonths = x.TermMonths,
                approvedTermMonths = x.ApprovedTermMonths,
                interestRate = x.InterestRate,
                status = x.Status.ToString(),
                purpose = x.Purpose,
                submittedAt = x.SubmittedAtUtc,
                reviewedAt = x.ReviewedAtUtc,
                approvedOrRejectedAt = x.ApprovedOrRejectedAtUtc
            })
            .ToListAsync();

        return Ok(new
        {
            activeLoans = loans.Where(x => x.status == "Active").ToList(),
            allLoans = loans,
            pendingApplications = applications.Where(x => x.status == "Submitted").ToList(),
            allApplications = applications
        });
    }

    [HttpGet("loans/{id:guid}")]
    public async Task<IActionResult> GetLoanDetail(Guid id)
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var loan = await _dbContext.CustomerLoans
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == id && x.CustomerId == customer.Id);

        if (loan is null)
            return NotFound(new { message = "Loan not found." });

        var payments = loan.Payments
            .OrderByDescending(x => x.DueAtUtc)
            .Select(x => new
            {
                id = x.Id,
                principalAmount = x.PrincipalAmount,
                interestAmount = x.InterestAmount,
                totalAmount = x.TotalAmount,
                status = x.Status.ToString(),
                dueAt = x.DueAtUtc,
                completedAt = x.CompletedAtUtc
            })
            .ToList();

        return Ok(new
        {
            id = loan.Id,
            principalAmount = loan.PrincipalAmount,
            outstandingPrincipal = loan.OutstandingPrincipal,
            totalInterestAccrued = loan.TotalInterestAccrued,
            interestRate = loan.InterestRate,
            termMonths = loan.TermMonths,
            status = loan.Status.ToString(),
            disbursedAt = loan.DisbursedAtUtc,
            fullyPaidAt = loan.FullyPaidAtUtc,
            overdueSince = loan.OverdueSinceUtc,
            statusNotes = loan.StatusNotes,
            payments
        });
    }

    [HttpGet("loans/applications/{id:guid}")]
    public async Task<IActionResult> GetApplicationDetail(Guid id)
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        var application = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.Id == id && x.CustomerId == customer.Id);

        if (application is null)
            return NotFound(new { message = "Application not found." });

        return Ok(new
        {
            id = application.Id,
            requestedAmount = application.RequestedAmount,
            approvedAmount = application.ApprovedAmount,
            interestRate = application.InterestRate,
            termMonths = application.TermMonths,
            approvedTermMonths = application.ApprovedTermMonths,
            purpose = application.Purpose,
            status = application.Status.ToString(),
            accountantReviewNotes = application.AccountantReviewNotes,
            cfoNotes = application.CfoNotes,
            submittedAt = application.SubmittedAtUtc,
            reviewedAt = application.ReviewedAtUtc,
            approvedOrRejectedAt = application.ApprovedOrRejectedAtUtc
        });
    }

    private async Task<LoanAccessValidation> ValidateLoanAccessAsync(Customer customer)
    {
        var hasExtendedColumns = await HasExtendedCustomerProfileColumnsAsync();

        if (!hasExtendedColumns)
            return new LoanAccessValidation
            {
                IsAllowed = false,
                Message = "Loan module requires database migration. Contact support."
            };

        var isBankVerified = customer.BankVerificationStatus == BankVerificationStatus.Verified;
        if (!isBankVerified)
            return new LoanAccessValidation
            {
                IsAllowed = false,
                Message = "Bank account verification is required to apply for a loan. Please verify your bank account in your profile."
            };

        var profileFields = new string?[]
        {
            customer.ContactPerson,
            customer.Email,
            customer.PhoneNumber,
            customer.Address,
            customer.City,
            customer.State,
            customer.Country,
            customer.PostalCode,
            customer.TIN,
            customer.SSS,
            customer.BankAccount,
            customer.BankName
        };

        var filledCount = profileFields.Count(f => !string.IsNullOrWhiteSpace(f));
        var completionPercentage = (int)Math.Round((filledCount / (double)profileFields.Length) * 100);

        if (completionPercentage < 100)
            return new LoanAccessValidation
            {
                IsAllowed = false,
                Message = $"Your profile is only {completionPercentage}% complete. Complete all required fields to apply for a loan."
            };

        return new LoanAccessValidation { IsAllowed = true, Message = "Loan access granted." };
    }

    private async Task<Customer?> GetCurrentCustomerAsync()
    {
        var customerId = _currentCustomerService.CustomerId;
        if (!customerId.HasValue)
            return null;

        return await _dbContext.Customers.FirstOrDefaultAsync(x => x.Id == customerId.Value);
    }

    private async Task<bool> HasExtendedCustomerProfileColumnsAsync()
    {
        try
        {
            await _dbContext.Customers
                .Select(x => new { x.TIN, x.SSS, x.BankAccount, x.BankName, x.BankVerificationStatus })
                .FirstOrDefaultAsync();
            return true;
        }
        catch
        {
            return false;
        }
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

    private static decimal CalculateMonthlyPayment(decimal principal, decimal annualRate, int months)
    {
        if (annualRate == 0)
            return principal / months;

        var monthlyRate = annualRate / 100 / 12;
        var numerator = monthlyRate * (decimal)Math.Pow(1 + (double)monthlyRate, months);
        var denominator = (decimal)Math.Pow(1 + (double)monthlyRate, months) - 1;
        return principal * (numerator / denominator);
    }

    private sealed class LoanAccessValidation
    {
        public bool IsAllowed { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    private sealed record LoanTierViewModel(int TermMonths, decimal AnnualInterestRate);
}

public record ApplyLoanRequest(
    decimal RequestedAmount,
    int TermMonths,
    string Purpose
);