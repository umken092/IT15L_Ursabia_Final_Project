using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CMNetwork.WebApi.Controllers;

/// <summary>
/// Loan payment processing - customer payments and accountant reconciliation.
/// </summary>
[ApiController]
[Route("api/loan-payments")]
public class LoanPaymentController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ICurrentCustomerService _currentCustomerService;
    private readonly ILogger<LoanPaymentController> _logger;

    public LoanPaymentController(
        CMNetworkDbContext dbContext,
        ICurrentCustomerService currentCustomerService,
        ILogger<LoanPaymentController> logger)
    {
        _dbContext = dbContext;
        _currentCustomerService = currentCustomerService;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    private async Task<Customer?> GetCurrentCustomerAsync()
    {
        var customerId = _currentCustomerService.CustomerId;
        if (!customerId.HasValue)
            return null;

        return await _dbContext.Customers.FirstOrDefaultAsync(x => x.Id == customerId.Value);
    }

    /// <summary>
    /// [CUSTOMER] Get payment schedule for a specific loan.
    /// </summary>
    [Authorize(Roles = "customer")]
    [HttpGet("loans/{loanId:guid}/schedule")]
    public async Task<IActionResult> GetPaymentSchedule(Guid loanId)
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return Unauthorized();

        var loan = await _dbContext.CustomerLoans
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == loanId && x.CustomerId == customer.Id);

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
            loanId = loan.Id,
            principalAmount = loan.PrincipalAmount,
            outstandingPrincipal = loan.OutstandingPrincipal,
            totalInterestAccrued = loan.TotalInterestAccrued,
            interestRate = loan.InterestRate,
            status = loan.Status.ToString(),
            payments
        });
    }

    /// <summary>
    /// [CUSTOMER] Record a manual loan payment (bank transfer, check, etc.).
    /// </summary>
    [Authorize(Roles = "customer")]
    [HttpPost("loans/{loanId:guid}/pay-manual")]
    public async Task<IActionResult> RecordManualPayment(
        Guid loanId,
        [FromBody] RecordManualPaymentRequest request)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Payment amount must be greater than zero." });

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return Unauthorized();

        var loan = await _dbContext.CustomerLoans
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == loanId && x.CustomerId == customer.Id);

        if (loan is null)
            return NotFound(new { message = "Loan not found." });

        if (loan.Status != LoanStatus.Active)
            return BadRequest(new { message = "Can only pay on active loans." });

        // Find and mark next scheduled payment as completed
        var nextPayment = loan.Payments
            .Where(x => x.Status == LoanPaymentStatus.Scheduled)
            .OrderBy(x => x.DueAtUtc)
            .FirstOrDefault();

        if (nextPayment is null)
            return BadRequest(new { message = "No scheduled payments due." });

        if (Math.Abs(request.Amount - nextPayment.TotalAmount) > 0.01m) // Allow 1 cent tolerance
            return BadRequest(new { message = $"Payment amount must be exactly {nextPayment.TotalAmount:C} for the due installment. Partial payments not allowed." });

        nextPayment.Status = LoanPaymentStatus.Completed;
        nextPayment.CompletedAtUtc = DateTime.UtcNow;
        nextPayment.PaymentMethod = "BankTransfer";

        loan.OutstandingPrincipal -= nextPayment.PrincipalAmount;

        // Check if fully paid
        if (loan.OutstandingPrincipal <= 0)
        {
            loan.Status = LoanStatus.FullyPaid;
            loan.FullyPaidAtUtc = DateTime.UtcNow;
        }

        _dbContext.CustomerLoanPayments.Update(nextPayment);
        _dbContext.CustomerLoans.Update(loan);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Customer {CustomerId} paid {Amount:C} on loan {LoanId}",
            customer.Id, request.Amount, loanId);

        return Ok(new
        {
            message = "Payment recorded successfully.",
            paymentId = nextPayment.Id,
            amount = request.Amount,
            outstandingPrincipal = loan.OutstandingPrincipal,
            loanStatus = loan.Status.ToString()
        });
    }

    /// <summary>
    /// [ACCOUNTANT] Get all pending payments across all active loans.
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpGet("pending-payments")]
    public async Task<IActionResult> GetPendingPayments()
    {
        var today = DateTime.UtcNow.Date;

        var payments = await _dbContext.CustomerLoanPayments
            .Where(x => x.Status == LoanPaymentStatus.Scheduled && x.Loan!.Status == LoanStatus.Active)
            .Include(x => x.Loan)
            .ThenInclude(x => x!.Customer)
            .OrderBy(x => x.DueAtUtc)
            .Select(x => new
            {
                id = x.Id,
                loanId = x.LoanId,
                customerId = x.Loan!.CustomerId,
                customerName = x.Loan.Customer!.Name,
                dueAt = x.DueAtUtc,
                daysOverdue = today > x.DueAtUtc ? (int)(today - x.DueAtUtc).TotalDays : 0,
                totalAmount = x.TotalAmount,
                principalAmount = x.PrincipalAmount,
                interestAmount = x.InterestAmount
            })
            .ToListAsync();

        var overdueCount = payments.Count(x => x.daysOverdue > 0);
        var upcomingCount = payments.Count(x => x.daysOverdue <= 0);

        return Ok(new
        {
            summary = new { overdueCount, upcomingCount, totalCount = payments.Count },
            payments
        });
    }

    /// <summary>
    /// [ACCOUNTANT] Mark a payment as completed (for non-portal payments like bank transfers).
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpPost("payments/{paymentId:guid}/mark-completed")]
    public async Task<IActionResult> MarkPaymentCompleted(Guid paymentId)
    {
        var payment = await _dbContext.CustomerLoanPayments
            .Include(x => x.Loan)
            .FirstOrDefaultAsync(x => x.Id == paymentId);

        if (payment is null)
            return NotFound(new { message = "Payment not found." });

        if (payment.Status != LoanPaymentStatus.Scheduled)
            return BadRequest(new { message = "Only scheduled payments can be marked as completed." });

        var userId = GetCurrentUserId();
        payment.Status = LoanPaymentStatus.Completed;
        payment.CompletedAtUtc = DateTime.UtcNow;

        // Update loan outstanding principal
        if (payment.Loan is not null)
        {
            payment.Loan.OutstandingPrincipal -= payment.PrincipalAmount;

            if (payment.Loan.OutstandingPrincipal <= 0)
            {
                payment.Loan.Status = LoanStatus.FullyPaid;
                payment.Loan.FullyPaidAtUtc = DateTime.UtcNow;
            }

            _dbContext.CustomerLoans.Update(payment.Loan);
        }

        _dbContext.CustomerLoanPayments.Update(payment);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Accountant {UserId} marked payment {PaymentId} as completed", 
            userId, paymentId);

        return Ok(new
        {
            message = "Payment marked as completed.",
            paymentId = payment.Id,
            completedAt = payment.CompletedAtUtc
        });
    }

    /// <summary>
    /// [ACCOUNTANT] Mark a payment as overdue (for monitoring).
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpPost("payments/{paymentId:guid}/mark-overdue")]
    public async Task<IActionResult> MarkPaymentOverdue(Guid paymentId)
    {
        var payment = await _dbContext.CustomerLoanPayments
            .Include(x => x.Loan)
            .FirstOrDefaultAsync(x => x.Id == paymentId);

        if (payment is null)
            return NotFound(new { message = "Payment not found." });

        if (payment.Status != LoanPaymentStatus.Scheduled)
            return BadRequest(new { message = "Only scheduled payments can be marked as overdue." });

        payment.Status = LoanPaymentStatus.Overdue;

        // Update loan status if this is the first overdue
        if (payment.Loan is not null && payment.Loan.Status == LoanStatus.Active)
        {
            var hasOtherOverduePayments = await _dbContext.CustomerLoanPayments
                .AnyAsync(x => x.LoanId == payment.LoanId && 
                              x.Status == LoanPaymentStatus.Overdue && 
                              x.Id != paymentId);

            if (!hasOtherOverduePayments)
            {
                payment.Loan.Status = LoanStatus.Overdue;
                payment.Loan.OverdueSinceUtc = DateTime.UtcNow;
                _dbContext.CustomerLoans.Update(payment.Loan);
            }
        }

        _dbContext.CustomerLoanPayments.Update(payment);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Payment marked as overdue.",
            paymentId = payment.Id
        });
    }

    /// <summary>
    /// [ACCOUNTANT] Waive a payment (e.g., due to hardship or policy).
    /// </summary>
    [Authorize(Roles = "accountant")]
    [HttpPost("payments/{paymentId:guid}/waive")]
    public async Task<IActionResult> WaivePayment(
        Guid paymentId,
        [FromBody] WaivePaymentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.WaiverReason))
            return BadRequest(new { message = "Waiver reason is required." });

        var payment = await _dbContext.CustomerLoanPayments
            .Include(x => x.Loan)
            .FirstOrDefaultAsync(x => x.Id == paymentId);

        if (payment is null)
            return NotFound(new { message = "Payment not found." });

        if (payment.Status != LoanPaymentStatus.Scheduled && payment.Status != LoanPaymentStatus.Overdue)
            return BadRequest(new { message = "Can only waive scheduled or overdue payments." });

        var userId = GetCurrentUserId();
        payment.Status = LoanPaymentStatus.Waived;
        payment.CompletedAtUtc = DateTime.UtcNow;

        // Reduce loan outstanding principal
        if (payment.Loan is not null)
        {
            payment.Loan.OutstandingPrincipal -= payment.PrincipalAmount;

            if (payment.Loan.OutstandingPrincipal <= 0)
            {
                payment.Loan.Status = LoanStatus.FullyPaid;
                payment.Loan.FullyPaidAtUtc = DateTime.UtcNow;
            }
            else if (payment.Loan.Status == LoanStatus.Overdue)
            {
                // Check if still overdue
                var hasOtherOverduePayments = await _dbContext.CustomerLoanPayments
                    .AnyAsync(x => x.LoanId == payment.LoanId && 
                                  x.Status == LoanPaymentStatus.Overdue);

                if (!hasOtherOverduePayments)
                    payment.Loan.Status = LoanStatus.Active;
            }

            _dbContext.CustomerLoans.Update(payment.Loan);
        }

        _dbContext.CustomerLoanPayments.Update(payment);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Accountant {UserId} waived payment {PaymentId}. Reason: {Reason}",
            userId, paymentId, request.WaiverReason);

        return Ok(new
        {
            message = "Payment waived successfully.",
            paymentId = payment.Id,
            waiverReason = request.WaiverReason
        });
    }
}

public record RecordManualPaymentRequest(decimal Amount);
public record WaivePaymentRequest(string WaiverReason);
