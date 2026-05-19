using System.Data;
using System.Text.Json;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/webhooks/paymongo")]
[Route("api/v1/webhooks/paymongo")]
public class PayMongoWebhookController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly IPayMongoService _payMongoService;
    private readonly IAutoJournalService _autoJournalService;
    private readonly ILogger<PayMongoWebhookController> _logger;

    public PayMongoWebhookController(
        CMNetworkDbContext dbContext,
        IPayMongoService payMongoService,
        IAutoJournalService autoJournalService,
        ILogger<PayMongoWebhookController> logger)
    {
        _dbContext = dbContext;
        _payMongoService = payMongoService;
        _autoJournalService = autoJournalService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> HandleWebhook([FromHeader(Name = "Paymongo-Signature")] string? signatureHeader)
    {
        Request.EnableBuffering();
        string rawBody;
        using (var reader = new StreamReader(Request.Body, leaveOpen: true))
        {
            rawBody = await reader.ReadToEndAsync();
            Request.Body.Position = 0;
        }

        _logger.LogInformation("PayMongo webhook received. Signature header present: {HasSignature}", !string.IsNullOrWhiteSpace(signatureHeader));

        if (!string.IsNullOrWhiteSpace(signatureHeader) &&
            !_payMongoService.VerifyWebhookSignature(rawBody, signatureHeader))
        {
            _logger.LogWarning("PayMongo webhook signature validation failed. Rejecting webhook.");
            return Unauthorized(new { message = "Invalid webhook signature" });
        }

        using var document = JsonDocument.Parse(rawBody);
        var root = document.RootElement;

        if (!root.TryGetProperty("data", out var data) ||
            !data.TryGetProperty("attributes", out var attributes) ||
            !attributes.TryGetProperty("type", out var typeElement))
        {
            _logger.LogWarning("PayMongo webhook missing required fields. Ignoring payload.");
            return Ok(new { message = "Ignored payload." });
        }

        var eventType = typeElement.GetString() ?? string.Empty;
        _logger.LogInformation("PayMongo webhook event type: {EventType}", eventType);

        // PayMongo sends various event types for checkout completion:
        // - checkout_session.paid
        // - checkout_session.payment.paid
        // - Also handle hyphenated variants
        var isPaidEvent = string.Equals(eventType, "checkout_session.paid", StringComparison.OrdinalIgnoreCase)
            || string.Equals(eventType, "checkout_session.payment.paid", StringComparison.OrdinalIgnoreCase)
            || string.Equals(eventType, "payment_link.paid", StringComparison.OrdinalIgnoreCase);

        if (!isPaidEvent)
        {
            _logger.LogInformation("PayMongo webhook event ignored. Type: {EventType}", eventType);
            return Ok(new { message = "Event ignored.", eventType });
        }

        // Try to extract checkout session ID from various PayMongo response shapes
        string? checkoutSessionId = null;
        if (attributes.TryGetProperty("data", out var nestedData)
            && nestedData.ValueKind == JsonValueKind.Object
            && nestedData.TryGetProperty("id", out var nestedId))
        {
            checkoutSessionId = nestedId.GetString();
        }
        else if (attributes.TryGetProperty("id", out var directId))
        {
            checkoutSessionId = directId.GetString();
        }

        if (string.IsNullOrWhiteSpace(checkoutSessionId))
        {
            _logger.LogWarning("PayMongo webhook: no checkout session ID found in event payload. Data shape: {@Data}", attributes);
            return Ok(new { message = "No checkout session id found in event payload." });
        }

        _logger.LogInformation("PayMongo webhook processing checkout session: {SessionId}", checkoutSessionId);

        await CompletePaymentAsync(checkoutSessionId);
        await CompleteLoanInstallmentPaymentAsync(checkoutSessionId);

        return Ok(new { message = "Webhook processed." });
    }

    private async Task CompletePaymentAsync(string checkoutSessionId)
    {
        await using var tx = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var payment = await _dbContext.CustomerPayments
            .FromSqlInterpolated($"SELECT * FROM [CustomerPayments] WITH (UPDLOCK, ROWLOCK) WHERE [PayMongoCheckoutSessionId] = {checkoutSessionId}")
            .FirstOrDefaultAsync();

        if (payment is null)
        {
            _logger.LogWarning("Customer payment not found for checkout session {SessionId}", checkoutSessionId);
            await tx.CommitAsync();
            return;
        }

        if (payment.Status == CustomerPaymentStatus.Completed)
        {
            await tx.CommitAsync();
            return;
        }

        var invoiceIds = payment.InvoiceIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(value => Guid.TryParse(value, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        var invoices = await _dbContext.ARInvoices
            .Where(x => invoiceIds.Contains(x.Id) && !x.IsDeleted)
            .ToListAsync();

        foreach (var invoice in invoices)
        {
            if (invoice.Status is ARInvoiceStatus.Paid or ARInvoiceStatus.Void)
            {
                continue;
            }

            invoice.Status = ARInvoiceStatus.Paid;
        }

        payment.Status = CustomerPaymentStatus.Completed;
        payment.CompletedAt = DateTime.UtcNow;

        await _autoJournalService.PostCustomerCashReceiptAsync(
            payment.Amount,
            $"Customer payment via PayMongo for {invoices.Count} invoice(s)",
            payment.PayMongoCheckoutSessionId ?? payment.Id.ToString(),
            payment.CreatedByUserId);

        await _dbContext.SaveChangesAsync();
        await tx.CommitAsync();
    }

    private async Task CompleteLoanInstallmentPaymentAsync(string checkoutSessionId)
    {
        await using var tx = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var loanPayment = await _dbContext.CustomerLoanPayments
            .FromSqlInterpolated($"SELECT * FROM [CustomerLoanPayments] WITH (UPDLOCK, ROWLOCK) WHERE [PayMongoCheckoutSessionId] = {checkoutSessionId}")
            .FirstOrDefaultAsync();

        if (loanPayment is not null)
        {
            await _dbContext.Entry(loanPayment).Reference(x => x.Loan).LoadAsync();
        }

        if (loanPayment is null)
        {
            _logger.LogWarning("Loan installment payment not found for checkout session {SessionId}", checkoutSessionId);
            await tx.CommitAsync();
            return;
        }

        if (loanPayment.Status == LoanPaymentStatus.Completed)
        {
            _logger.LogInformation("Loan installment payment {PaymentId} already completed", loanPayment.Id);
            await tx.CommitAsync();
            return;
        }

        if (loanPayment.Status != LoanPaymentStatus.Scheduled)
        {
            _logger.LogWarning(
                "Loan installment payment {PaymentId} cannot be completed from status {Status}",
                loanPayment.Id, loanPayment.Status);
            await tx.CommitAsync();
            return;
        }

        if (loanPayment.Loan is null)
        {
            _logger.LogError("Loan for payment {PaymentId} not found", loanPayment.Id);
            await tx.CommitAsync();
            return;
        }

        // Mark payment as completed
        loanPayment.Status = LoanPaymentStatus.Completed;
        loanPayment.CompletedAtUtc = DateTime.UtcNow;
        loanPayment.PaymentMethod = "PayMongo";
        loanPayment.ExternalReference = loanPayment.PayMongoCheckoutSessionId ?? loanPayment.ExternalReference;
        loanPayment.UpdatedAtUtc = DateTime.UtcNow;

        // Update loan totals
        loanPayment.Loan.OutstandingPrincipal = Math.Max(0m, loanPayment.Loan.OutstandingPrincipal - loanPayment.PrincipalAmount);
        loanPayment.Loan.TotalInterestAccrued += loanPayment.InterestAmount;
        loanPayment.Loan.UpdatedAtUtc = DateTime.UtcNow;

        // Check if loan is now fully paid
        if (loanPayment.Loan.OutstandingPrincipal <= 0.01m)
        {
            loanPayment.Loan.Status = LoanStatus.FullyPaid;
            loanPayment.Loan.FullyPaidAtUtc = DateTime.UtcNow;
            _logger.LogInformation("Loan {LoanId} marked as FullyPaid", loanPayment.LoanId);
        }
        // Check if loan should transition from Overdue back to Active
        else if (loanPayment.Loan.Status == LoanStatus.Overdue)
        {
            var hasRemainingOverdue = await _dbContext.CustomerLoanPayments
                .AnyAsync(x => x.LoanId == loanPayment.LoanId && x.Status == LoanPaymentStatus.Overdue);

            if (!hasRemainingOverdue)
            {
                loanPayment.Loan.Status = LoanStatus.Active;
                loanPayment.Loan.OverdueSinceUtc = null;
                _logger.LogInformation("Loan {LoanId} transitioned from Overdue to Active", loanPayment.LoanId);
            }
        }

        // Post accounting journal entry
        await _autoJournalService.PostCustomerCashReceiptAsync(
            loanPayment.TotalAmount,
            $"Loan installment payment for loan {loanPayment.LoanId}",
            loanPayment.ExternalReference ?? loanPayment.Id.ToString(),
            "system");

        await _dbContext.SaveChangesAsync();
        await tx.CommitAsync();

        _logger.LogInformation(
            "Webhook: loan installment payment {PaymentId} completed via PayMongo session {SessionId}",
            loanPayment.Id, checkoutSessionId);
    }
}