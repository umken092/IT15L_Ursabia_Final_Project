using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Data;
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
    private readonly IPayMongoService _payMongoService;
    private readonly IAutoJournalService _autoJournalService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LoanPaymentController> _logger;

    public LoanPaymentController(
        CMNetworkDbContext dbContext,
        ICurrentCustomerService currentCustomerService,
        IPayMongoService payMongoService,
        IAutoJournalService autoJournalService,
        IConfiguration configuration,
        ILogger<LoanPaymentController> logger)
    {
        _dbContext = dbContext;
        _currentCustomerService = currentCustomerService;
        _payMongoService = payMongoService;
        _autoJournalService = autoJournalService;
        _configuration = configuration;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    private async Task<Customer?> GetCurrentCustomerAsync()
    {
        var userId = GetCurrentUserId();
        if (Guid.TryParse(userId, out var parsedUserId))
        {
            var linkedCustomerId = await _dbContext.Users
                .AsNoTracking()
                .Where(x => x.Id == parsedUserId)
                .Select(x => x.CustomerId)
                .FirstOrDefaultAsync();

            if (linkedCustomerId.HasValue)
            {
                var linkedCustomer = await _dbContext.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == linkedCustomerId.Value);

                if (linkedCustomer is not null)
                {
                    return linkedCustomer;
                }
            }
        }

        var customerId = _currentCustomerService.CustomerId;
        if (!customerId.HasValue)
            return null;

        return await _dbContext.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == customerId.Value);
    }

    private static bool IsPlaceholderRefId(string? refId)
        => string.Equals(refId?.Trim(), "{CHECKOUT_SESSION_ID}", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// [CUSTOMER] Diagnostic: returns customer + loan + recent payments state for debugging.
    /// </summary>
    [Authorize(Roles = "customer")]
    [HttpGet("diagnostic")]
    public async Task<IActionResult> Diagnostic([FromQuery] Guid? loanId, [FromQuery] Guid? paymentId)
    {
        var userId = GetCurrentUserId();
        var customer = await GetCurrentCustomerAsync();

        var customerLoanCount = 0;
        Guid[] customerLoanIds = Array.Empty<Guid>();
        if (customer is not null)
        {
            customerLoanIds = await _dbContext.CustomerLoans
                .AsNoTracking()
                .Where(x => x.CustomerId == customer.Id)
                .Select(x => x.Id)
                .ToArrayAsync();
            customerLoanCount = customerLoanIds.Length;
        }

        object? loanInfo = null;
        if (loanId.HasValue)
        {
            loanInfo = await _dbContext.CustomerLoans
                .AsNoTracking()
                .Where(x => x.Id == loanId.Value)
                .Select(x => new { x.Id, x.CustomerId, x.Status, PaymentCount = x.Payments.Count })
                .FirstOrDefaultAsync();
        }

        object? paymentInfo = null;
        if (paymentId.HasValue)
        {
            paymentInfo = await _dbContext.CustomerLoanPayments
                .AsNoTracking()
                .Where(x => x.Id == paymentId.Value)
                .Select(x => new { x.Id, x.LoanId, x.Status, x.PaymentMethod, x.PayMongoCheckoutSessionId, x.TotalAmount })
                .FirstOrDefaultAsync();
        }

        return Ok(new
        {
            userId,
            customerId = customer?.Id,
            customerEmail = customer?.Email,
            customerLoanCount,
            customerLoanIds,
            requestedLoanId = loanId,
            requestedPaymentId = paymentId,
            loanInfo,
            paymentInfo,
        });
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
                paymentMethod = x.PaymentMethod,
                externalReference = x.ExternalReference,
                payMongoCheckoutSessionId = x.PayMongoCheckoutSessionId
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
    /// [CUSTOMER] Create PayMongo hosted checkout intent for the next scheduled installment.
    /// </summary>
    [Authorize(Roles = "customer")]
    [HttpPost("loans/{loanId:guid}/installments/{paymentId:guid}/intent")]
    public async Task<IActionResult> CreateInstallmentPaymentIntent(
        Guid loanId,
        Guid paymentId,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return Unauthorized();

        var loan = await _dbContext.CustomerLoans
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == loanId && x.CustomerId == customer.Id);

        if (loan is null)
            return NotFound(new { message = "Loan not found." });

        if (loan.Status is not (LoanStatus.Active or LoanStatus.Overdue))
            return BadRequest(new { message = "This loan is not eligible for installment checkout." });

        var payment = loan.Payments.FirstOrDefault(x => x.Id == paymentId);
        if (payment is null)
            return NotFound(new { message = "Installment payment record not found." });

        if (payment.Status != LoanPaymentStatus.Scheduled)
            return BadRequest(new { message = "Only scheduled installments can be paid via checkout." });

        var nextScheduled = loan.Payments
            .Where(x => x.Status == LoanPaymentStatus.Scheduled)
            .OrderBy(x => x.DueAtUtc)
            .FirstOrDefault();

        if (nextScheduled is null)
            return BadRequest(new { message = "No scheduled installments are available." });

        if (nextScheduled.Id != paymentId)
            return BadRequest(new { message = "Please pay the next due installment first." });

        var appBaseUrl = _configuration["AppBaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
        var successUrl = $"{appBaseUrl}/module/loans/installment-result?loanId={loanId}&paymentId={paymentId}&outcome=success";
        var cancelUrl = $"{appBaseUrl}/module/loans/installment-result?loanId={loanId}&paymentId={paymentId}&outcome=cancel";

        _logger.LogInformation(
            "Building callback URLs for payment {PaymentId}: successUrl={SuccessUrl}, cancelUrl={CancelUrl}",
            paymentId, successUrl, cancelUrl);

        var description = $"CMNetwork loan installment due {payment.DueAtUtc:yyyy-MM-dd} ({loan.TermMonths} month loan)";
        var checkout = await _payMongoService.CreateCheckoutSessionAsync(payment.TotalAmount, description, successUrl, cancelUrl);

        _logger.LogInformation(
            "PayMongo session created: sessionId={CheckoutSessionId}, redirectUrl={RedirectUrl}, successUrl sent={SuccessUrl}",
            checkout.CheckoutSessionId, checkout.CheckoutUrl, successUrl);

        payment.PayMongoCheckoutSessionId = checkout.CheckoutSessionId;
        payment.PaymentMethod = "PayMongo";
        payment.UpdatedAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Customer {CustomerId} created installment checkout {CheckoutSessionId} for payment {PaymentId} on loan {LoanId} (IdempotencyKey={IdempotencyKey})",
            customer.Id, checkout.CheckoutSessionId, paymentId, loanId, idempotencyKey);

        return Ok(new
        {
            paymentId = payment.Id,
            checkoutSessionId = checkout.CheckoutSessionId,
            redirectUrl = checkout.CheckoutUrl,
            amount = payment.TotalAmount,
        });
    }

    /// <summary>
    /// [CUSTOMER] Confirm hosted installment checkout callback and apply payment if paid.
    /// Accepts both POST (canonical) and GET (browser/back-button safe) verbs.
    /// </summary>
    [Authorize(Roles = "customer")]
    [HttpPost("installments/confirm")]
    [HttpGet("installments/confirm")]
    public async Task<IActionResult> ConfirmInstallmentPayment([FromQuery] string? refId, [FromQuery] Guid? loanId, [FromQuery] Guid? paymentId)
    {
        try
        {
            return await ConfirmInstallmentPaymentCoreAsync(refId, loanId, paymentId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "ConfirmInstallmentPayment failed unexpectedly for refId={RefId}, loanId={LoanId}, paymentId={PaymentId}",
                refId ?? "null", loanId?.ToString() ?? "null", paymentId?.ToString() ?? "null");
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = "Failed to confirm installment payment.",
                error = ex.Message,
                errorType = ex.GetType().Name,
            });
        }
    }

    private async Task<IActionResult> ConfirmInstallmentPaymentCoreAsync(string? refId, Guid? loanId, Guid? paymentId)
    {
        _logger.LogInformation(
            "ConfirmInstallmentPayment called with refId={RefId}, loanId={LoanId}, paymentId={PaymentId}",
            refId ?? "null", loanId?.ToString() ?? "null", paymentId?.ToString() ?? "null");

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return Unauthorized();

        _logger.LogInformation(
            "ConfirmInstallmentPayment: found customer {CustomerId} for request loanId={LoanId}, paymentId={PaymentId}",
            customer.Id, loanId, paymentId);

        var normalizedRefId = string.IsNullOrWhiteSpace(refId) ? null : refId.Trim();
        var useFallbackLookup = string.IsNullOrWhiteSpace(normalizedRefId) || IsPlaceholderRefId(normalizedRefId);

        _logger.LogInformation(
            "Using fallback lookup: {UseFallbackLookup}, normalizedRefId={NormalizedRefId}",
            useFallbackLookup, normalizedRefId ?? "null");

        CustomerLoanPayment? payment;
        if (useFallbackLookup)
        {
            if (!loanId.HasValue || !paymentId.HasValue)
            {
                _logger.LogWarning(
                    "Fallback lookup requested but missing parameters: loanId={HasLoanId}, paymentId={HasPaymentId}",
                    loanId.HasValue, paymentId.HasValue);
                return BadRequest(new { message = "Missing checkout session reference." });
            }

            // Use the same pattern as GetPaymentSchedule: load the loan owned by the customer, then find the payment.
            var loan = await _dbContext.CustomerLoans
                .Include(x => x.Payments)
                .FirstOrDefaultAsync(x => x.Id == loanId.Value && x.CustomerId == customer.Id);

            if (loan is null)
            {
                _logger.LogWarning(
                    "Loan {LoanId} not found for customer {CustomerId} during confirm",
                    loanId.Value, customer.Id);
                return NotFound(new { message = "Loan not found for the current customer." });
            }

            payment = loan.Payments.FirstOrDefault(x => x.Id == paymentId.Value);

            if (payment is null)
            {
                _logger.LogWarning(
                    "Payment {PaymentId} not found within loan {LoanId} (loan has {Count} payments)",
                    paymentId.Value, loanId.Value, loan.Payments.Count);
                return NotFound(new { message = "Installment payment record not found within the specified loan." });
            }

            payment.Loan = loan;
            normalizedRefId = payment.PayMongoCheckoutSessionId;
        }
        else
        {
            payment = await _dbContext.CustomerLoanPayments
                .Include(x => x.Loan)
                .FirstOrDefaultAsync(x => x.PayMongoCheckoutSessionId == normalizedRefId && x.Loan != null && x.Loan.CustomerId == customer.Id);
        }

        if (payment is null)
            return NotFound(new { message = "Installment payment record not found." });

        if (string.IsNullOrWhiteSpace(normalizedRefId))
            return BadRequest(new { message = "Checkout session reference is not available yet for this installment." });

        if (payment.Status == LoanPaymentStatus.Completed)
        {
            return Ok(new
            {
                message = "Installment payment already completed.",
                paymentId = payment.Id,
                status = payment.Status.ToString(),
                providerStatus = "paid",
                completed = true,
                completedAt = payment.CompletedAtUtc,
                referenceNo = payment.ExternalReference ?? payment.PayMongoCheckoutSessionId,
                amount = payment.TotalAmount,
                loanId = payment.LoanId,
                paymentMethod = payment.PaymentMethod,
            });
        }

        var providerStatus = await _payMongoService.GetCheckoutSessionStatusAsync(normalizedRefId);
        if (!string.Equals(providerStatus, "paid", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(new
            {
                message = $"Installment payment is not completed yet (status: {providerStatus}).",
                paymentId = payment.Id,
                status = payment.Status.ToString(),
                providerStatus,
                completed = false,
                completedAt = payment.CompletedAtUtc,
                referenceNo = payment.ExternalReference ?? payment.PayMongoCheckoutSessionId,
                amount = payment.TotalAmount,
                loanId = payment.LoanId,
                paymentMethod = payment.PaymentMethod,
            });
        }

        await ApplyCompletedInstallmentPaymentAsync(payment.Id);

        var latest = await _dbContext.CustomerLoanPayments
            .AsNoTracking()
            .Where(x => x.Id == payment.Id)
            .Select(x => new
            {
                x.Id,
                status = x.Status.ToString(),
                x.CompletedAtUtc,
                x.ExternalReference,
                x.PayMongoCheckoutSessionId,
                x.TotalAmount,
                x.LoanId,
                x.PaymentMethod,
            })
            .FirstAsync();

        return Ok(new
        {
            message = "Installment payment confirmed and applied.",
            paymentId = latest.Id,
            status = latest.status,
            providerStatus,
            completed = string.Equals(latest.status, LoanPaymentStatus.Completed.ToString(), StringComparison.OrdinalIgnoreCase),
            completedAt = latest.CompletedAtUtc,
            referenceNo = latest.ExternalReference ?? latest.PayMongoCheckoutSessionId,
            amount = latest.TotalAmount,
            loanId = latest.LoanId,
            paymentMethod = latest.PaymentMethod,
        });
    }

    /// <summary>
    /// [CUSTOMER] Check local installment payment state for callback polling.
    /// </summary>
    [Authorize(Roles = "customer")]
    [HttpGet("installments/status")]
    public async Task<IActionResult> GetInstallmentPaymentStatus([FromQuery] string? refId, [FromQuery] Guid? loanId, [FromQuery] Guid? paymentId)
    {
        _logger.LogInformation(
            "GetInstallmentPaymentStatus called with refId={RefId}, loanId={LoanId}, paymentId={PaymentId}",
            refId ?? "null", loanId?.ToString() ?? "null", paymentId?.ToString() ?? "null");

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
            return Unauthorized();

        var normalizedRefId = string.IsNullOrWhiteSpace(refId) ? null : refId.Trim();
        var useFallbackLookup = string.IsNullOrWhiteSpace(normalizedRefId) || IsPlaceholderRefId(normalizedRefId);

        _logger.LogInformation(
            "Using fallback lookup: {UseFallbackLookup}, normalizedRefId={NormalizedRefId}",
            useFallbackLookup, normalizedRefId ?? "null");

        CustomerLoanPayment? payment;
        if (useFallbackLookup)
        {
            if (!loanId.HasValue || !paymentId.HasValue)
            {
                _logger.LogWarning(
                    "Fallback lookup requested but missing parameters: loanId={HasLoanId}, paymentId={HasPaymentId}",
                    loanId.HasValue, paymentId.HasValue);
                return BadRequest(new { message = "Missing checkout session reference." });
            }

            // Use the same pattern as GetPaymentSchedule
            var loan = await _dbContext.CustomerLoans
                .AsNoTracking()
                .Include(x => x.Payments)
                .FirstOrDefaultAsync(x => x.Id == loanId.Value && x.CustomerId == customer.Id);

            if (loan is null)
            {
                _logger.LogWarning(
                    "Loan {LoanId} not found for customer {CustomerId} during status check",
                    loanId.Value, customer.Id);
                return NotFound(new { message = "Loan not found for the current customer." });
            }

            payment = loan.Payments.FirstOrDefault(x => x.Id == paymentId.Value);
        }
        else
        {
            payment = await _dbContext.CustomerLoanPayments
                .AsNoTracking()
                .Include(x => x.Loan)
                .Where(x => x.PayMongoCheckoutSessionId == normalizedRefId)
                .Where(x => x.Loan!.CustomerId == customer.Id)
                .FirstOrDefaultAsync();
        }

        if (payment is null)
            return NotFound(new { message = "Installment payment record not found." });

        return Ok(new
        {
            paymentId = payment.Id,
            status = payment.Status.ToString(),
            isTerminal = payment.Status is LoanPaymentStatus.Completed or LoanPaymentStatus.Waived,
            completedAt = payment.CompletedAtUtc,
            amount = payment.TotalAmount,
            referenceNo = payment.ExternalReference ?? payment.PayMongoCheckoutSessionId,
            loanId = payment.LoanId,
            paymentMethod = payment.PaymentMethod,
        });
    }

    private async Task ApplyCompletedInstallmentPaymentAsync(Guid paymentId)
    {
        await using var tx = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var payment = await _dbContext.CustomerLoanPayments
            .Include(x => x.Loan)
            .FirstOrDefaultAsync(x => x.Id == paymentId);

        if (payment is null || payment.Status == LoanPaymentStatus.Completed)
        {
            await tx.CommitAsync();
            return;
        }

        if (payment.Status != LoanPaymentStatus.Scheduled)
        {
            await tx.CommitAsync();
            return;
        }

        if (payment.Loan is null)
        {
            await tx.CommitAsync();
            return;
        }

        payment.Status = LoanPaymentStatus.Completed;
        payment.CompletedAtUtc = DateTime.UtcNow;
        payment.PaymentMethod = "PayMongo";
        payment.ExternalReference = payment.PayMongoCheckoutSessionId ?? payment.ExternalReference;
        payment.UpdatedAtUtc = DateTime.UtcNow;

        payment.Loan.OutstandingPrincipal = Math.Max(0m, payment.Loan.OutstandingPrincipal - payment.PrincipalAmount);
        payment.Loan.TotalInterestAccrued += payment.InterestAmount;
        payment.Loan.UpdatedAtUtc = DateTime.UtcNow;

        if (payment.Loan.OutstandingPrincipal <= 0.01m)
        {
            payment.Loan.Status = LoanStatus.FullyPaid;
            payment.Loan.FullyPaidAtUtc = DateTime.UtcNow;
        }
        else if (payment.Loan.Status == LoanStatus.Overdue)
        {
            var hasRemainingOverdue = await _dbContext.CustomerLoanPayments
                .AnyAsync(x => x.LoanId == payment.LoanId && x.Status == LoanPaymentStatus.Overdue);

            if (!hasRemainingOverdue)
            {
                payment.Loan.Status = LoanStatus.Active;
                payment.Loan.OverdueSinceUtc = null;
            }
        }

        await _autoJournalService.PostCustomerCashReceiptAsync(
            payment.TotalAmount,
            $"Loan installment payment for loan {payment.LoanId}",
            payment.ExternalReference ?? payment.Id.ToString(),
            GetCurrentUserId() ?? "system");

        await _dbContext.SaveChangesAsync();
        await tx.CommitAsync();
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
