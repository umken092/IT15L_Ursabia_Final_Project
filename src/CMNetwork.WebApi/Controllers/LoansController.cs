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

    /// <summary>
    /// Apply for a new loan. Customer must have 100% complete profile + verified bank account.
    /// </summary>
    [HttpPost("loans/apply")]
    public async Task<IActionResult> ApplyForLoan([FromBody] ApplyLoanRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return NotFound(new { message = "Customer not found." });

        // Gate: 100% profile completion + bank verified
        var gateResult = await ValidateLoanAccessAsync(customer);
        if (!gateResult.IsAllowed)
            return BadRequest(new { message = gateResult.Message });

        // Validate request
        if (request.RequestedAmount <= 0)
            return BadRequest(new { message = "Requested amount must be greater than zero." });

        if (request.TermMonths <= 0)
            return BadRequest(new { message = "Term must be greater than zero." });

        if (request.InterestRate < 0)
            return BadRequest(new { message = "Interest rate cannot be negative." });

        if (string.IsNullOrWhiteSpace(request.Purpose))
            return BadRequest(new { message = "Purpose is required." });

        // Check for duplicate pending applications
        var pendingApp = await _dbContext.CustomerLoanApplications
            .FirstOrDefaultAsync(x => x.CustomerId == customer.Id && x.Status == LoanApplicationStatus.Submitted);

        if (pendingApp is not null)
            return BadRequest(new { message = "You already have a pending loan application under review." });

        // Create application
        var application = new CustomerLoanApplication
        {
            CustomerId = customer.Id,
            RequestedAmount = request.RequestedAmount,
            InterestRate = request.InterestRate,
            TermMonths = request.TermMonths,
            Purpose = request.Purpose?.Trim() ?? string.Empty,
            Status = LoanApplicationStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow
        };

        _dbContext.CustomerLoanApplications.Add(application);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Customer {CustomerId} submitted loan application {ApplicationId} for {Amount:C}", 
            customer.Id, application.Id, request.RequestedAmount);

        return Ok(new
        {
            message = "Loan application submitted successfully. An accountant will review it within 2-3 business days.",
            applicationId = application.Id,
            status = "Submitted"
        });
    }

    /// <summary>
    /// Get all loans (active and historical) for the current customer.
    /// </summary>
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

    /// <summary>
    /// Get details of a specific loan.
    /// </summary>
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

    /// <summary>
    /// Get status of a loan application.
    /// </summary>
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
            interestRate = application.InterestRate,
            termMonths = application.TermMonths,
            purpose = application.Purpose,
            status = application.Status.ToString(),
            accountantReviewNotes = application.AccountantReviewNotes,
            cfoNotes = application.CfoNotes,
            submittedAt = application.SubmittedAtUtc,
            reviewedAt = application.ReviewedAtUtc,
            approvedOrRejectedAt = application.ApprovedOrRejectedAtUtc
        });
    }

    /// <summary>
    /// Validate that customer meets loan access requirements (100% profile + verified bank).
    /// </summary>
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

    private class LoanAccessValidation
    {
        public bool IsAllowed { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}

public record ApplyLoanRequest(
    decimal RequestedAmount,
    decimal InterestRate,
    int TermMonths,
    string Purpose
);
