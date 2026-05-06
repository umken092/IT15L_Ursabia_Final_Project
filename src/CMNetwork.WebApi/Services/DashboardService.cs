using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Services;

public class DashboardService : IDashboardService
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(CMNetworkDbContext dbContext, ILogger<DashboardService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<DashboardMetricsResponse> GetMetricsAsync(string role)
    {
        try
        {
            var normalizedRole = NormalizeRole(role);
            var now = DateTime.UtcNow;
            var monthStart = new DateTime(now.Year, now.Month, 1);

            var postedLines = await _dbContext.JournalEntryLines
                .Include(x => x.Account)
                .Include(x => x.JournalEntry)
                .Where(x => x.JournalEntry != null && x.JournalEntry.Status == JournalEntryStatus.Posted)
                .ToListAsync();

            var currentMonthPosted = postedLines
                .Where(x => x.JournalEntry!.EntryDate >= DateOnly.FromDateTime(monthStart));

            decimal currentRevenue = currentMonthPosted
                .Where(x => x.Account != null && x.Account.Type == AccountType.Revenue)
                .Sum(x => x.Credit - x.Debit);

            decimal currentExpenses = currentMonthPosted
                .Where(x => x.Account != null && x.Account.Type == AccountType.Expense)
                .Sum(x => x.Debit - x.Credit);

            decimal netIncome = currentRevenue - currentExpenses;

            var pendingAp = await _dbContext.APInvoices.CountAsync(x => !x.IsDeleted && x.Status != APInvoiceStatus.Paid && x.Status != APInvoiceStatus.Void);
            var pendingAr = await _dbContext.ARInvoices.CountAsync(x => !x.IsDeleted && x.Status != ARInvoiceStatus.Paid && x.Status != ARInvoiceStatus.Void);
            var submittedAp = await _dbContext.APInvoices.CountAsync(x => !x.IsDeleted && x.Status == APInvoiceStatus.Submitted);
            var draftAp = await _dbContext.APInvoices.CountAsync(x => !x.IsDeleted && x.Status == APInvoiceStatus.Draft);
            var voidedAp = await _dbContext.APInvoices.CountAsync(x => x.IsDeleted || x.Status == APInvoiceStatus.Void);
            var departmentBudgetTotal = await _dbContext.Departments.SumAsync(x => x.BudgetAmount);
            var openPeriods = await _dbContext.FiscalPeriods.CountAsync(x => !x.IsClosed);
            var totalPeriods = await _dbContext.FiscalPeriods.CountAsync();
            var draftJournals = await _dbContext.JournalEntries.CountAsync(x => x.Status == JournalEntryStatus.Draft);
            var activeUsers = await _dbContext.Users.CountAsync(x => x.IsActive);
            var auditCount7Days = await _dbContext.AuditLogs.CountAsync(x => x.CreatedUtc >= now.AddDays(-7));

            decimal cashPosition = postedLines
                .Where(x => x.Account != null && x.Account.Type == AccountType.Asset
                    && (x.Account.AccountCode.StartsWith("11") ||
                        x.Account.Name.Contains("Cash", StringComparison.OrdinalIgnoreCase)))
                .Sum(x => x.Debit - x.Credit);

            var metrics = normalizedRole switch
            {
                "super-admin" => new List<MetricDto>
                {
                    new() { Title = "Active Users", Value = activeUsers.ToString(), Subtitle = "Enabled user accounts", TrendDirection = "stable" },
                    new() { Title = "Open Fiscal Periods", Value = openPeriods.ToString(), Subtitle = $"{totalPeriods - openPeriods} closed periods", TrendDirection = "stable" },
                    new() { Title = "Recent Audit Events", Value = auditCount7Days.ToString(), Subtitle = "Last 7 days", TrendDirection = "up" },
                },
                "accountant" => new List<MetricDto>
                {
                    new() { Title = "Pending AP/AR Invoices", Value = (pendingAp + pendingAr).ToString(), Subtitle = $"AP: {pendingAp}, AR: {pendingAr}", TrendDirection = "up" },
                    new() { Title = "Draft Journal Entries", Value = draftJournals.ToString(), Subtitle = "Require posting review", TrendDirection = draftJournals > 0 ? "warning" : "stable" },
                    new() { Title = "Month-End Progress", Value = totalPeriods > 0 ? $"{Math.Round(((decimal)(totalPeriods - openPeriods) / totalPeriods) * 100)}%" : "0%", ProgressPercentage = totalPeriods > 0 ? (int)Math.Round(((decimal)(totalPeriods - openPeriods) / totalPeriods) * 100) : 0, Subtitle = "Based on closed fiscal periods" },
                },
                "faculty-admin" => new List<MetricDto>
                {
                    new() { Title = "Department Budget (Total)", Value = FormatCurrency(departmentBudgetTotal), Subtitle = "Configured departmental annual budgets", TrendDirection = "stable" },
                    new() { Title = "Submitted AP Invoices", Value = submittedAp.ToString(), Subtitle = "Pending accounting review", TrendDirection = "up" },
                },
                "employee" => new List<MetricDto>
                {
                    new() { Title = "Draft Expense Submissions", Value = draftAp.ToString(), Subtitle = "Draft invoices used as employee expense proxy", TrendDirection = "stable" },
                    new() { Title = "Submitted Expense Submissions", Value = submittedAp.ToString(), Subtitle = "Awaiting approval", TrendDirection = "up" },
                },
                "authorized-viewer" => new List<MetricDto>
                {
                    new() { Title = "Total Revenue (MTD)", Value = FormatCurrency(currentRevenue), Subtitle = "Posted revenue journals this month", TrendDirection = "up" },
                    new() { Title = "Total Expenses (MTD)", Value = FormatCurrency(currentExpenses), Subtitle = "Posted expense journals this month", TrendDirection = "down" },
                    new() { Title = "Net Income (MTD)", Value = FormatCurrency(netIncome), Subtitle = "Revenue - expenses", TrendDirection = netIncome >= 0 ? "up" : "down" },
                    new() { Title = "Cash Position", Value = FormatCurrency(cashPosition), Subtitle = "Total cash across all bank accounts", TrendDirection = "stable" },
                },
                "auditor" => new List<MetricDto>
                {
                    new() { Title = "Draft Journals", Value = draftJournals.ToString(), Subtitle = "Unposted entries to review", TrendDirection = draftJournals > 0 ? "up" : "stable" },
                    new() { Title = "Audit Log Events", Value = auditCount7Days.ToString(), Subtitle = "Captured in last 7 days", TrendDirection = "up" },
                    new() { Title = "Voided AP Invoices", Value = voidedAp.ToString(), Subtitle = "Requires audit traceability", TrendDirection = "stable" },
                },
                "cfo" => new List<MetricDto>
                {
                    new() { Title = "Total Revenue (MTD)", Value = FormatCurrency(currentRevenue), Subtitle = "Posted revenue journals this month", TrendDirection = "up" },
                    new() { Title = "Total Expenses (MTD)", Value = FormatCurrency(currentExpenses), Subtitle = "Posted expense journals this month", TrendDirection = "down" },
                    new() { Title = "Net Income (MTD)", Value = FormatCurrency(netIncome), Subtitle = "Revenue - expenses", TrendDirection = netIncome >= 0 ? "up" : "down" },
                },
                _ => new List<MetricDto>(),
            };

            return new DashboardMetricsResponse { Metrics = metrics };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboard metrics for role {Role}", role);
            return new DashboardMetricsResponse { Metrics = new List<MetricDto>() };
        }
    }

    public async Task<ChartDataResponse> GetChartDataAsync()
    {
        try
        {
            var year = 2026;
            var months = Enumerable.Range(1, 6).Select(m => new DateOnly(year, m, 1)).ToList();

            var postedLines = await _dbContext.JournalEntryLines
                .Include(x => x.Account)
                .Include(x => x.JournalEntry)
                .Where(x => x.JournalEntry != null && x.JournalEntry.Status == JournalEntryStatus.Posted)
                .Where(x => x.JournalEntry!.EntryDate.Year == year && x.JournalEntry.EntryDate.Month <= 6)
                .ToListAsync();

            var data = months.Select(month =>
            {
                var monthLines = postedLines
                    .Where(x => x.JournalEntry!.EntryDate.Month == month.Month)
                    .ToList();

                var revenue = monthLines
                    .Where(x => x.Account != null && x.Account.Type == AccountType.Revenue)
                    .Sum(x => x.Credit - x.Debit);

                var expenses = monthLines
                    .Where(x => x.Account != null && x.Account.Type == AccountType.Expense)
                    .Sum(x => x.Debit - x.Credit);

                return new ChartDataPoint
                {
                    Label = month.ToString("MMM"),
                    Series = new List<SeriesData>
                    {
                        new() { Name = "Revenue", Values = new List<double> { (double)revenue } },
                        new() { Name = "Expenses", Values = new List<double> { (double)expenses } },
                    }
                };
            }).ToList();

            return new ChartDataResponse
            {
                Data = data,
                Type = "column"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chart data");
            return new ChartDataResponse { Data = new List<ChartDataPoint>(), Type = "column" };
        }
    }

    public async Task<ApprovalsResponse> GetApprovalsAsync()
    {
        try
        {
            var pendingAp = await _dbContext.APInvoices
                .Include(x => x.Vendor)
                .Where(x => !x.IsDeleted && x.Status == APInvoiceStatus.Submitted)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(10)
                .Select(x => new ApprovalDto
                {
                    Id = x.InvoiceNumber,
                    Title = $"AP Invoice - {x.Vendor.Name}",
                    Description = $"Due {x.DueDate:yyyy-MM-dd}",
                    Status = "pending",
                    RequestedBy = x.CreatedByUserId,
                    RequestedDate = x.CreatedUtc,
                    Amount = (double)x.TotalAmount,
                })
                .ToListAsync();

            var pendingAr = await _dbContext.ARInvoices
                .Include(x => x.Customer)
                .Where(x => !x.IsDeleted && x.Status == ARInvoiceStatus.Draft)
                .OrderByDescending(x => x.CreatedUtc)
                .Take(10)
                .Select(x => new ApprovalDto
                {
                    Id = x.InvoiceNumber,
                    Title = $"AR Invoice - {x.Customer.Name}",
                    Description = $"Draft awaiting send", 
                    Status = "pending",
                    RequestedBy = x.CreatedByUserId,
                    RequestedDate = x.CreatedUtc,
                    Amount = (double)x.TotalAmount,
                })
                .ToListAsync();

            return new ApprovalsResponse
            {
                Approvals = pendingAp
                    .Concat(pendingAr)
                    .OrderByDescending(x => x.RequestedDate)
                    .Take(12)
                    .ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting approvals");
            return new ApprovalsResponse { Approvals = new List<ApprovalDto>() };
        }
    }

    public async Task<AuditActivityResponse> GetAuditActivitiesAsync()
    {
        try
        {
            // Exclude noisy/internal categories from the user-facing dashboard view.
            // ApiRequest entries are raw HTTP traces (e.g. "GET /api/dashboard/charts")
            // captured by middleware and are not meaningful to end users.
            var excludedCategories = new[] { "ApiRequest" };

            var rawActivities = await _dbContext.AuditLogs
                .Where(x => !excludedCategories.Contains(x.ActionCategory))
                .OrderByDescending(x => x.CreatedUtc)
                .Take(10)
                .Select(x => new
                {
                    x.Id,
                    x.Action,
                    x.PerformedBy,
                    x.UserEmail,
                    x.EntityName,
                    x.ActionCategory,
                    x.RecordId,
                    x.CreatedUtc,
                })
                .ToListAsync();

            // Resolve performer GUIDs to friendly display names (FirstName LastName, or email).
            var performerIds = rawActivities
                .Select(a => a.PerformedBy)
                .Where(s => Guid.TryParse(s, out _))
                .Select(Guid.Parse)
                .Distinct()
                .ToList();

            var userLookup = performerIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await _dbContext.Users
                    .Where(u => performerIds.Contains(u.Id))
                    .ToDictionaryAsync(
                        u => u.Id,
                        u => string.IsNullOrWhiteSpace(($"{u.FirstName} {u.LastName}").Trim())
                            ? (u.Email ?? u.UserName ?? u.Id.ToString())
                            : ($"{u.FirstName} {u.LastName}").Trim());

            string ResolveUser(string performedBy, string? email)
            {
                if (Guid.TryParse(performedBy, out var gid) && userLookup.TryGetValue(gid, out var name))
                    return name;
                if (!string.IsNullOrWhiteSpace(email))
                    return email!;
                return performedBy;
            }

            var activities = rawActivities
                .Select(x => new AuditActivityDto
                {
                    Id = x.Id.ToString(),
                    Action = x.Action,
                    User = ResolveUser(x.PerformedBy, x.UserEmail),
                    Entity = x.EntityName,
                    Status = "success",
                    Timestamp = x.CreatedUtc,
                })
                .ToList();

            if (activities.Count == 0)
            {
                // Fallback to journal entries as audit-like events if audit table is empty.
                activities = await _dbContext.JournalEntries
                    .OrderByDescending(x => x.CreatedUtc)
                    .Take(10)
                    .Select(x => new AuditActivityDto
                    {
                        Id = x.Id.ToString(),
                        Action = x.Status == JournalEntryStatus.Posted ? "Journal Posted" : "Journal Drafted",
                        User = x.CreatedBy,
                        Entity = x.EntryNumber,
                        Status = x.Status == JournalEntryStatus.Posted ? "success" : "warning",
                        Timestamp = x.CreatedUtc,
                    })
                    .ToListAsync();
            }

            return new AuditActivityResponse { Activities = activities };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audit activities");
            return new AuditActivityResponse { Activities = new List<AuditActivityDto>() };
        }
    }

    public async Task<BudgetControlResponse> GetBudgetControlAsync(int? year = null)
    {
        try
        {
            var targetYear = year ?? DateTime.UtcNow.Year;

            var totalAllocated = await _dbContext.Departments
                .SumAsync(d => (double)d.BudgetAmount);

            var priorYearLines = await _dbContext.JournalEntryLines
                .Include(x => x.Account)
                .Include(x => x.JournalEntry)
                .Where(x => x.JournalEntry != null
                    && x.JournalEntry.Status == JournalEntryStatus.Posted
                    && x.JournalEntry.EntryDate.Year == targetYear - 1
                    && x.Account != null
                    && x.Account.Type == AccountType.Expense)
                .SumAsync(x => (double)(x.Debit - x.Credit));

            var allocatedDeltaPercent = priorYearLines > 0
                ? Math.Round(((totalAllocated - priorYearLines) / priorYearLines) * 100.0, 1)
                : 0;

            var monthlyExpenseLines = await _dbContext.JournalEntryLines
                .Include(x => x.Account)
                .Include(x => x.JournalEntry)
                .Where(x => x.JournalEntry != null
                    && x.JournalEntry.Status == JournalEntryStatus.Posted
                    && x.JournalEntry.EntryDate.Year == targetYear
                    && x.Account != null
                    && x.Account.Type == AccountType.Expense)
                .ToListAsync();

            var monthlyProjected = totalAllocated / 12.0;

            var months = Enumerable.Range(1, 12)
                .Select(month =>
                {
                    var actual = monthlyExpenseLines
                        .Where(x => x.JournalEntry!.EntryDate.Month == month)
                        .Sum(x => (double)(x.Debit - x.Credit));

                    return new BudgetMonthPoint
                    {
                        Label = new DateTime(targetYear, month, 1).ToString("MMM"),
                        MonthNumber = month,
                        Actual = Math.Max(0, actual),
                        Projected = monthlyProjected,
                    };
                })
                .ToList();

            var totalActual = months.Sum(m => m.Actual);
            var totalProjected = months.Sum(m => m.Projected);
            var remainingForecast = Math.Max(0, totalAllocated - totalActual);

            // Variance / pending request counts derived from current pending invoice approvals
            // (acts as a proxy for budget reallocation requests against the queue model).
            var pendingApprovals = await _dbContext.APInvoices
                .Where(x => !x.IsDeleted && x.Status == APInvoiceStatus.Submitted)
                .Select(x => new { x.TotalAmount })
                .ToListAsync();

            var avgInvoice = pendingApprovals.Count > 0
                ? pendingApprovals.Average(x => (double)x.TotalAmount)
                : 0;
            var varianceRequestCount = pendingApprovals.Count(x => (double)x.TotalAmount > avgInvoice * 1.5);

            return new BudgetControlResponse
            {
                Year = targetYear,
                Currency = "USD",
                TotalAllocated = totalAllocated,
                TotalActual = totalActual,
                TotalProjected = totalProjected,
                RemainingForecast = remainingForecast,
                AllocatedDeltaPercent = allocatedDeltaPercent,
                VarianceRequestCount = varianceRequestCount,
                PendingRequestCount = pendingApprovals.Count,
                Months = months,
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting budget control data");
            return new BudgetControlResponse
            {
                Year = year ?? DateTime.UtcNow.Year,
                Months = new List<BudgetMonthPoint>(),
            };
        }
    }

    private static string NormalizeRole(string role)
    {
        var value = role.Trim().Replace("_", "-").ToLowerInvariant();
        return value switch
        {
            "superadmin" => "super-admin",
            "authorizedviewer" => "authorized-viewer",
            "facultyadmin" => "faculty-admin",
            _ => value,
        };
    }

    private static string FormatCurrency(decimal amount)
    {
        return $"PHP {amount:N2}";
    }
}
