using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Models;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/apinvoices")]
[Authorize(Roles = "accountant,cfo,super-admin")]
public class APInvoicesController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<APInvoicesController> _logger;
    private readonly IInvoicePostingService _postingService;
    private readonly IAuditEventLogger _audit;


    public APInvoicesController(CMNetworkDbContext dbContext, ILogger<APInvoicesController> logger, IInvoicePostingService postingService, IAuditEventLogger audit)
    {
        _dbContext = dbContext;
        _logger = logger;
        _postingService = postingService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetAPInvoices(
        [FromQuery] Guid? vendorId = null,
        [FromQuery] int? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        var query = _dbContext.APInvoices
            .Where(x => !x.IsDeleted)
            .AsQueryable();

        if (vendorId.HasValue)
            query = query.Where(x => x.VendorId == vendorId.Value);

        if (status.HasValue)
            query = query.Where(x => (int)x.Status == status.Value);

        if (fromDate.HasValue)
            query = query.Where(x => x.InvoiceDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(x => x.InvoiceDate <= toDate.Value);

        var items = await query
            .Include(x => x.Vendor)
            .OrderByDescending(x => x.InvoiceDate)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDate,
                x.DueDate,
                x.TotalAmount,
                x.Status,
                VendorName = x.Vendor.Name,
                VendorCode = x.Vendor.VendorCode,
                x.CreatedUtc,
                x.CreatedByUserId
            })
                .ToListAsync();

            return Ok(items);
        }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAPInvoice(Guid id)
    {
        var invoice = await _dbContext.APInvoices
            .Include(x => x.Vendor)
            .Include(x => x.Lines)
            .ThenInclude(x => x.Account)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AP invoice not found." });

        var result = new
        {
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.InvoiceDate,
            invoice.DueDate,
            invoice.TotalAmount,
            invoice.Status,
            invoice.VendorId,
            VendorName = invoice.Vendor.Name,
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
    public async Task<IActionResult> CreateAPInvoice([FromBody] CreateAPInvoiceRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Validate vendor exists
        var vendor = await _dbContext.Vendors.FirstOrDefaultAsync(x => x.Id == request.VendorId && x.IsActive);
        if (vendor == null)
            return BadRequest(new { message = "Vendor not found or inactive." });

        // Validate lines not empty
        if (request.Lines == null || request.Lines.Count == 0)
            return BadRequest(new { message = "At least one invoice line is required." });

        // Validate invoice number is unique
        var existingInvoice = await _dbContext.APInvoices
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
        var invoice = new APInvoice
        {
            Id = Guid.NewGuid(),
            VendorId = request.VendorId,
            InvoiceNumber = request.InvoiceNumber,
            InvoiceDate = request.InvoiceDate,
            DueDate = request.DueDate,
            TotalAmount = totalAmount,
            Status = APInvoiceStatus.Draft,
            CreatedByUserId = User.FindFirst("sub")?.Value ?? "system",
            CreatedUtc = DateTime.UtcNow
        };

        // Add lines
        foreach (var lineRequest in request.Lines)
        {
            var line = new APInvoiceLine
            {
                Id = Guid.NewGuid(),
                APInvoiceId = invoice.Id,
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

        _dbContext.APInvoices.Add(invoice);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAPInvoice), new { id = invoice.Id }, new { invoice.Id, invoice.InvoiceNumber });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateAPInvoice(Guid id, [FromBody] UpdateAPInvoiceRequest request)
    {
        var invoice = await _dbContext.APInvoices
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AP invoice not found." });

        // Only allow updating Draft or Submitted invoices
        if (invoice.Status != APInvoiceStatus.Draft && invoice.Status != APInvoiceStatus.Submitted)
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
            _dbContext.APInvoiceLines.RemoveRange(invoice.Lines);

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

                var line = new APInvoiceLine
                {
                    Id = Guid.NewGuid(),
                    APInvoiceId = invoice.Id,
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

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> ApproveAPInvoice(Guid id)
    {
        var invoice = await _dbContext.APInvoices
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AP invoice not found." });

        if (invoice.Status != APInvoiceStatus.Submitted && invoice.Status != APInvoiceStatus.Draft)
            return BadRequest(new { message = $"Cannot approve invoice in {invoice.Status} status." });

        invoice.Status = APInvoiceStatus.Approved;
        invoice.LastModifiedByUserId = User.FindFirst("sub")?.Value ?? "system";
        invoice.LastModifiedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        try
        {
            await _postingService.PostAPInvoiceAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to post invoice to GL, but invoice was approved");
        }

        await _audit.LogAsync(
            entityName: nameof(APInvoice),
            action: "Approved",
            category: AuditCategories.Approval,
            recordId: id.ToString(),
            details: new { invoice.InvoiceNumber, invoice.VendorId, invoice.TotalAmount });

        return Ok(new { message = "Invoice approved successfully and posted to GL", invoiceId = id });
    }

    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> VoidAPInvoice(Guid id)
    {
        var invoice = await _dbContext.APInvoices.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (invoice == null)
            return NotFound(new { message = "AP invoice not found." });

        if (invoice.Status == APInvoiceStatus.Paid)
            return BadRequest(new { message = "Cannot void a paid invoice." });

        invoice.Status = APInvoiceStatus.Void;
        invoice.IsDeleted = true;
        invoice.DeletedUtc = DateTime.UtcNow;
        invoice.LastModifiedByUserId = User.FindFirst("sub")?.Value ?? "system";
        invoice.LastModifiedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: nameof(APInvoice),
            action: "Voided",
            category: AuditCategories.Approval,
            recordId: id.ToString(),
            details: new { invoice.InvoiceNumber, invoice.VendorId, invoice.TotalAmount });

        return Ok(new { message = "Invoice voided successfully", invoiceId = id });
    }
}
