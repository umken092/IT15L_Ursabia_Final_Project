using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace CMNetwork.Controllers;

[ApiController]
[Authorize(Roles = "accountant,cfo,super-admin,auditor")]
[Route("api/payments/reconciliation")]
[Route("api/v1/payments/reconciliation")]
public class PaymentsReconciliationController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly IPayMongoService _payMongoService;
    private readonly IAutoJournalService _autoJournalService;

    public PaymentsReconciliationController(
        CMNetworkDbContext dbContext,
        IPayMongoService payMongoService,
        IAutoJournalService autoJournalService)
    {
        _dbContext = dbContext;
        _payMongoService = payMongoService;
        _autoJournalService = autoJournalService;
    }

    [HttpGet]
    public async Task<IActionResult> GetQueue(
        [FromQuery] string? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _dbContext.CustomerPayments
            .AsNoTracking()
            .Include(x => x.Customer)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CustomerPaymentStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(x => x.Status == parsedStatus);
        }

        if (from.HasValue)
        {
            query = query.Where(x => x.CreatedAt >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(x => x.CreatedAt <= to.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                (x.PayMongoCheckoutSessionId != null && x.PayMongoCheckoutSessionId.Contains(term)) ||
                x.Id.ToString().Contains(term) ||
                x.Customer.Name.Contains(term) ||
                (x.Customer.CustomerCode != null && x.Customer.CustomerCode.Contains(term)));
        }

        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Amount,
                x.Status,
                x.PayMongoCheckoutSessionId,
                x.InvoiceIds,
                x.CreatedAt,
                x.CompletedAt,
                x.CreatedByUserId,
                CustomerId = x.CustomerId,
                CustomerName = x.Customer.Name,
                CustomerCode = x.Customer.CustomerCode,
            })
            .ToListAsync();

        var items = rows.Select(x => new
        {
            paymentId = x.Id,
            amount = x.Amount,
            status = x.Status.ToString(),
            checkoutSessionId = x.PayMongoCheckoutSessionId,
            invoiceCount = x.InvoiceIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Length,
            createdAt = x.CreatedAt,
            completedAt = x.CompletedAt,
            source = x.CompletedAt.HasValue ? "redirectconfirm-or-webhook" : "awaiting",
            createdBy = x.CreatedByUserId,
            customer = new
            {
                id = x.CustomerId,
                code = x.CustomerCode,
                name = x.CustomerName,
            },
        });

        return Ok(new
        {
            page,
            pageSize,
            total,
            items,
        });
    }

    [HttpGet("{paymentId:guid}/details")]
    public async Task<IActionResult> GetDetails(Guid paymentId)
    {
        var payment = await _dbContext.CustomerPayments
            .AsNoTracking()
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == paymentId);

        if (payment is null)
        {
            return NotFound(new { message = "Payment not found." });
        }

        var invoiceIds = payment.InvoiceIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(value => Guid.TryParse(value, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        var invoices = await _dbContext.ARInvoices
            .AsNoTracking()
            .Where(x => invoiceIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.TotalAmount,
                status = x.Status.ToString(),
                x.InvoiceDate,
                x.DueDate,
            })
            .ToListAsync();

        var journalEntries = await _dbContext.JournalEntries
            .AsNoTracking()
            .Where(x => x.ReferenceNo == (payment.PayMongoCheckoutSessionId ?? payment.Id.ToString()))
            .Select(x => new
            {
                x.Id,
                x.EntryNumber,
                x.EntryDate,
                x.Description,
                totalDebit = x.Lines.Sum(line => line.Debit),
                totalCredit = x.Lines.Sum(line => line.Credit),
                status = x.Status.ToString(),
                x.PostedUtc,
            })
            .ToListAsync();

        return Ok(new
        {
            payment = new
            {
                payment.Id,
                payment.Amount,
                status = payment.Status.ToString(),
                payment.PayMongoCheckoutSessionId,
                payment.CreatedAt,
                payment.CompletedAt,
                payment.CreatedByUserId,
            },
            customer = new
            {
                payment.CustomerId,
                payment.Customer.CustomerCode,
                payment.Customer.Name,
            },
            invoices,
            journalEntries,
        });
    }

    [HttpPost("{paymentId:guid}/retry-confirm")]
    public async Task<IActionResult> RetryConfirm(Guid paymentId)
    {
        var payment = await _dbContext.CustomerPayments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == paymentId);

        if (payment is null)
        {
            return NotFound(new { message = "Payment not found." });
        }

        if (payment.Status == CustomerPaymentStatus.Completed)
        {
            return Ok(new
            {
                message = "Payment already completed.",
                paymentId = payment.Id,
                status = payment.Status.ToString(),
                completed = true,
                completedAt = payment.CompletedAt,
            });
        }

        if (string.IsNullOrWhiteSpace(payment.PayMongoCheckoutSessionId))
        {
            return BadRequest(new { message = "Payment has no checkout session id." });
        }

        var providerStatus = await _payMongoService.GetCheckoutSessionStatusAsync(payment.PayMongoCheckoutSessionId);
        if (!string.Equals(providerStatus, "paid", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(new
            {
                message = $"Payment is not completed yet (status: {providerStatus}).",
                paymentId = payment.Id,
                status = payment.Status.ToString(),
                providerStatus,
                completed = false,
            });
        }

        await ApplyCompletedPaymentAsync(payment.Id);

        var latest = await _dbContext.CustomerPayments
            .AsNoTracking()
            .Where(x => x.Id == payment.Id)
            .Select(x => new { x.Id, x.Status, x.CompletedAt })
            .FirstAsync();

        return Ok(new
        {
            message = "Payment confirmed and applied.",
            paymentId = latest.Id,
            status = latest.Status.ToString(),
            providerStatus,
            completed = latest.Status == CustomerPaymentStatus.Completed,
            completedAt = latest.CompletedAt,
        });
    }

    private async Task ApplyCompletedPaymentAsync(Guid paymentId)
    {
        await using var tx = await _dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var payment = await _dbContext.CustomerPayments
            .FromSqlInterpolated($"SELECT * FROM [CustomerPayments] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {paymentId}")
            .FirstOrDefaultAsync();

        if (payment is null || payment.Status == CustomerPaymentStatus.Completed)
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
}
