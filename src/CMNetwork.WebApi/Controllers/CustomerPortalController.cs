using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Security.Claims;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/customer")]
[Route("api/v1/customer")]
[Authorize(Roles = "customer")]
public class CustomerPortalController : ControllerBase
{
    private const string MissingCustomerMessage = "No customer record is linked to this account.";
    private const string IsoDateFormat = "yyyy-MM-dd";

    private readonly CMNetworkDbContext _dbContext;
    private readonly ICurrentCustomerService _currentCustomer;
    private readonly ICurrentUserService _currentUser;
    private readonly IPayMongoService _payMongoService;
    private readonly IAutoJournalService _autoJournalService;
    private readonly IConfiguration _configuration;

    public CustomerPortalController(
        CMNetworkDbContext dbContext,
        ICurrentCustomerService currentCustomer,
        ICurrentUserService currentUser,
        IPayMongoService payMongoService,
        IAutoJournalService autoJournalService,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _currentCustomer = currentCustomer;
        _currentUser = currentUser;
        _payMongoService = payMongoService;
        _autoJournalService = autoJournalService;
        _configuration = configuration;
    }

    private async Task<Customer?> GetCurrentCustomerAsync()
    {
        if (_currentCustomer.CustomerId.HasValue)
        {
            return await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == _currentCustomer.CustomerId.Value);
        }

