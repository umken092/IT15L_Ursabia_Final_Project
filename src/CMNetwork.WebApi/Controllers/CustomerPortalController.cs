using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
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
[Authorize(Roles = "customer")]
public class CustomerPortalController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;

    public CustomerPortalController(CMNetworkDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // Resolve the Customer entity whose email matches the authenticated user.
    private async Task<Customer?> GetCurrentCustomerAsync()
    {
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

    /// <summary>Returns all AR invoices for the authenticated customer.</summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> GetMyInvoices()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = "No customer record is linked to this account." });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .Select(inv => new
            {
                inv.Id,
                inv.InvoiceNumber,
                InvoiceDate = inv.InvoiceDate.ToString("yyyy-MM-dd"),
                DueDate = inv.DueDate.ToString("yyyy-MM-dd"),
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

    /// <summary>Returns a PDF account statement for the authenticated customer.</summary>
    [HttpGet("statement")]
    public async Task<IActionResult> GetStatement()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = "No customer record is linked to this account." });
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
                        table.Cell().Element(CellStyle).Text(inv.InvoiceDate.ToString("yyyy-MM-dd"));
                        table.Cell().Element(CellStyle).Text(inv.DueDate.ToString("yyyy-MM-dd"));
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
