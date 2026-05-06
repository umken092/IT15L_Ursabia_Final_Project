using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/payslips")]
[Authorize]
public class PayslipsController : ControllerBase
{
    private readonly CMNetworkDbContext _db;

    public PayslipsController(CMNetworkDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetPayslips()
    {
        var userId = GetCurrentUserId();
        var isHR = User.IsInRole("faculty-admin") || User.IsInRole("super-admin");

        var query = _db.Payslips.AsQueryable();

        if (!isHR)
            query = query.Where(x => x.EmployeeId.ToString() == userId);

        var items = await query
            .OrderByDescending(x => x.PeriodStart)
            .Select(x => new
            {
                x.Id,
                x.PayslipNumber,
                x.EmployeeId,
                x.EmployeeName,
                x.PeriodStart,
                x.PeriodEnd,
                x.GrossPay,
                x.TaxDeduction,
                x.SssDeduction,
                x.PhilHealthDeduction,
                x.PagIbigDeduction,
                x.OtherDeductions,
                x.NetPay,
                x.GeneratedAtUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPayslip(Guid id)
    {
        var payslip = await _db.Payslips.FirstOrDefaultAsync(x => x.Id == id);
        if (payslip is null)
            return NotFound(new { message = "Payslip not found." });

        var userId = GetCurrentUserId();
        var isHR = User.IsInRole("faculty-admin") || User.IsInRole("super-admin");
        if (!isHR && payslip.EmployeeId.ToString() != userId)
            return Forbid();

        return Ok(payslip);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> DownloadPayslip(Guid id)
    {
        var payslip = await _db.Payslips.FirstOrDefaultAsync(x => x.Id == id);
        if (payslip is null)
            return NotFound(new { message = "Payslip not found." });

        var userId = GetCurrentUserId();
        var isHR = User.IsInRole("faculty-admin") || User.IsInRole("super-admin");
        if (!isHR && payslip.EmployeeId.ToString() != userId)
            return Forbid();

        QuestPDF.Settings.License = LicenseType.Community;
        var pdfBytes = GeneratePayslipPdf(payslip);

        var fileName = $"Payslip-{payslip.PayslipNumber}-{payslip.PeriodStart:yyyy-MM}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    [HttpPost]
    [Authorize(Roles = "faculty-admin,super-admin")]
    public async Task<IActionResult> CreatePayslip([FromBody] CreatePayslipRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var payslipNumber = await GeneratePayslipNumberAsync();

        var totalDeductions = request.TaxDeduction + request.SssDeduction +
            request.PhilHealthDeduction + request.PagIbigDeduction + request.OtherDeductions;

        var payslip = new Payslip
        {
            Id = Guid.NewGuid(),
            PayslipNumber = payslipNumber,
            EmployeeId = request.EmployeeId,
            EmployeeName = request.EmployeeName.Trim(),
            PeriodStart = request.PeriodStart,
            PeriodEnd = request.PeriodEnd,
            GrossPay = decimal.Round(request.GrossPay, 2),
            TaxDeduction = decimal.Round(request.TaxDeduction, 2),
            SssDeduction = decimal.Round(request.SssDeduction, 2),
            PhilHealthDeduction = decimal.Round(request.PhilHealthDeduction, 2),
            PagIbigDeduction = decimal.Round(request.PagIbigDeduction, 2),
            OtherDeductions = decimal.Round(request.OtherDeductions, 2),
            NetPay = decimal.Round(request.GrossPay - totalDeductions, 2),
            GeneratedBy = GetCurrentUser(),
            GeneratedAtUtc = DateTime.UtcNow
        };

        _db.Payslips.Add(payslip);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPayslip), new { id = payslip.Id }, payslip);
    }

    private static byte[] GeneratePayslipPdf(Payslip payslip)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Element(header =>
                {
                    header.Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("CMNetwork Accounting").Bold().FontSize(16);
                            col.Item().Text("Payslip").FontSize(12).FontColor(Colors.Grey.Medium);
                        });
                        row.ConstantItem(150).Column(col =>
                        {
                            col.Item().AlignRight().Text($"#{payslip.PayslipNumber}").Bold();
                            col.Item().AlignRight().Text($"Period: {payslip.PeriodStart:MMM dd} – {payslip.PeriodEnd:MMM dd, yyyy}");
                        });
                    });
                });

                page.Content().PaddingTop(20).Column(col =>
                {
                    // Employee info
                    col.Item().Background(Colors.Grey.Lighten3).Padding(10).Column(info =>
                    {
                        info.Item().Text($"Employee: {payslip.EmployeeName}").Bold();
                        info.Item().Text($"Generated: {payslip.GeneratedAtUtc:MMMM dd, yyyy}");
                    });

                    col.Item().PaddingTop(15).Text("Earnings").Bold().FontSize(12);
                    col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    col.Item().PaddingTop(5).Row(row =>
                    {
                        row.RelativeItem().Text("Gross Pay");
                        row.ConstantItem(120).AlignRight().Text($"₱{payslip.GrossPay:N2}").Bold();
                    });

                    col.Item().PaddingTop(15).Text("Deductions").Bold().FontSize(12);
                    col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    AddDeductionRow(col, "Withholding Tax", payslip.TaxDeduction);
                    AddDeductionRow(col, "SSS", payslip.SssDeduction);
                    AddDeductionRow(col, "PhilHealth", payslip.PhilHealthDeduction);
                    AddDeductionRow(col, "Pag-IBIG", payslip.PagIbigDeduction);
                    if (payslip.OtherDeductions > 0)
                        AddDeductionRow(col, "Other Deductions", payslip.OtherDeductions);

                    col.Item().PaddingTop(15).LineHorizontal(2).LineColor(Colors.Black);
                    col.Item().PaddingTop(8).Row(row =>
                    {
                        row.RelativeItem().Text("Net Pay").Bold().FontSize(13);
                        row.ConstantItem(120).AlignRight().Text($"₱{payslip.NetPay:N2}").Bold().FontSize(13).FontColor(Colors.Green.Darken2);
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("This is a system-generated payslip. No signature required. — ");
                    text.Span("CMNetwork ERP").Bold();
                });
            });
        }).GeneratePdf();
    }

    private static void AddDeductionRow(ColumnDescriptor col, string label, decimal amount)
    {
        col.Item().PaddingTop(3).Row(row =>
        {
            row.RelativeItem().Text(label).FontColor(Colors.Grey.Darken2);
            row.ConstantItem(120).AlignRight().Text($"₱{amount:N2}").FontColor(Colors.Red.Darken1);
        });
    }

    private string GetCurrentUser() =>
        User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "system";

    private string GetCurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    private async Task<string> GeneratePayslipNumberAsync()
    {
        var count = await _db.Payslips.CountAsync();
        return $"PS-{DateTime.UtcNow:yyyyMM}-{count + 1:D4}";
    }
}

public record CreatePayslipRequest
{
    public Guid EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public DateOnly PeriodStart { get; init; }
    public DateOnly PeriodEnd { get; init; }
    public decimal GrossPay { get; init; }
    public decimal TaxDeduction { get; init; }
    public decimal SssDeduction { get; init; }
    public decimal PhilHealthDeduction { get; init; }
    public decimal PagIbigDeduction { get; init; }
    public decimal OtherDeductions { get; init; }
}
