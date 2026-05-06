using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "accountant,cfo,super-admin,authorized-viewer,auditor,faculty-admin")]
public class ReportsController : ControllerBase
{
    private readonly CMNetworkDbContext _db;
    private readonly IAuditEventLogger _audit;
    private static readonly HashSet<string> AllowedReportTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "income-statement",
        "balance-sheet",
        "cash-flow",
        "aging-ap",
        "aging-ar",
        "department-budget"
    };

    private static readonly HashSet<string> AllowedCadences = new(StringComparer.OrdinalIgnoreCase)
    {
        "Daily",
        "Weekly",
        "Monthly"
    };

    private static readonly HashSet<string> AllowedTargets = new(StringComparer.OrdinalIgnoreCase)
    {
        "Excel",
        "PDF"
    };

    private const string TemplatePrefix = "reports-template:";
    private const string SchedulePrefix = "reports-schedule:";
    private const string BucketCurrent = "Current";
    private const string Bucket1To30 = "1-30 days";
    private const string Bucket31To60 = "31-60 days";
    private const string Bucket61To90 = "61-90 days";
    private const string BucketOver90 = "90+ days";

    public ReportsController(CMNetworkDbContext db, IAuditEventLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    // ── Income Statement ──────────────────────────────────────────────────────

    [HttpGet("income-statement")]
    public async Task<IActionResult> GetIncomeStatement(
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        [FromQuery(Name = "startDate")] DateOnly? startDate = null,
        [FromQuery(Name = "endDate")] DateOnly? endDate = null)
    {
        var fromDate = from ?? startDate ?? new DateOnly(DateTime.UtcNow.Year, 1, 1);
        var toDate = to ?? endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var lines = await _db.JournalEntryLines
            .Include(x => x.Account)
            .Include(x => x.JournalEntry)
            .Where(x =>
                x.JournalEntry != null &&
                x.JournalEntry.Status == JournalEntryStatus.Posted &&
                x.JournalEntry.EntryDate >= fromDate &&
                x.JournalEntry.EntryDate <= toDate &&
                x.Account != null &&
                (x.Account.Type == AccountType.Revenue || x.Account.Type == AccountType.Expense))
            .ToListAsync();

        var revenue = lines
            .Where(x => x.Account!.Type == AccountType.Revenue)
            .GroupBy(x => new { x.Account!.AccountCode, x.Account.Name })
            .Select(g => new ReportLineItem(g.Key.AccountCode, g.Key.Name, g.Sum(x => x.Credit - x.Debit)))
            .OrderBy(x => x.AccountCode)
            .ToList();

        var expenses = lines
            .Where(x => x.Account!.Type == AccountType.Expense)
            .GroupBy(x => new { x.Account!.AccountCode, x.Account.Name })
            .Select(g => new ReportLineItem(g.Key.AccountCode, g.Key.Name, g.Sum(x => x.Debit - x.Credit)))
            .OrderBy(x => x.AccountCode)
            .ToList();

        var totalRevenue = revenue.Sum(x => x.Amount);
        var totalExpenses = expenses.Sum(x => x.Amount);
        var netIncome = totalRevenue - totalExpenses;

        return Ok(new
        {
            from = fromDate,
            to = toDate,
            totalRevenue = decimal.Round(totalRevenue, 2),
            totalExpenses = decimal.Round(totalExpenses, 2),
            netIncome = decimal.Round(netIncome, 2),
            revenue,
            expenses
        });
    }

    // ── Balance Sheet ─────────────────────────────────────────────────────────

    [HttpGet("balance-sheet")]
    public async Task<IActionResult> GetBalanceSheet(
        [FromQuery] DateOnly? asOf = null,
        [FromQuery(Name = "asOfDate")] DateOnly? asOfDateFromClient = null)
    {
        var asOfDate = asOf ?? asOfDateFromClient ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var lines = await _db.JournalEntryLines
            .Include(x => x.Account)
            .Include(x => x.JournalEntry)
            .Where(x =>
                x.JournalEntry != null &&
                x.JournalEntry.Status == JournalEntryStatus.Posted &&
                x.JournalEntry.EntryDate <= asOfDate &&
                x.Account != null)
            .ToListAsync();

        var assets = BuildSection(lines, AccountType.Asset);
        var liabilities = BuildSection(lines, AccountType.Liability);
        var equity = BuildSection(lines, AccountType.Equity);

        // Include retained earnings from revenue/expense for current period
        var retainedEarnings = lines
            .Where(x => x.Account!.Type == AccountType.Revenue || x.Account!.Type == AccountType.Expense)
            .Sum(x => x.Account!.Type == AccountType.Revenue
                ? (x.Credit - x.Debit)
                : (x.Debit - x.Credit));

        var totalAssets = assets.Sum(x => x.Amount);
        var totalLiabilities = liabilities.Sum(x => x.Amount);
        var totalEquity = equity.Sum(x => x.Amount) + retainedEarnings;

        return Ok(new
        {
            asOf = asOfDate,
            totalAssets = decimal.Round(totalAssets, 2),
            totalLiabilities = decimal.Round(totalLiabilities, 2),
            totalEquity = decimal.Round(totalEquity + retainedEarnings, 2),
            isBalanced = Math.Abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01m,
            assets,
            liabilities,
            equity,
            retainedEarnings = decimal.Round(retainedEarnings, 2)
        });
    }

    // ── Cash Flow Summary ─────────────────────────────────────────────────────

    [HttpGet("cash-flow")]
    public async Task<IActionResult> GetCashFlow(
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        [FromQuery(Name = "startDate")] DateOnly? startDate = null,
        [FromQuery(Name = "endDate")] DateOnly? endDate = null)
    {
        var fromDate = from ?? startDate ?? new DateOnly(DateTime.UtcNow.Year, 1, 1);
        var toDate = to ?? endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Simple cash flow: operating = net income, financing/investing based on account types
        var lines = await _db.JournalEntryLines
            .Include(x => x.Account)
            .Include(x => x.JournalEntry)
            .Where(x =>
                x.JournalEntry != null &&
                x.JournalEntry.Status == JournalEntryStatus.Posted &&
                x.JournalEntry.EntryDate >= fromDate &&
                x.JournalEntry.EntryDate <= toDate &&
                x.Account != null)
            .ToListAsync();

        var netIncome = lines
            .Where(x => x.Account!.Type == AccountType.Revenue || x.Account!.Type == AccountType.Expense)
            .Sum(x => x.Account!.Type == AccountType.Revenue
                ? (x.Credit - x.Debit)
                : (x.Debit - x.Credit)) * -1; // flip sign for operating cash flow

        // Asset changes (simplified: increases in assets = cash used)
        var assetChanges = lines
            .Where(x => x.Account!.Type == AccountType.Asset)
            .Sum(x => x.Debit - x.Credit);

        // Liability + equity changes
        var financingChanges = lines
            .Where(x => x.Account!.Type == AccountType.Liability || x.Account!.Type == AccountType.Equity)
            .Sum(x => x.Credit - x.Debit);

        return Ok(new
        {
            from = fromDate,
            to = toDate,
            operatingActivities = decimal.Round(netIncome, 2),
            investingActivities = decimal.Round(-assetChanges, 2),
            financingActivities = decimal.Round(financingChanges, 2),
            netCashFlow = decimal.Round(netIncome - assetChanges + financingChanges, 2)
        });
    }

    // ── AP Aging ──────────────────────────────────────────────────────────────

    [HttpGet("aging-ap")]
    public async Task<IActionResult> GetApAging(
        [FromQuery] DateOnly? asOf = null,
        [FromQuery(Name = "asOfDate")] DateOnly? asOfDateFromClient = null)
    {
        var today = asOf ?? asOfDateFromClient ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var invoices = await _db.APInvoices
            .Include(x => x.Vendor)
            .Where(x => !x.IsDeleted && x.Status != APInvoiceStatus.Paid && x.Status != APInvoiceStatus.Void)
            .ToListAsync();

        var rows = invoices.Select(inv =>
        {
            var dueDate = DateOnly.FromDateTime(inv.DueDate);
            var ageDays = today.DayNumber - dueDate.DayNumber;

            return new
            {
                inv.Id,
                inv.InvoiceNumber,
                vendorName = inv.Vendor?.Name ?? "Unknown",
                dueDate,
                inv.TotalAmount,
                ageDays,
                bucket = GetAgingBucket(ageDays),
                status = inv.Status.ToString()
            };
        }).OrderByDescending(x => x.ageDays).ToList();

        var summary = new[]
        {
            new { bucket = BucketCurrent, total = rows.Where(x => x.bucket == BucketCurrent).Sum(x => x.TotalAmount) },
            new { bucket = Bucket1To30, total = rows.Where(x => x.bucket == Bucket1To30).Sum(x => x.TotalAmount) },
            new { bucket = Bucket31To60, total = rows.Where(x => x.bucket == Bucket31To60).Sum(x => x.TotalAmount) },
            new { bucket = Bucket61To90, total = rows.Where(x => x.bucket == Bucket61To90).Sum(x => x.TotalAmount) },
            new { bucket = BucketOver90, total = rows.Where(x => x.bucket == BucketOver90).Sum(x => x.TotalAmount) }
        };

        return Ok(new { asOf = today, items = rows, summary });
    }

    // ── AR Aging ──────────────────────────────────────────────────────────────

    [HttpGet("aging-ar")]
    public async Task<IActionResult> GetArAging(
        [FromQuery] DateOnly? asOf = null,
        [FromQuery(Name = "asOfDate")] DateOnly? asOfDateFromClient = null)
    {
        var today = asOf ?? asOfDateFromClient ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var invoices = await _db.ARInvoices
            .Include(x => x.Customer)
            .Where(x => !x.IsDeleted && x.Status != ARInvoiceStatus.Paid && x.Status != ARInvoiceStatus.Void)
            .ToListAsync();

        var rows = invoices.Select(inv =>
        {
            var dueDate = DateOnly.FromDateTime(inv.DueDate);
            var ageDays = today.DayNumber - dueDate.DayNumber;

            return new
            {
                inv.Id,
                inv.InvoiceNumber,
                customerName = inv.Customer?.Name ?? "Unknown",
                dueDate,
                inv.TotalAmount,
                ageDays,
                bucket = GetAgingBucket(ageDays),
                status = inv.Status.ToString()
            };
        }).OrderByDescending(x => x.ageDays).ToList();

        var summary = new[]
        {
            new { bucket = BucketCurrent, total = rows.Where(x => x.bucket == BucketCurrent).Sum(x => x.TotalAmount) },
            new { bucket = Bucket1To30, total = rows.Where(x => x.bucket == Bucket1To30).Sum(x => x.TotalAmount) },
            new { bucket = Bucket31To60, total = rows.Where(x => x.bucket == Bucket31To60).Sum(x => x.TotalAmount) },
            new { bucket = Bucket61To90, total = rows.Where(x => x.bucket == Bucket61To90).Sum(x => x.TotalAmount) },
            new { bucket = BucketOver90, total = rows.Where(x => x.bucket == BucketOver90).Sum(x => x.TotalAmount) }
        };

        return Ok(new { asOf = today, items = rows, summary });
    }

    // ── Department Budget ─────────────────────────────────────────────────────

    [HttpGet("department-budget")]
    public async Task<IActionResult> GetDepartmentBudget([FromQuery] Guid? periodId = null)
    {
        try
        {
            var departments = await _db.Departments.ToListAsync();

            // Get actual expenses per department from expense claims
            var claimsQuery = _db.ExpenseClaims
                .Where(x => x.Status == ExpenseClaimStatus.Approved);

            var actualByDept = await claimsQuery
                .GroupBy(x => x.Category)
                .Select(g => new { dept = g.Key, actual = g.Sum(x => x.Amount) })
                .ToListAsync();

            var rows = departments.Select(dept =>
            {
                var actual = actualByDept
                    .Where(x => x.dept.Contains(dept.Name, StringComparison.OrdinalIgnoreCase))
                    .Sum(x => x.actual);

                return new
                {
                    dept.Id,
                    dept.Code,
                    dept.Name,
                    budget = dept.BudgetAmount,
                    actual = decimal.Round(actual, 2),
                    remaining = decimal.Round(dept.BudgetAmount - actual, 2),
                    utilizationPct = dept.BudgetAmount > 0
                        ? decimal.Round(actual / dept.BudgetAmount * 100, 1)
                        : 0m
                };
            }).ToList();

            return Ok(new { items = rows, totalBudget = rows.Sum(x => x.budget), totalActual = rows.Sum(x => x.actual) });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while retrieving department budget data.", detail = ex.Message });
        }
    }

    // ── Export ────────────────────────────────────────────────────────────────

    [HttpGet("export/{type}")]
    public async Task<IActionResult> Export(string type, [FromQuery] ExportQuery query)
    {
        var normalizedFormat = (query.Format ?? "excel").Trim().ToLowerInvariant();
        var normalizedType = type.Trim().ToLowerInvariant();

        if (normalizedFormat is not ("excel" or "pdf"))
            return BadRequest(new { message = "Format must be 'excel' or 'pdf'." });

        if (normalizedType is not ("income-statement" or "balance-sheet" or "aging-ap" or "aging-ar"))
            return BadRequest(new { message = "Unsupported report type for export." });

        var fromDate = query.From ?? query.StartDate;
        var toDate = query.To ?? query.EndDate;
        var asOfDate = query.AsOf ?? query.AsOfDate;

        // Balance sheet and aging exports are point-in-time reports.
        if (normalizedType is "balance-sheet" or "aging-ap" or "aging-ar")
        {
            var pointInTime = asOfDate ?? toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
            fromDate = pointInTime;
            toDate = pointInTime;
        }
        else
        {
            fromDate ??= new DateOnly(DateTime.UtcNow.Year, 1, 1);
            toDate ??= DateOnly.FromDateTime(DateTime.UtcNow);
        }

        // Audit the export — fire before the response stream is written.
        await _audit.LogAsync(
            entityName: "Report",
            action: "Exported",
            category: AuditCategories.Export,
            recordId: normalizedType,
            details: new
            {
                reportType = normalizedType,
                format = normalizedFormat,
                from = fromDate?.ToString("yyyy-MM-dd"),
                to = toDate?.ToString("yyyy-MM-dd"),
            });

        if (normalizedFormat == "excel")
        {
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
            using var package = new ExcelPackage();
            var sheet = package.Workbook.Worksheets.Add(normalizedType);
            sheet.Cells[1, 1].Value = $"CMNetwork — {normalizedType.Replace("-", " ").ToUpper()}";
            sheet.Cells[1, 1].Style.Font.Bold = true;
            sheet.Cells[1, 1].Style.Font.Size = 14;
            sheet.Cells[2, 1].Value = $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
            sheet.Cells[3, 1].Value = $"Period: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}";

            // Placeholder row — full data would mirror the GET endpoint logic
            sheet.Cells[5, 1].Value = "Account Code";
            sheet.Cells[5, 2].Value = "Account Name";
            sheet.Cells[5, 3].Value = "Amount";
            sheet.Cells[5, 1, 5, 3].Style.Font.Bold = true;
            sheet.Cells[6, 1].Value = "(See report API for full data)";

            sheet.Cells.AutoFitColumns();
            var bytes = await package.GetAsByteArrayAsync();
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{normalizedType}-{toDate:yyyyMM}.xlsx");
        }
        else
        {
            QuestPDF.Settings.License = LicenseType.Community;
            var pdfBytes = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.Header().Text($"CMNetwork — {normalizedType.Replace("-", " ").ToUpper()}").Bold().FontSize(16);
                    page.Content().PaddingTop(20).Text($"Period: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}");
                    page.Footer().AlignCenter().Text("Generated by CMNetwork ERP");
                });
            }).GeneratePdf();

            return File(pdfBytes, "application/pdf", $"{normalizedType}-{toDate:yyyyMM}.pdf");
        }
    }

    // ── Report Templates ─────────────────────────────────────────────────────

    [HttpGet("report-templates")]
    public async Task<IActionResult> GetReportTemplates()
    {
        var userIdentity = GetCurrentUserIdentity();
        var rows = await _db.IntegrationSettings
            .Where(x => x.Name.StartsWith(TemplatePrefix))
            .OrderByDescending(x => x.LastSyncUtc)
            .ToListAsync();

        var items = rows
            .Select(MapTemplate)
            .Where(x => x is not null)
            .Select(x => x!)
            .Where(x => x.Visibility.Equals("Team", StringComparison.OrdinalIgnoreCase) || x.Owner.Equals(userIdentity, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(x => x.UpdatedAt)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Type,
                x.Visibility,
                updatedAt = x.UpdatedAt.ToString("O", CultureInfo.InvariantCulture)
            })
            .ToList();

        return Ok(new { items });
    }

    [HttpPost("report-templates")]
    public async Task<IActionResult> CreateReportTemplate([FromBody] CreateReportTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Template name is required." });

        if (!AllowedReportTypes.Contains(request.Type))
            return BadRequest(new { message = "Invalid report type." });

        if (request.Visibility is not ("Private" or "Team"))
            return BadRequest(new { message = "Visibility must be Private or Team." });

        var id = Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture);
        var now = DateTime.UtcNow;
        var payload = new TemplatePayload(request.Name.Trim(), request.Type, request.Visibility, GetCurrentUserIdentity());

        _db.IntegrationSettings.Add(new IntegrationSetting
        {
            Id = Guid.NewGuid(),
            Name = $"{TemplatePrefix}{id}",
            Status = request.Visibility,
            Endpoint = JsonSerializer.Serialize(payload),
            LastSyncUtc = now
        });

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id,
            name = payload.Name,
            type = payload.Type,
            visibility = payload.Visibility,
            updatedAt = now.ToString("O", CultureInfo.InvariantCulture)
        });
    }

    [HttpDelete("report-templates/{id}")]
    public async Task<IActionResult> DeleteReportTemplate(string id)
    {
        var row = await _db.IntegrationSettings
            .FirstOrDefaultAsync(x => x.Name == $"{TemplatePrefix}{id}");

        if (row is null)
            return NotFound(new { message = "Report template not found." });

        var mapped = MapTemplate(row);
        if (mapped is null)
            return NotFound(new { message = "Report template data is invalid or corrupt." });

        var userIdentity = GetCurrentUserIdentity();
        var canDelete = mapped.Owner.Equals(userIdentity, StringComparison.OrdinalIgnoreCase)
            || User.IsInRole("cfo")
            || User.IsInRole("super-admin");

        if (!canDelete)
            return Forbid();

        _db.IntegrationSettings.Remove(row);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Report Schedules ─────────────────────────────────────────────────────

    [HttpGet("report-schedules")]
    public async Task<IActionResult> GetReportSchedules()
    {
        var rows = await _db.IntegrationSettings
            .Where(x => x.Name.StartsWith(SchedulePrefix))
            .OrderByDescending(x => x.LastSyncUtc)
            .ToListAsync();

        var items = rows
            .Select(MapSchedule)
            .Where(x => x is not null)
            .Select(x => x!)
            .OrderBy(x => x.Label)
            .ToList();

        return Ok(new { items });
    }

    [HttpPost("report-schedules")]
    public async Task<IActionResult> CreateReportSchedule([FromBody] CreateOrUpdateReportScheduleRequest request)
    {
        var validationError = ValidateScheduleRequest(request);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var id = Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture);
        var now = DateTime.UtcNow;
        var payload = new SchedulePayload(request.Label.Trim(), request.Type, request.Cadence, request.Target);

        _db.IntegrationSettings.Add(new IntegrationSetting
        {
            Id = Guid.NewGuid(),
            Name = $"{SchedulePrefix}{id}",
            Status = request.Active ? "active" : "inactive",
            Endpoint = JsonSerializer.Serialize(payload),
            LastSyncUtc = now
        });

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id,
            label = payload.Label,
            type = payload.Type,
            cadence = payload.Cadence,
            target = payload.Target,
            active = request.Active,
            updatedAt = now.ToString("O", CultureInfo.InvariantCulture)
        });
    }

    [HttpPut("report-schedules/{id}")]
    public async Task<IActionResult> UpdateReportSchedule(string id, [FromBody] CreateOrUpdateReportScheduleRequest request)
    {
        var validationError = ValidateScheduleRequest(request);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var row = await _db.IntegrationSettings
            .FirstOrDefaultAsync(x => x.Name == $"{SchedulePrefix}{id}");

        if (row is null)
            return NotFound(new { message = "Report schedule not found." });

        var payload = new SchedulePayload(request.Label.Trim(), request.Type, request.Cadence, request.Target);
        row.Status = request.Active ? "active" : "inactive";
        row.Endpoint = JsonSerializer.Serialize(payload);
        row.LastSyncUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            id,
            label = payload.Label,
            type = payload.Type,
            cadence = payload.Cadence,
            target = payload.Target,
            active = request.Active,
            updatedAt = row.LastSyncUtc?.ToString("O", CultureInfo.InvariantCulture)
        });
    }

    [HttpPost("report-schedules/{id}/run-now")]
    public async Task<IActionResult> RunScheduleNow(string id)
    {
        var row = await _db.IntegrationSettings
            .FirstOrDefaultAsync(x => x.Name == $"{SchedulePrefix}{id}");

        if (row is null)
            return NotFound(new { message = "Report schedule not found." });

        row.LastSyncUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { queuedAt = row.LastSyncUtc?.ToString("O", CultureInfo.InvariantCulture) });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static List<ReportLineItem> BuildSection(
        IEnumerable<JournalEntryLine> lines,
        AccountType type)
    {
        return lines
            .Where(x => x.Account!.Type == type)
            .GroupBy(x => new { x.Account!.AccountCode, x.Account.Name })
            .Select(g =>
            {
                var balance = type == AccountType.Asset || type == AccountType.Expense
                    ? g.Sum(x => x.Debit - x.Credit)
                    : g.Sum(x => x.Credit - x.Debit);
                return new ReportLineItem(g.Key.AccountCode, g.Key.Name, decimal.Round(balance, 2));
            })
            .OrderBy(x => x.AccountCode)
            .ToList();
    }

    private static string GetAgingBucket(int ageDays)
    {
        if (ageDays <= 0)
        {
            return BucketCurrent;
        }

        if (ageDays <= 30)
        {
            return Bucket1To30;
        }

        if (ageDays <= 60)
        {
            return Bucket31To60;
        }

        if (ageDays <= 90)
        {
            return Bucket61To90;
        }

        return BucketOver90;
    }

    private string GetCurrentUserIdentity()
    {
        return User.FindFirstValue(ClaimTypes.Email)
            ?? User.Identity?.Name
            ?? "unknown@cmnetwork.local";
    }

    private static string? ValidateScheduleRequest(CreateOrUpdateReportScheduleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Label))
            return "Schedule label is required.";

        if (!AllowedReportTypes.Contains(request.Type))
            return "Invalid report type.";

        if (!AllowedCadences.Contains(request.Cadence))
            return "Cadence must be Daily, Weekly, or Monthly.";

        if (!AllowedTargets.Contains(request.Target))
            return "Target must be Excel or PDF.";

        return null;
    }

    private static ReportTemplateView? MapTemplate(IntegrationSetting row)
    {
        if (!row.Name.StartsWith(TemplatePrefix, StringComparison.Ordinal))
            return null;

        try
        {
            var payload = JsonSerializer.Deserialize<TemplatePayload>(row.Endpoint);
            if (payload is null)
                return null;

            return new ReportTemplateView(
                row.Name[TemplatePrefix.Length..],
                payload.Name,
                payload.Type,
                payload.Visibility,
                payload.Owner,
                row.LastSyncUtc ?? DateTime.UtcNow);
        }
        catch
        {
            return null;
        }
    }

    private static ReportScheduleView? MapSchedule(IntegrationSetting row)
    {
        if (!row.Name.StartsWith(SchedulePrefix, StringComparison.Ordinal))
            return null;

        try
        {
            var payload = JsonSerializer.Deserialize<SchedulePayload>(row.Endpoint);
            if (payload is null)
                return null;

            return new ReportScheduleView(
                row.Name[SchedulePrefix.Length..],
                payload.Label,
                payload.Type,
                payload.Cadence,
                payload.Target,
                row.Status.Equals("active", StringComparison.OrdinalIgnoreCase),
                row.LastSyncUtc?.ToString("O", CultureInfo.InvariantCulture));
        }
        catch
        {
            return null;
        }
    }

    public sealed class ExportQuery
    {
        public string? Format { get; init; }
        public DateOnly? From { get; init; }
        public DateOnly? To { get; init; }
        public DateOnly? AsOf { get; init; }
        public DateOnly? StartDate { get; init; }
        public DateOnly? EndDate { get; init; }
        public DateOnly? AsOfDate { get; init; }
    }

    public sealed class CreateReportTemplateRequest
    {
        public string Name { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string Visibility { get; init; } = "Private";
    }

    public sealed class CreateOrUpdateReportScheduleRequest
    {
        public string Label { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string Cadence { get; init; } = "Weekly";
        public string Target { get; init; } = "Excel";
        public bool Active { get; init; } = true;
    }

    private sealed record ReportLineItem(string AccountCode, string AccountName, decimal Amount);
    private sealed record TemplatePayload(string Name, string Type, string Visibility, string Owner);
    private sealed record SchedulePayload(string Label, string Type, string Cadence, string Target);
    private sealed record ReportTemplateView(string Id, string Name, string Type, string Visibility, string Owner, DateTime UpdatedAt);
    private sealed record ReportScheduleView(string Id, string Label, string Type, string Cadence, string Target, bool Active, string? UpdatedAt);
}
