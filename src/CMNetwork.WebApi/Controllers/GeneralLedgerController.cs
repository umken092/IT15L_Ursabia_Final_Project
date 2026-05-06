using System.Globalization;
using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/general-ledger")]
[Authorize(Roles = "accountant,cfo,super-admin,auditor")]
public class GeneralLedgerController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly IAuditEventLogger _audit;

    public GeneralLedgerController(CMNetworkDbContext dbContext, IAuditEventLogger audit)
    {
        _dbContext = dbContext;
        _audit = audit;
    }

    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts()
    {
        var items = await _dbContext.ChartOfAccounts
            .OrderBy(x => x.AccountCode)
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("accounts")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateAccountRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var exists = await _dbContext.ChartOfAccounts.AnyAsync(x => x.AccountCode == request.AccountCode);
        if (exists)
            return Conflict(new { message = "Account code already exists." });

        if (request.ParentAccountId.HasValue)
        {
            var parentExists = await _dbContext.ChartOfAccounts.AnyAsync(x => x.Id == request.ParentAccountId.Value);
            if (!parentExists)
                return BadRequest(new { message = "Parent account not found." });
        }

        var account = new ChartOfAccount
        {
            Id = Guid.NewGuid(),
            AccountCode = request.AccountCode.Trim(),
            Name = request.Name.Trim(),
            Type = request.Type,
            ParentAccountId = request.ParentAccountId,
            IsActive = true,
            CreatedUtc = DateTime.UtcNow
        };

        _dbContext.ChartOfAccounts.Add(account);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAccounts), new { id = account.Id }, account);
    }

    [HttpPut("accounts/{id:guid}")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> UpdateAccount(Guid id, [FromBody] UpdateAccountRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var account = await _dbContext.ChartOfAccounts.FirstOrDefaultAsync(x => x.Id == id);
        if (account is null)
            return NotFound(new { message = "Account not found." });

        if (request.ParentAccountId == id)
            return BadRequest(new { message = "An account cannot be its own parent." });

        if (request.ParentAccountId.HasValue)
        {
            var parentExists = await _dbContext.ChartOfAccounts.AnyAsync(x => x.Id == request.ParentAccountId.Value);
            if (!parentExists)
                return BadRequest(new { message = "Parent account not found." });
        }

        account.Name = request.Name.Trim();
        account.Type = request.Type;
        account.ParentAccountId = request.ParentAccountId;
        account.IsActive = request.IsActive;

        await _dbContext.SaveChangesAsync();
        return Ok(account);
    }

    [HttpGet("periods")]
    public async Task<IActionResult> GetFiscalPeriods()
    {
        var periods = await _dbContext.FiscalPeriods
            .OrderByDescending(x => x.StartDate)
            .ToListAsync();

        return Ok(periods);
    }

    [HttpPost("periods")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> CreateFiscalPeriod([FromBody] CreateFiscalPeriodRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (request.EndDate < request.StartDate)
            return BadRequest(new { message = "EndDate must be greater than or equal to StartDate." });

        var overlaps = await _dbContext.FiscalPeriods.AnyAsync(x =>
            request.StartDate <= x.EndDate && request.EndDate >= x.StartDate);
        if (overlaps)
            return Conflict(new { message = "Fiscal period overlaps an existing period." });

        var period = new FiscalPeriod
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            IsClosed = false,
            CreatedUtc = DateTime.UtcNow
        };

        _dbContext.FiscalPeriods.Add(period);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetFiscalPeriods), new { id = period.Id }, period);
    }

    [HttpPost("periods/{id:guid}/close")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> CloseFiscalPeriod(Guid id)
    {
        var period = await _dbContext.FiscalPeriods.FirstOrDefaultAsync(x => x.Id == id);
        if (period is null)
            return NotFound(new { message = "Fiscal period not found." });

        if (period.IsClosed)
            return BadRequest(new { message = "Fiscal period is already closed." });

        period.IsClosed = true;
        await _dbContext.SaveChangesAsync();
        return Ok(period);
    }

    [HttpPost("periods/{id:guid}/reopen")]
    [Authorize(Roles = "accountant,super-admin")]
    public async Task<IActionResult> ReopenFiscalPeriod(Guid id)
    {
        var period = await _dbContext.FiscalPeriods.FirstOrDefaultAsync(x => x.Id == id);
        if (period is null)
            return NotFound(new { message = "Fiscal period not found." });

        if (!period.IsClosed)
            return BadRequest(new { message = "Fiscal period is already open." });

        period.IsClosed = false;
        await _dbContext.SaveChangesAsync();
        return Ok(period);
    }

    [HttpGet("month-end-checklist/{fiscalYear:int}/{month:int}")]
    public async Task<IActionResult> GetMonthEndChecklist(int fiscalYear, int month)
    {
        if (month is < 1 or > 12)
            return BadRequest(new { message = "Month must be between 1 and 12." });

        var periodStart = new DateOnly(fiscalYear, month, 1);
        var periodEnd = new DateOnly(fiscalYear, month, DateTime.DaysInMonth(fiscalYear, month));

        var fiscalPeriod = await _dbContext.FiscalPeriods
            .FirstOrDefaultAsync(x => x.StartDate <= periodEnd && x.EndDate >= periodStart);

        if (fiscalPeriod is null)
            return NotFound(new { message = "No fiscal period configured for the requested month." });

        var monthEntries = await _dbContext.JournalEntries
            .Where(x => x.EntryDate >= periodStart && x.EntryDate <= periodEnd)
            .Include(x => x.Lines)
            .ToListAsync();

        var postedEntries = monthEntries.Where(x => x.Status == JournalEntryStatus.Posted).ToList();
        var hasPostedEntries = postedEntries.Count > 0;
        var totalDebits = postedEntries.SelectMany(x => x.Lines).Sum(x => x.Debit);
        var totalCredits = postedEntries.SelectMany(x => x.Lines).Sum(x => x.Credit);
        var trialBalanceVerified = hasPostedEntries && totalDebits == totalCredits;

        var tasks = new[]
        {
            new { taskId = "posted-entries", label = "Verify all journals are posted", completed = hasPostedEntries },
            new { taskId = "trial-balance", label = "Validate trial balance totals", completed = trialBalanceVerified },
            new { taskId = "period-open", label = "Confirm fiscal period is ready to close", completed = !fiscalPeriod.IsClosed },
            new { taskId = "accruals", label = "Review and record accrual adjustments", completed = false }
        };

        return Ok(new
        {
            fiscalYear,
            month,
            fiscalPeriodId = fiscalPeriod.Id,
            isPeriodClosed = fiscalPeriod.IsClosed,
            postedEntriesCount = postedEntries.Count,
            trialBalance = new { debits = totalDebits, credits = totalCredits, balanced = totalDebits == totalCredits },
            tasks
        });
    }

    [HttpPost("month-end-close")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> CloseMonthEnd([FromBody] MonthEndCloseRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var periodStart = new DateOnly(request.FiscalYear, request.Month, 1);
        var periodEnd = new DateOnly(request.FiscalYear, request.Month, DateTime.DaysInMonth(request.FiscalYear, request.Month));

        var fiscalPeriod = await _dbContext.FiscalPeriods
            .FirstOrDefaultAsync(x => x.StartDate <= periodEnd && x.EndDate >= periodStart);

        if (fiscalPeriod is null)
            return NotFound(new { message = "No fiscal period configured for the requested month." });

        if (fiscalPeriod.IsClosed)
            return BadRequest(new { message = "Fiscal period is already closed." });

        if (request.ChecklistItems.Any(x => !x.Completed))
            return BadRequest(new { message = "All checklist items must be completed before closing month-end." });

        fiscalPeriod.IsClosed = true;
        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "FiscalPeriod",
            action: "MonthEndClosed",
            category: AuditCategories.DataChange,
            recordId: fiscalPeriod.Id.ToString(),
            details: new
            {
                request.FiscalYear,
                request.Month,
                checklistItems = request.ChecklistItems.Select(x => new { x.TaskId, x.Completed }),
            });

        return Ok(new
        {
            message = "Month-end close completed.",
            fiscalPeriodId = fiscalPeriod.Id,
            request.FiscalYear,
            request.Month,
            closedAtUtc = DateTime.UtcNow
        });
    }

    [HttpGet("journals")]
    public async Task<IActionResult> GetJournalEntries([FromQuery] JournalEntryStatus? status = null)
    {
        var query = _dbContext.JournalEntries.AsQueryable();

        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);

        var entries = await query
            .OrderByDescending(x => x.EntryDate)
            .ThenByDescending(x => x.CreatedUtc)
            .Select(x => new
            {
                id = x.Id,
                entryNumber = x.EntryNumber,
                entryDate = x.EntryDate,
                description = x.Description,
                referenceNo = x.ReferenceNo,
                status = x.Status,
                createdBy = x.CreatedBy,
                createdUtc = x.CreatedUtc,
                postedBy = x.PostedBy,
                postedUtc = x.PostedUtc,
                lines = x.Lines
                    .OrderBy(line => line.Id)
                    .Select(line => new
                    {
                        id = line.Id,
                        accountId = line.AccountId,
                        description = line.Description,
                        debit = line.Debit,
                        credit = line.Credit
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(entries);
    }

    [HttpGet("trial-balance")]
    public async Task<IActionResult> GetTrialBalance([FromQuery] DateOnly? asOfDate = null)
    {
        var lineQuery = _dbContext.JournalEntryLines
            .Include(x => x.Account)
            .Include(x => x.JournalEntry)
            .Where(x => x.JournalEntry != null && x.JournalEntry.Status == JournalEntryStatus.Posted);

        if (asOfDate.HasValue)
            lineQuery = lineQuery.Where(x => x.JournalEntry!.EntryDate <= asOfDate.Value);

        var trialBalance = await lineQuery
            .GroupBy(x => new { x.AccountId, x.Account!.AccountCode, x.Account.Name })
            .Select(g => new
            {
                accountId = g.Key.AccountId,
                accountCode = g.Key.AccountCode,
                accountName = g.Key.Name,
                totalDebit = decimal.Round(g.Sum(x => x.Debit), 2),
                totalCredit = decimal.Round(g.Sum(x => x.Credit), 2),
                balance = decimal.Round(g.Sum(x => x.Debit - x.Credit), 2)
            })
            .OrderBy(x => x.accountCode)
            .ToListAsync();

        var totalDebit = decimal.Round(trialBalance.Sum(x => x.totalDebit), 2);
        var totalCredit = decimal.Round(trialBalance.Sum(x => x.totalCredit), 2);

        return Ok(new
        {
            asOfDate,
            totalDebit,
            totalCredit,
            isBalanced = totalDebit == totalCredit,
            items = trialBalance
        });
    }

    [HttpGet("journals/{id:guid}")]
    public async Task<IActionResult> GetJournalEntry(Guid id)
    {
        var entry = await _dbContext.JournalEntries
            .Where(x => x.Id == id)
            .Select(x => new
            {
                id = x.Id,
                entryNumber = x.EntryNumber,
                entryDate = x.EntryDate,
                description = x.Description,
                referenceNo = x.ReferenceNo,
                status = x.Status,
                createdBy = x.CreatedBy,
                createdUtc = x.CreatedUtc,
                postedBy = x.PostedBy,
                postedUtc = x.PostedUtc,
                lines = x.Lines
                    .OrderBy(line => line.Id)
                    .Select(line => new
                    {
                        id = line.Id,
                        accountId = line.AccountId,
                        accountCode = line.Account != null ? line.Account.AccountCode : null,
                        accountName = line.Account != null ? line.Account.Name : null,
                        description = line.Description,
                        debit = line.Debit,
                        credit = line.Credit
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (entry is null)
            return NotFound(new { message = "Journal entry not found." });

        return Ok(entry);
    }

    [HttpPost("journals")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> CreateJournalEntry([FromBody] CreateJournalEntryRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lineValidationMessage = ValidateLines(request.Lines);
        if (lineValidationMessage is not null)
            return BadRequest(new { message = lineValidationMessage });

        var accountIds = request.Lines.Select(x => x.AccountId).Distinct().ToList();
        var validCount = await _dbContext.ChartOfAccounts.CountAsync(x => x.IsActive && accountIds.Contains(x.Id));
        if (validCount != accountIds.Count)
            return BadRequest(new { message = "One or more line accounts are invalid or inactive." });

        var isWithinOpenPeriod = await _dbContext.FiscalPeriods.AnyAsync(x =>
            !x.IsClosed && request.EntryDate >= x.StartDate && request.EntryDate <= x.EndDate);
        if (!isWithinOpenPeriod)
            return BadRequest(new { message = "Entry date must fall within an open fiscal period." });

        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            EntryNumber = await GenerateEntryNumberAsync(request.EntryDate),
            EntryDate = request.EntryDate,
            Description = request.Description.Trim(),
            ReferenceNo = string.IsNullOrWhiteSpace(request.ReferenceNo) ? null : request.ReferenceNo.Trim(),
            Status = JournalEntryStatus.Draft,
            CreatedBy = GetCurrentUser(),
            CreatedUtc = DateTime.UtcNow,
            Lines = request.Lines.Select(line => new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                AccountId = line.AccountId,
                Description = line.Description,
                Debit = decimal.Round(line.Debit, 2),
                Credit = decimal.Round(line.Credit, 2)
            }).ToList()
        };

        _dbContext.JournalEntries.Add(entry);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetJournalEntry), new { id = entry.Id }, entry);
    }

    [HttpPut("journals/{id:guid}")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> UpdateJournalEntry(Guid id, [FromBody] CreateJournalEntryRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var entry = await _dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (entry is null)
            return NotFound(new { message = "Journal entry not found." });

        if (entry.Status == JournalEntryStatus.Posted)
            return BadRequest(new { message = "Posted journal entries cannot be edited." });

        var lineValidationMessage = ValidateLines(request.Lines);
        if (lineValidationMessage is not null)
            return BadRequest(new { message = lineValidationMessage });

        var accountIds = request.Lines.Select(x => x.AccountId).Distinct().ToList();
        var validCount = await _dbContext.ChartOfAccounts.CountAsync(x => x.IsActive && accountIds.Contains(x.Id));
        if (validCount != accountIds.Count)
            return BadRequest(new { message = "One or more line accounts are invalid or inactive." });

        var isWithinOpenPeriod = await _dbContext.FiscalPeriods.AnyAsync(x =>
            !x.IsClosed && request.EntryDate >= x.StartDate && request.EntryDate <= x.EndDate);
        if (!isWithinOpenPeriod)
            return BadRequest(new { message = "Entry date must fall within an open fiscal period." });

        entry.EntryDate = request.EntryDate;
        entry.Description = request.Description.Trim();
        entry.ReferenceNo = string.IsNullOrWhiteSpace(request.ReferenceNo) ? null : request.ReferenceNo.Trim();

        _dbContext.JournalEntryLines.RemoveRange(entry.Lines);
        entry.Lines = request.Lines.Select(line => new JournalEntryLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = entry.Id,
            AccountId = line.AccountId,
            Description = line.Description,
            Debit = decimal.Round(line.Debit, 2),
            Credit = decimal.Round(line.Credit, 2)
        }).ToList();

        await _dbContext.SaveChangesAsync();
        return Ok(entry);
    }

    [HttpPost("journals/{id:guid}/post")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> PostJournal(Guid id)
    {
        var entry = await _dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (entry is null)
            return NotFound(new { message = "Journal entry not found." });

        if (entry.Status == JournalEntryStatus.Posted)
            return BadRequest(new { message = "Journal entry is already posted." });

        var lineValidationMessage = ValidateLines(entry.Lines.Select(x => new JournalLineRequest
        {
            AccountId = x.AccountId,
            Description = x.Description,
            Debit = x.Debit,
            Credit = x.Credit
        }).ToList());

        if (lineValidationMessage is not null)
            return BadRequest(new { message = lineValidationMessage });

        var isWithinOpenPeriod = await _dbContext.FiscalPeriods.AnyAsync(x =>
            !x.IsClosed && entry.EntryDate >= x.StartDate && entry.EntryDate <= x.EndDate);
        if (!isWithinOpenPeriod)
            return BadRequest(new { message = "Entry date must fall within an open fiscal period." });

        entry.Status = JournalEntryStatus.Posted;
        entry.PostedBy = GetCurrentUser();
        entry.PostedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(entry);
    }

    [HttpGet("journals/export")]
    public async Task<IActionResult> ExportJournalEntries(
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null,
        [FromQuery] JournalEntryStatus? status = null,
        [FromQuery] string format = "excel")
    {
        var query = _dbContext.JournalEntries
            .Include(x => x.Lines)
            .ThenInclude(x => x.Account)
            .AsQueryable();

        if (fromDate.HasValue)
            query = query.Where(x => x.EntryDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(x => x.EntryDate <= toDate.Value);

        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);

        var entries = await query
            .OrderBy(x => x.EntryDate)
            .ThenBy(x => x.EntryNumber)
            .ToListAsync();

        var normalizedFormat = format.Trim().ToLowerInvariant();
        if (normalizedFormat is not ("excel" or "csv"))
            return BadRequest(new { message = "Invalid export format. Use 'excel' or 'csv'." });

        if (normalizedFormat == "csv")
        {
            var lines = new List<string>
            {
                "Entry Number,Entry Date,Status,Reference No,Description,Line Description,Account Code,Account Name,Debit,Credit"
            };

            foreach (var entry in entries)
            {
                foreach (var line in entry.Lines.OrderBy(x => x.Id))
                {
                    lines.Add(string.Join(",",
                        EscapeCsv(entry.EntryNumber),
                        EscapeCsv(entry.EntryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                        EscapeCsv(entry.Status.ToString()),
                        EscapeCsv(entry.ReferenceNo),
                        EscapeCsv(entry.Description),
                        EscapeCsv(line.Description),
                        EscapeCsv(line.Account?.AccountCode),
                        EscapeCsv(line.Account?.Name),
                        line.Debit.ToString("0.00", CultureInfo.InvariantCulture),
                        line.Credit.ToString("0.00", CultureInfo.InvariantCulture)));
                }
            }

            var csvBytes = System.Text.Encoding.UTF8.GetBytes(string.Join(Environment.NewLine, lines));
            var csvFileName = $"journal-entries-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
            return File(csvBytes, "text/csv", csvFileName);
        }

        using var package = new ExcelPackage();
        var worksheet = package.Workbook.Worksheets.Add("Journal Entries");

        worksheet.Cells[1, 1].Value = "Entry Number";
        worksheet.Cells[1, 2].Value = "Entry Date";
        worksheet.Cells[1, 3].Value = "Status";
        worksheet.Cells[1, 4].Value = "Reference No";
        worksheet.Cells[1, 5].Value = "Description";
        worksheet.Cells[1, 6].Value = "Line Description";
        worksheet.Cells[1, 7].Value = "Account Code";
        worksheet.Cells[1, 8].Value = "Account Name";
        worksheet.Cells[1, 9].Value = "Debit";
        worksheet.Cells[1, 10].Value = "Credit";

        using (var header = worksheet.Cells[1, 1, 1, 10])
        {
            header.Style.Font.Bold = true;
        }

        var row = 2;
        foreach (var entry in entries)
        {
            foreach (var line in entry.Lines.OrderBy(x => x.Id))
            {
                worksheet.Cells[row, 1].Value = entry.EntryNumber;
                worksheet.Cells[row, 2].Value = entry.EntryDate.ToDateTime(TimeOnly.MinValue);
                worksheet.Cells[row, 2].Style.Numberformat.Format = "yyyy-mm-dd";
                worksheet.Cells[row, 3].Value = entry.Status.ToString();
                worksheet.Cells[row, 4].Value = entry.ReferenceNo;
                worksheet.Cells[row, 5].Value = entry.Description;
                worksheet.Cells[row, 6].Value = line.Description;
                worksheet.Cells[row, 7].Value = line.Account?.AccountCode;
                worksheet.Cells[row, 8].Value = line.Account?.Name;
                worksheet.Cells[row, 9].Value = line.Debit;
                worksheet.Cells[row, 10].Value = line.Credit;

                worksheet.Cells[row, 9].Style.Numberformat.Format = "#,##0.00";
                worksheet.Cells[row, 10].Style.Numberformat.Format = "#,##0.00";
                row++;
            }
        }

        worksheet.Cells.AutoFitColumns();

        var content = await package.GetAsByteArrayAsync();
        var fileName = $"journal-entries-{DateTime.UtcNow:yyyyMMddHHmmss}.xlsx";
        return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    private static string? ValidateLines(IReadOnlyCollection<JournalLineRequest> lines)
    {
        if (lines.Count < 2)
            return "At least two journal lines are required.";

        foreach (var line in lines)
        {
            if (line.Debit < 0 || line.Credit < 0)
                return "Debit and credit amounts cannot be negative.";
            if (line.Debit > 0 && line.Credit > 0)
                return "A line cannot have both debit and credit values.";
            if (line.Debit == 0 && line.Credit == 0)
                return "A line must have either a debit or a credit value.";
        }

        var totalDebit = decimal.Round(lines.Sum(x => x.Debit), 2);
        var totalCredit = decimal.Round(lines.Sum(x => x.Credit), 2);

        if (totalDebit != totalCredit)
            return "Journal entry is not balanced. Total debit must equal total credit.";

        return null;
    }

    private async Task<string> GenerateEntryNumberAsync(DateOnly entryDate)
    {
        var prefix = $"JE-{entryDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture)}";
        var countForDay = await _dbContext.JournalEntries.CountAsync(x => x.EntryNumber.StartsWith(prefix));
        return $"{prefix}-{(countForDay + 1).ToString("D4", CultureInfo.InvariantCulture)}";
    }

    private string GetCurrentUser()
    {
        return User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("email")
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? "system";
    }
}
