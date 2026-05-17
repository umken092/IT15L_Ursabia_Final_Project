using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CMNetwork.WebApi.Controllers;

/// <summary>
/// Loan management for auditors and administrators.
/// Auditors: view-only loan reports and audit trails
/// Admins: manage loan lifecycle (restructure, write-off, manual adjustments)
/// </summary>
[ApiController]
[Route("api/loan-management")]
public class LoanManagementController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<LoanManagementController> _logger;

    public LoanManagementController(
        CMNetworkDbContext dbContext,
        ILogger<LoanManagementController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    /// <summary>
    /// [AUDITOR, SUPER-ADMIN] Get summary statistics of all loans.
    /// </summary>
    [Authorize(Roles = "auditor,super-admin")]
    [HttpGet("summary")]
    public async Task<IActionResult> GetLoanSummary()
    {
        var activeLoanCount = await _dbContext.CustomerLoans
            .CountAsync(x => x.Status == LoanStatus.Active);

        var overdueCount = await _dbContext.CustomerLoans
            .CountAsync(x => x.Status == LoanStatus.Overdue);

        var totalPrincipal = await _dbContext.CustomerLoans
            .Where(x => x.Status == LoanStatus.Active || x.Status == LoanStatus.Overdue)
            .SumAsync(x => x.PrincipalAmount);

        var totalOutstanding = await _dbContext.CustomerLoans
            .Where(x => x.Status == LoanStatus.Active || x.Status == LoanStatus.Overdue)
            .SumAsync(x => x.OutstandingPrincipal);

        var fullyPaidCount = await _dbContext.CustomerLoans
            .CountAsync(x => x.Status == LoanStatus.FullyPaid);

        var pendingApplicationCount = await _dbContext.CustomerLoanApplications
            .CountAsync(x => x.Status == LoanApplicationStatus.Submitted);

        return Ok(new
        {
            activeLoanCount,
            overdueCount,
            totalPrincipal,
            totalOutstanding,
            fullyPaidCount,
            pendingApplicationCount,
            portfolioHealth = CalculatePortfolioHealth(activeLoanCount, overdueCount)
        });
    }

    /// <summary>
    /// [AUDITOR, SUPER-ADMIN] Get all loans with filtering options.
    /// </summary>
    [Authorize(Roles = "auditor,super-admin")]
    [HttpGet("all-loans")]
    public async Task<IActionResult> GetAllLoans(
        [FromQuery] string? status = null,
        [FromQuery] string? customerId = null)
    {
        var query = _dbContext.CustomerLoans
            .Include(x => x.Customer)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<LoanStatus>(status, out var loanStatus))
            query = query.Where(x => x.Status == loanStatus);

        if (!string.IsNullOrEmpty(customerId) && Guid.TryParse(customerId, out var custId))
            query = query.Where(x => x.CustomerId == custId);

        var loans = await query
            .OrderByDescending(x => x.DisbursedAtUtc)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer!.Name,
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

        return Ok(loans);
    }

    /// <summary>
    /// [AUDITOR, SUPER-ADMIN] Get detailed loan information including payment history.
    /// </summary>
    [Authorize(Roles = "auditor,super-admin")]
    [HttpGet("loans/{loanId:guid}/details")]
    public async Task<IActionResult> GetLoanDetails(Guid loanId)
    {
        var loan = await _dbContext.CustomerLoans
            .Include(x => x.Customer)
            .Include(x => x.LoanApplication)
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == loanId);

        if (loan is null)
            return NotFound(new { message = "Loan not found." });

        var payments = loan.Payments
            .OrderBy(x => x.DueAtUtc)
            .Select(x => new
            {
                id = x.Id,
                dueAt = x.DueAtUtc,
                principalAmount = x.PrincipalAmount,
                interestAmount = x.InterestAmount,
                totalAmount = x.TotalAmount,
                status = x.Status.ToString(),
                completedAt = x.CompletedAtUtc,
                paymentMethod = x.PaymentMethod
            })
            .ToList();

        return Ok(new
        {
            id = loan.Id,
            customerId = loan.CustomerId,
            customerName = loan.Customer?.Name,
            principalAmount = loan.PrincipalAmount,
            outstandingPrincipal = loan.OutstandingPrincipal,
            totalInterestAccrued = loan.TotalInterestAccrued,
            interestRate = loan.InterestRate,
            termMonths = loan.TermMonths,
            status = loan.Status.ToString(),
            statusNotes = loan.StatusNotes,
            disbursedAt = loan.DisbursedAtUtc,
            fullyPaidAt = loan.FullyPaidAtUtc,
            overdueSince = loan.OverdueSinceUtc,
            createdAt = loan.CreatedAtUtc,
            payments
        });
    }

    /// <summary>
    /// [SUPER-ADMIN] Restructure a loan (extend term, modify interest rate).
    /// </summary>
    [Authorize(Roles = "super-admin")]
    [HttpPost("loans/{loanId:guid}/restructure")]
    public async Task<IActionResult> RestructureLoan(
        Guid loanId,
        [FromBody] RestructureLoanRequest request)
    {
        if (request.NewTermMonths <= 0)
            return BadRequest(new { message = "New term must be greater than zero." });

        var loan = await _dbContext.CustomerLoans
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == loanId);

        if (loan is null)
            return NotFound(new { message = "Loan not found." });

        if (loan.Status == LoanStatus.FullyPaid || loan.Status == LoanStatus.WrittenOff)
            return BadRequest(new { message = "Cannot restructure completed or written-off loans." });

        var userId = GetCurrentUserId();

        // Update loan terms
        loan.TermMonths = request.NewTermMonths;
        if (request.NewInterestRate.HasValue)
            loan.InterestRate = request.NewInterestRate.Value;

        loan.Status = LoanStatus.Restructured;
        loan.StatusNotes = request.RestructureReason ?? "Loan restructured by admin";

        // Recalculate payment schedule
        var completedPayments = loan.Payments.Where(x => 
            x.Status == LoanPaymentStatus.Completed || 
            x.Status == LoanPaymentStatus.Waived).ToList();

        var remainingPrincipal = loan.OutstandingPrincipal;
        var remainingMonths = request.NewTermMonths;

        // Delete old scheduled payments
        var oldScheduledPayments = loan.Payments
            .Where(x => x.Status == LoanPaymentStatus.Scheduled)
            .ToList();

        foreach (var payment in oldScheduledPayments)
            _dbContext.CustomerLoanPayments.Remove(payment);

        // Create new payment schedule
        var monthlyPayment = CalculateMonthlyPayment(remainingPrincipal, loan.InterestRate, remainingMonths);
        var baseDate = DateTime.UtcNow.AddMonths(1);

        for (int month = 1; month <= remainingMonths; month++)
        {
            var dueDate = baseDate.AddMonths(month - 1);
            var principalPortion = remainingPrincipal / remainingMonths;
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

            _dbContext.CustomerLoanPayments.Add(payment);
        }

        _dbContext.CustomerLoans.Update(loan);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Admin {UserId} restructured loan {LoanId}. New term: {NewTerm} months. New rate: {NewRate}%",
            userId, loanId, request.NewTermMonths, request.NewInterestRate ?? loan.InterestRate);

        return Ok(new
        {
            message = "Loan restructured successfully.",
            loanId = loan.Id,
            newTermMonths = request.NewTermMonths,
            newInterestRate = loan.InterestRate,
            newMonthlyPayment = monthlyPayment,
            status = loan.Status.ToString()
        });
    }

    /// <summary>
    /// [SUPER-ADMIN] Write off a loan (mark as uncollectible).
    /// </summary>
    [Authorize(Roles = "super-admin")]
    [HttpPost("loans/{loanId:guid}/write-off")]
    public async Task<IActionResult> WriteOffLoan(
        Guid loanId,
        [FromBody] WriteOffLoanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.WriteOffReason))
            return BadRequest(new { message = "Write-off reason is required." });

        var loan = await _dbContext.CustomerLoans
            .FirstOrDefaultAsync(x => x.Id == loanId);

        if (loan is null)
            return NotFound(new { message = "Loan not found." });

        if (loan.Status == LoanStatus.FullyPaid || loan.Status == LoanStatus.WrittenOff)
            return BadRequest(new { message = "Cannot write off fully paid or already written-off loans." });

        var userId = GetCurrentUserId();

        loan.Status = LoanStatus.WrittenOff;
        loan.StatusNotes = request.WriteOffReason.Trim();

        _dbContext.CustomerLoans.Update(loan);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Admin {UserId} wrote off loan {LoanId}. Reason: {Reason}",
            userId, loanId, request.WriteOffReason);

        return Ok(new
        {
            message = "Loan written off successfully.",
            loanId = loan.Id,
            status = loan.Status.ToString()
        });
    }

    /// <summary>
    /// [AUDITOR, SUPER-ADMIN] Get overdue loans report.
    /// </summary>
    [Authorize(Roles = "auditor,super-admin")]
    [HttpGet("overdue-report")]
    public async Task<IActionResult> GetOverdueLoansReport()
    {
        var overdueLoans = await _dbContext.CustomerLoans
            .Where(x => x.Status == LoanStatus.Overdue)
            .Include(x => x.Customer)
            .Include(x => x.Payments)
            .OrderBy(x => x.OverdueSinceUtc)
            .Select(x => new
            {
                id = x.Id,
                customerId = x.CustomerId,
                customerName = x.Customer!.Name,
                principalAmount = x.PrincipalAmount,
                outstandingPrincipal = x.OutstandingPrincipal,
                overdueSince = x.OverdueSinceUtc,
                daysOverdue = (int)(DateTime.UtcNow - x.OverdueSinceUtc!.Value).TotalDays,
                overduePaymentCount = x.Payments.Count(p => p.Status == LoanPaymentStatus.Overdue),
                totalOverdueAmount = x.Payments
                    .Where(p => p.Status == LoanPaymentStatus.Overdue)
                    .Sum(p => p.TotalAmount)
            })
            .ToListAsync();

        return Ok(new
        {
            totalOverdueLoans = overdueLoans.Count,
            totalOverdueAmount = overdueLoans.Sum(x => x.totalOverdueAmount),
            loans = overdueLoans
        });
    }

    private string CalculatePortfolioHealth(int activeCount, int overdueCount)
    {
        if (activeCount == 0) return "No Active Loans";
        var overduePercentage = (double)overdueCount / activeCount * 100;
        return overduePercentage switch
        {
            < 2 => "Excellent",
            < 5 => "Good",
            < 10 => "Fair",
            < 15 => "Poor",
            _ => "Critical"
        };
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
}

public record RestructureLoanRequest(
    int NewTermMonths,
    decimal? NewInterestRate = null,
    string? RestructureReason = null);

public record WriteOffLoanRequest(string WriteOffReason);
