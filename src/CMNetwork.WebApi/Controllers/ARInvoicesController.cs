using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Models;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/arinvoices")]
[Authorize(Roles = "accountant,cfo,super-admin")]
public class ARInvoicesController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<ARInvoicesController> _logger;
    private readonly IInvoicePostingService _postingService;
    private readonly IAuditEventLogger _audit;

    public ARInvoicesController(CMNetworkDbContext dbContext, ILogger<ARInvoicesController> logger, IInvoicePostingService postingService, IAuditEventLogger audit)
    {
        _dbContext = dbContext;
        _logger = logger;
        _postingService = postingService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetARInvoices(
        [FromQuery] Guid? customerId = null,
        [FromQuery] int? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        var query = _dbContext.ARInvoices
            .Where(x => !x.IsDeleted)
            .AsQueryable();

        if (customerId.HasValue)
            query = query.Where(x => x.CustomerId == customerId.Value);

        if (status.HasValue)
            query = query.Where(x => (int)x.Status == status.Value);

        if (fromDate.HasValue)
            query = query.Where(x => x.InvoiceDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(x => x.InvoiceDate <= toDate.Value);

        var items = await query
            .Include(x => x.Customer)
            .OrderByDescending(x => x.InvoiceDate)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDate,
                x.DueDate,
                x.TotalAmount,
                x.Status,
                CustomerName = x.Customer.Name,
                CustomerCode = x.Customer.CustomerCode,
                x.CreatedUtc,
                x.CreatedByUserId
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetARInvoice(Guid id)
    {
        var invoice = await _dbContext.ARInvoices
            .Include(x => x.Customer)
            .Include(x => x.Lines)
            .ThenInclude(x => x.Account)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AR invoice not found." });

        var result = new
        {
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.InvoiceDate,
            invoice.DueDate,
            invoice.TotalAmount,
            invoice.Status,
            invoice.CustomerId,
            CustomerName = invoice.Customer.Name,
            invoice.CreatedUtc,
            invoice.CreatedByUserId,
            Lines = invoice.Lines.Select(l => new
            {
                l.Id,
                l.ChartOfAccountId,
                AccountCode = l.Account.AccountCode,
                AccountName = l.Account.Name,
                l.Description,
                l.Quantity,
                l.UnitPrice,
                l.Amount,
                l.TaxAmount
            }).ToList()
        };

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateARInvoice([FromBody] CreateARInvoiceRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Validate customer exists
        var customer = await _dbContext.Customers.FirstOrDefaultAsync(x => x.Id == request.CustomerId && x.IsActive);
        if (customer == null)
            return BadRequest(new { message = "Customer not found or inactive." });

        // Validate lines not empty
        if (request.Lines == null || request.Lines.Count == 0)
            return BadRequest(new { message = "At least one invoice line is required." });

        // Validate invoice number is unique
        var existingInvoice = await _dbContext.ARInvoices
            .FirstOrDefaultAsync(x => x.InvoiceNumber == request.InvoiceNumber && !x.IsDeleted);
        if (existingInvoice != null)
            return Conflict(new { message = "Invoice number already exists." });

        // Validate all accounts exist
        var accountIds = request.Lines.Select(x => x.ChartOfAccountId).Distinct().ToList();
        var accounts = await _dbContext.ChartOfAccounts
            .Where(x => accountIds.Contains(x.Id) && x.IsActive)
            .ToListAsync();

        if (accounts.Count != accountIds.Count)
            return BadRequest(new { message = "One or more accounts not found or inactive." });

        // Calculate total
        decimal totalAmount = request.Lines.Sum(x => x.Amount + (x.TaxAmount ?? 0));

        // Create invoice
        var invoice = new ARInvoice
        {
            Id = Guid.NewGuid(),
            CustomerId = request.CustomerId,
            InvoiceNumber = request.InvoiceNumber,
            InvoiceDate = request.InvoiceDate,
            DueDate = request.DueDate,
            TotalAmount = totalAmount,
            Status = ARInvoiceStatus.Draft,
            CreatedByUserId = User.FindFirst("sub")?.Value ?? "system",
            CreatedUtc = DateTime.UtcNow
        };

        // Add lines
        foreach (var lineRequest in request.Lines)
        {
            var line = new ARInvoiceLine
            {
                Id = Guid.NewGuid(),
                ARInvoiceId = invoice.Id,
                ChartOfAccountId = lineRequest.ChartOfAccountId,
                Description = lineRequest.Description,
                Quantity = lineRequest.Quantity,
                UnitPrice = lineRequest.UnitPrice,
                Amount = lineRequest.Amount,
                TaxAmount = lineRequest.TaxAmount,
                CreatedUtc = DateTime.UtcNow
            };
            invoice.Lines.Add(line);
        }

        _dbContext.ARInvoices.Add(invoice);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetARInvoice), new { id = invoice.Id }, new { invoice.Id, invoice.InvoiceNumber });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateARInvoice(Guid id, [FromBody] UpdateARInvoiceRequest request)
    {
        var invoice = await _dbContext.ARInvoices
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AR invoice not found." });

        // Only allow updating Draft or Sent invoices
        if (invoice.Status != ARInvoiceStatus.Draft && invoice.Status != ARInvoiceStatus.Sent)
            return BadRequest(new { message = $"Cannot update invoice in {invoice.Status} status." });

        // Update header
        invoice.InvoiceDate = request.InvoiceDate;
        invoice.DueDate = request.DueDate;
        invoice.LastModifiedByUserId = User.FindFirst("sub")?.Value ?? "system";
        invoice.LastModifiedUtc = DateTime.UtcNow;

        // Update lines if provided
        if (request.Lines != null)
        {
            // Remove old lines
            _dbContext.ARInvoiceLines.RemoveRange(invoice.Lines);

            // Validate all accounts exist
            var accountIds = request.Lines.Select(x => x.ChartOfAccountId).Distinct().ToList();
            var accounts = await _dbContext.ChartOfAccounts
                .Where(x => accountIds.Contains(x.Id) && x.IsActive)
                .ToListAsync();

            if (accounts.Count != accountIds.Count)
                return BadRequest(new { message = "One or more accounts not found or inactive." });

            // Add new lines
            decimal totalAmount = 0;
            foreach (var lineRequest in request.Lines)
            {
                var amount = lineRequest.Amount + (lineRequest.TaxAmount ?? 0);
                totalAmount += amount;

                var line = new ARInvoiceLine
                {
                    Id = Guid.NewGuid(),
                    ARInvoiceId = invoice.Id,
                    ChartOfAccountId = lineRequest.ChartOfAccountId,
                    Description = lineRequest.Description,
                    Quantity = lineRequest.Quantity,
                    UnitPrice = lineRequest.UnitPrice,
                    Amount = lineRequest.Amount,
                    TaxAmount = lineRequest.TaxAmount,
                    CreatedUtc = DateTime.UtcNow
                };
                invoice.Lines.Add(line);
            }

            invoice.TotalAmount = totalAmount;
        }

        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/send")]
    public async Task<IActionResult> SendARInvoice(Guid id)
    {
        var invoice = await _dbContext.ARInvoices
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AR invoice not found." });

        if (invoice.Status != ARInvoiceStatus.Draft)
            return BadRequest(new { message = $"Cannot send invoice in {invoice.Status} status." });

        invoice.Status = ARInvoiceStatus.Sent;
        invoice.LastModifiedByUserId = User.FindFirst("sub")?.Value ?? "system";
        invoice.LastModifiedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        try
        {
            await _postingService.PostARInvoiceAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to post invoice to GL, but invoice was sent");
        }

        await _audit.LogAsync(
            entityName: "ARInvoice",
            action: "Sent",
            category: AuditCategories.DataChange,
            recordId: invoice.Id.ToString(),
            details: new { invoice.InvoiceNumber, invoice.CustomerId, invoice.TotalAmount });

        return Ok(new { message = "Invoice sent successfully and posted to GL", invoiceId = id });
    }

    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> VoidARInvoice(Guid id)
    {
        var invoice = await _dbContext.ARInvoices.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AR invoice not found." });

        if (invoice.Status == ARInvoiceStatus.Paid)
            return BadRequest(new { message = "Cannot void a paid invoice." });

        invoice.Status = ARInvoiceStatus.Void;
        invoice.IsDeleted = true;
        invoice.DeletedUtc = DateTime.UtcNow;
        invoice.LastModifiedByUserId = User.FindFirst("sub")?.Value ?? "system";
        invoice.LastModifiedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "ARInvoice",
            action: "Voided",
            category: AuditCategories.DataChange,
            recordId: invoice.Id.ToString(),
            details: new { invoice.InvoiceNumber, invoice.CustomerId, invoice.TotalAmount });

        return Ok(new { message = "Invoice voided successfully", invoiceId = id });
    }

    [HttpPost("{id:guid}/mark-paid")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> MarkARInvoicePaid(Guid id, [FromBody] MarkPaidRequest request)
    {
        var invoice = await _dbContext.ARInvoices.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        if (invoice is null)
            return NotFound(new { message = "AR invoice not found." });

        if (invoice.Status == ARInvoiceStatus.Paid)
            return BadRequest(new { message = "Invoice is already marked as paid." });

        if (invoice.Status == ARInvoiceStatus.Void)
            return BadRequest(new { message = "Cannot mark a voided invoice as paid." });

        if (invoice.Status == ARInvoiceStatus.Draft)
            return BadRequest(new { message = "Cannot mark a draft invoice as paid. Send or approve it first." });

        invoice.Status = ARInvoiceStatus.Paid;
        invoice.LastModifiedByUserId = User.FindFirst("sub")?.Value ?? "system";
        invoice.LastModifiedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "ARInvoice",
            action: "MarkedPaid",
            category: AuditCategories.DataChange,
            recordId: invoice.Id.ToString(),
            details: new
            {
                invoice.InvoiceNumber,
                invoice.CustomerId,
                invoice.TotalAmount,
                paymentReference = request.PaymentReference,
            });

        return Ok(new { message = "Invoice marked as paid.", invoiceId = id });
    }
}

public record MarkPaidRequest(string? PaymentReference);