        // Compatibility fallback for old tokens without customerId claim.
        var email = User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue("email")
                    ?? User.Identity?.Name;

        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        return await _dbContext.Customers
            .FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == email.ToLower());
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .ToListAsync();

        var outstandingBalance = invoices
            .Where(inv => inv.Status is not ARInvoiceStatus.Paid and not ARInvoiceStatus.Void)
            .Sum(inv => inv.TotalAmount);

        var overdueAmount = invoices
            .Where(inv => inv.Status is not ARInvoiceStatus.Paid and not ARInvoiceStatus.Void && inv.DueDate < DateTime.UtcNow)
            .Sum(inv => inv.TotalAmount);

        var lastPaymentDate = await _dbContext.CustomerPayments
            .Where(x => x.CustomerId == customer.Id && x.Status == CustomerPaymentStatus.Completed)
            .OrderByDescending(x => x.CompletedAt)
            .Select(x => x.CompletedAt)
            .FirstOrDefaultAsync();

        return Ok(new
        {
            customerName = customer.Name,
            customerCode = customer.CustomerCode,
            outstandingBalance,
            overdueAmount,
            lastPaymentDate,
            invoiceCount = invoices.Count,
            recentInvoices = invoices.Take(5).Select(inv => new
            {
                inv.Id,
                inv.InvoiceNumber,
                inv.InvoiceDate,
                inv.DueDate,
                inv.TotalAmount,
                status = inv.Status.ToString(),
            })
        });
    }

    /// <summary>Returns all AR invoices for the authenticated customer.</summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> GetMyInvoices()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .Select(inv => new
            {
                inv.Id,
                inv.InvoiceNumber,
                InvoiceDate = inv.InvoiceDate.ToString(IsoDateFormat),
                DueDate = inv.DueDate.ToString(IsoDateFormat),
                inv.TotalAmount,
                Status = inv.Status.ToString(),
            })
            .ToListAsync();

        return Ok(new
        {
            customerName = customer.Name,
            customerCode = customer.CustomerCode,
            invoices,
        });
    }

    [HttpGet("invoices/{id:guid}")]
    public async Task<IActionResult> GetMyInvoice(Guid id)
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoice = await _dbContext.ARInvoices
            .Include(x => x.Lines)
            .ThenInclude(x => x.Account)
            .FirstOrDefaultAsync(inv => inv.Id == id && inv.CustomerId == customer.Id && !inv.IsDeleted);

        if (invoice is null)
        {
            return NotFound(new { message = "Invoice not found." });
        }

        return Ok(new
        {
            invoice.Id,
            invoice.InvoiceNumber,
            InvoiceDate = invoice.InvoiceDate.ToString(IsoDateFormat),
            DueDate = invoice.DueDate.ToString(IsoDateFormat),
            invoice.TotalAmount,
            Status = invoice.Status.ToString(),
            Lines = invoice.Lines.Select(line => new
            {
                line.Id,
                line.Description,
                line.Quantity,
                line.UnitPrice,
                line.Amount,
                line.TaxAmount,
                AccountCode = line.Account.AccountCode,
                AccountName = line.Account.Name,
            })
        });
    }

    [HttpGet("payments")]
    public async Task<IActionResult> GetMyPayments()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var payments = await _dbContext.CustomerPayments
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.Amount,
                Status = x.Status.ToString(),
                x.PayMongoCheckoutSessionId,
                x.CreatedAt,
                x.CompletedAt,
                x.InvoiceIds,
            })
            .ToListAsync();

        return Ok(payments);
    }

    [HttpPost("payments/intent")]
    public async Task<IActionResult> CreatePaymentIntent(
        [FromBody] CreatePaymentIntentRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        if (request.InvoiceIds.Count == 0)
        {
            return BadRequest(new { message = "At least one invoice must be selected." });
        }

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => request.InvoiceIds.Contains(inv.Id)
                          && inv.CustomerId == customer.Id
                          && !inv.IsDeleted
                          && inv.Status != ARInvoiceStatus.Paid
                          && inv.Status != ARInvoiceStatus.Void)
            .ToListAsync();

        if (invoices.Count == 0)
        {
            return BadRequest(new { message = "No valid unpaid invoices found for this customer." });
        }

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existing = await _dbContext.CustomerPayments
                .Where(x => x.CustomerId == customer.Id && x.IdempotencyKey == idempotencyKey)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            if (existing is not null)
            {
                return Ok(new
                {
                    paymentId = existing.Id,
                    checkoutSessionId = existing.PayMongoCheckoutSessionId,
                    redirectUrl = existing.CheckoutUrl,
                    amount = existing.Amount,
                    reused = true,
                });
            }
        }

        var total = request.Amount > 0 ? request.Amount : invoices.Sum(x => x.TotalAmount);
        var description = $"CMNetwork payment for {invoices.Count} invoice(s): {string.Join(", ", invoices.Select(x => x.InvoiceNumber))}";
        var appBaseUrl = _configuration["AppBaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
        var successUrl = $"{appBaseUrl}/module/customer-portal?payment=success&refId={{CHECKOUT_SESSION_ID}}";
        var cancelUrl = $"{appBaseUrl}/module/customer-portal?payment=cancel";

        var checkout = await _payMongoService.CreateCheckoutSessionAsync(total, description, successUrl, cancelUrl);

        var payment = new CustomerPayment
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            Amount = total,
            Status = CustomerPaymentStatus.AwaitingPayment,
            PayMongoCheckoutSessionId = checkout.CheckoutSessionId,
            IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey,
            CheckoutUrl = checkout.CheckoutUrl,
            InvoiceIds = string.Join(',', invoices.Select(x => x.Id)),
            CreatedByUserId = _currentUser.UserId ?? "system",
            CreatedAt = DateTime.UtcNow,
        };

        _dbContext.CustomerPayments.Add(payment);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            paymentId = payment.Id,
            checkoutSessionId = checkout.CheckoutSessionId,
            redirectUrl = checkout.CheckoutUrl,
            amount = total,
        });
    }

    [HttpPost("payments/confirm")]
    public async Task<IActionResult> ConfirmPayment([FromQuery] string refId)
    {
        if (string.IsNullOrWhiteSpace(refId))
        {
            return BadRequest(new { message = "Missing checkout session reference." });
        }

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var payment = await _dbContext.CustomerPayments
            .FirstOrDefaultAsync(x => x.PayMongoCheckoutSessionId == refId && x.CustomerId == customer.Id);

        if (payment is null)
        {
            return NotFound(new { message = "Payment record not found." });
        }

        if (payment.Status == CustomerPaymentStatus.Completed)
        {
            return Ok(new { message = "Payment already completed.", paymentId = payment.Id });
        }

        var status = await _payMongoService.GetCheckoutSessionStatusAsync(refId);
        if (!string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"Payment is not completed yet (status: {status})." });
        }

        await ApplyCompletedPaymentAsync(payment);

        return Ok(new { message = "Payment confirmed and applied.", paymentId = payment.Id });
    }

    private async Task ApplyCompletedPaymentAsync(CustomerPayment payment)
    {
        if (payment.Status == CustomerPaymentStatus.Completed)
        {
            return;
        }

        await using var tx = await _dbContext.Database.BeginTransactionAsync();

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

    /// <summary>Returns a PDF account statement for the authenticated customer.</summary>
    [HttpGet("statement")]
    public async Task<IActionResult> GetStatement()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .ToListAsync();

        var pdf = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("CMNetwork ERP").Bold().FontSize(18);
                    col.Item().Text("Account Statement").FontSize(13).FontColor(Colors.Grey.Darken2);
                    col.Item().PaddingTop(6).Text($"Customer: {customer.Name} ({customer.CustomerCode})");
                    col.Item().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC");
                });

                page.Content().PaddingTop(16).Table(table =>
                {
                    table.ColumnsDefinition(cols =>
                    {
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                    });

                    // Header row
                    static IContainer CellStyle(IContainer c) =>
                        c.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).PaddingVertical(4).PaddingHorizontal(4);

                    table.Header(header =>
                    {
                        header.Cell().Element(CellStyle).Text("Invoice #").Bold();
                        header.Cell().Element(CellStyle).Text("Date").Bold();
                        header.Cell().Element(CellStyle).Text("Due Date").Bold();
                        header.Cell().Element(CellStyle).AlignRight().Text("Amount").Bold();
                        header.Cell().Element(CellStyle).AlignCenter().Text("Status").Bold();
                    });

                    foreach (var inv in invoices)
                    {
                        table.Cell().Element(CellStyle).Text(inv.InvoiceNumber);
                        table.Cell().Element(CellStyle).Text(inv.InvoiceDate.ToString(IsoDateFormat));
                        table.Cell().Element(CellStyle).Text(inv.DueDate.ToString(IsoDateFormat));
                        table.Cell().Element(CellStyle).AlignRight().Text($"₱{inv.TotalAmount:N2}");
                        table.Cell().Element(CellStyle).AlignCenter().Text(inv.Status.ToString());
                    }
                });

                var totalOutstanding = invoices
                    .Where(i => i.Status != ARInvoiceStatus.Paid && i.Status != ARInvoiceStatus.Void)
                    .Sum(i => i.TotalAmount);

                page.Content().PaddingTop(4).AlignRight()
                    .Text($"Outstanding Balance: ₱{totalOutstanding:N2}")
                    .Bold().FontSize(11);

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();

        return File(pdf, "application/pdf",
            $"statement-{customer.CustomerCode}-{DateTime.UtcNow:yyyyMMdd}.pdf");
    }
}

public sealed class CreatePaymentIntentRequest
{
    public List<Guid> InvoiceIds { get; set; } = [];
    public decimal Amount { get; set; }
}
