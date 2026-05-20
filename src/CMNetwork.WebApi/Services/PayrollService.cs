using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CMNetwork.Services;

public class PayrollService : IPayrollService
{
    private const string PayrollRunNotFoundMessage = "Payroll run not found.";
    private readonly CMNetworkDbContext _db;

    public PayrollService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<PayPeriodDto> CreatePayPeriodAsync(CreatePayPeriodRequest request, string createdByUserId)
    {
        if (request.PayDate < request.CutoffDate)
        {
            throw new InvalidOperationException("Pay date must be on or after cutoff date.");
        }

        var exists = await _db.PayPeriods.AnyAsync(x =>
            !x.IsDeleted
            && x.Year == request.Year
            && x.Month == request.Month
            && x.Frequency == request.Frequency
            && x.Status != PayPeriodStatus.Closed);

        if (exists)
        {
            throw new InvalidOperationException("An open pay period already exists for this month and frequency.");
        }

        var payPeriod = new PayPeriod
        {
            Id = Guid.NewGuid(),
            Year = request.Year,
            Month = request.Month,
            Frequency = request.Frequency,
            CutoffDate = request.CutoffDate,
            PayDate = request.PayDate,
            Status = PayPeriodStatus.Open,
            CreatedByUserId = createdByUserId,
            CreatedUtc = DateTime.UtcNow,
        };

        _db.PayPeriods.Add(payPeriod);
        await _db.SaveChangesAsync();

        return MapPayPeriod(payPeriod);
    }

    public async Task<IReadOnlyList<PayPeriodDto>> GetPayPeriodsAsync()
    {
        return await _db.PayPeriods
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.Year)
            .ThenByDescending(x => x.Month)
            .ThenBy(x => x.Frequency)
            .Select(x => MapPayPeriod(x))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<PayrollRunDto>> GetPayrollRunsAsync(PayrollRunStatus? status = null, Guid? payPeriodId = null)
    {
        var query = _db.PayrollRuns
            .Include(x => x.PayPeriod)
            .Where(x => !x.IsDeleted)
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        if (payPeriodId.HasValue)
        {
            query = query.Where(x => x.PayPeriodId == payPeriodId.Value);
        }

        return await query
            .OrderByDescending(x => x.CreatedUtc)
            .Select(x => MapRun(x, x.PayPeriod))
            .ToListAsync();
    }

    public async Task<PayrollSetupDto> GetPayrollSetupAsync(Guid payPeriodId)
    {
        var payPeriod = await _db.PayPeriods.FirstOrDefaultAsync(x => x.Id == payPeriodId && !x.IsDeleted);
        if (payPeriod is null)
        {
            throw new KeyNotFoundException("Pay period not found.");
        }

        var employeeRoleId = await _db.Roles
            .Where(r => r.NormalizedName == "EMPLOYEE")
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        var employees = await (
            from user in _db.Users
            join userRole in _db.UserRoles on user.Id equals userRole.UserId
            join employeeProfile in _db.EmployeeProfiles on user.Id equals employeeProfile.UserId into employeeProfileGroup
            from employeeProfile in employeeProfileGroup.DefaultIfEmpty()
            where user.IsActive && userRole.RoleId == employeeRoleId
            orderby user.LastName, user.FirstName
            select new EmployeePayrollDto
            {
                Id = user.Id,
                Name = user.FullName,
                Department = user.DepartmentId.HasValue ? "Assigned" : "Unassigned",
                HourlyRate = employeeProfile != null ? (employeeProfile.HourlyRate ?? 0m) : 0m,
                OvertimeMultiplier = user.OvertimeMultiplier ?? 1.25m,
            })
            .ToListAsync();

        return new PayrollSetupDto
        {
            PayPeriodId = payPeriodId,
            Employees = employees,
        };
    }

    public async Task<PayrollRunDto> CalculatePayrollAsync(Guid payPeriodId, CalculatePayrollRequest request, string createdByUserId)
    {
        if (request.LineItems.Count == 0)
        {
            throw new InvalidOperationException("At least one payroll line item is required.");
        }

        var payPeriod = await _db.PayPeriods.FirstOrDefaultAsync(x => x.Id == payPeriodId && !x.IsDeleted);
        if (payPeriod is null)
        {
            throw new KeyNotFoundException("Pay period not found.");
        }

        if (payPeriod.Status == PayPeriodStatus.Closed)
        {
            throw new InvalidOperationException("Pay period is already closed.");
        }

        var run = await _db.PayrollRuns
            .Include(x => x.LineItems)
            .FirstOrDefaultAsync(x => x.PayPeriodId == payPeriodId && !x.IsDeleted);

        if (run is not null && run.Status is PayrollRunStatus.Submitted or PayrollRunStatus.Approved or PayrollRunStatus.Posted)
        {
            throw new InvalidOperationException($"Cannot recalculate payroll while run is {run.Status}.");
        }

        if (run is null)
        {
            run = new PayrollRun
            {
                Id = Guid.NewGuid(),
                PayPeriodId = payPeriodId,
                Status = PayrollRunStatus.Draft,
                CreatedByUserId = createdByUserId,
                CreatedUtc = DateTime.UtcNow,
            };

            _db.PayrollRuns.Add(run);
        }
        else
        {
            run.LineItems.Clear();
            run.LastModifiedByUserId = createdByUserId;
            run.LastModifiedUtc = DateTime.UtcNow;
            run.Status = PayrollRunStatus.Draft;
            run.RejectionReason = null;
            run.ApprovedAtUtc = null;
            run.ApprovedByUserId = null;
            run.SubmittedAtUtc = null;
            run.SubmittedByUserId = null;
        }

        var employeeIds = request.LineItems.Select(x => x.EmployeeId).Distinct().ToList();
        var users = await _db.Users
            .Where(x => employeeIds.Contains(x.Id) && x.IsActive)
            .ToDictionaryAsync(x => x.Id);

        var employeeProfiles = await _db.EmployeeProfiles
            .Where(x => employeeIds.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId);

        foreach (var item in request.LineItems)
        {
            if (!users.TryGetValue(item.EmployeeId, out var employee))
            {
                throw new InvalidOperationException($"Employee {item.EmployeeId} is not active or does not exist.");
            }

            var hasEmployeeProfile = employeeProfiles.TryGetValue(employee.Id, out var employeeProfile);
            var regularRate = hasEmployeeProfile ? (employeeProfile!.HourlyRate ?? 0m) : 0m;
            if (regularRate <= 0)
            {
                throw new InvalidOperationException($"Employee {employee.FullName} has no valid hourly rate.");
            }

            var overtimeMultiplier = employee.OvertimeMultiplier ?? 1.25m;
            var overtimeRate = regularRate * overtimeMultiplier;

            var regularPay = item.RegularHours * regularRate;
            var overtimePay = item.OvertimeHours * overtimeRate;
            var absenceDeduction = item.AbsenceHours * regularRate;
            var grossPay = Math.Max(0m, regularPay + overtimePay - absenceDeduction);

            var trainTax = await CalculateTrainTaxAsync(grossPay, payPeriod.Year);
            var sssFee = await CalculateContributionAsync(grossPay, payPeriod.Year, TaxTableType.Sss);
            var philHealthFee = await CalculateContributionAsync(grossPay, payPeriod.Year, TaxTableType.PhilHealth);
            var pagIbigFee = await CalculateContributionAsync(grossPay, payPeriod.Year, TaxTableType.PagIbig, isFixed: true);
            var totalDeductions = trainTax + sssFee + philHealthFee + pagIbigFee + item.OtherDeductions;
            var netPay = grossPay - totalDeductions;

            run.LineItems.Add(new PayrollLineItem
            {
                Id = Guid.NewGuid(),
                PayrollRunId = run.Id,
                EmployeeId = employee.Id,
                EmployeeName = employee.FullName,
                Department = employee.DepartmentId.HasValue ? "Assigned" : "Unassigned",
                RegularHours = item.RegularHours,
                OvertimeHours = item.OvertimeHours,
                AbsenceHours = item.AbsenceHours,
                RegularRate = regularRate,
                OvertimeRate = overtimeRate,
                GrossPay = decimal.Round(grossPay, 2),
                TrainTax = decimal.Round(trainTax, 2),
                SssFee = decimal.Round(sssFee, 2),
                PhilHealthFee = decimal.Round(philHealthFee, 2),
                PagIbigFee = decimal.Round(pagIbigFee, 2),
                OtherDeductions = decimal.Round(item.OtherDeductions, 2),
                TotalDeductions = decimal.Round(totalDeductions, 2),
                NetPay = decimal.Round(netPay, 2),
                ManualAdjustmentNote = item.ManualAdjustmentNote,
                IsExceptionFlag = netPay < 0 || item.RegularHours > 200 || item.OvertimeHours > 100,
                CreatedUtc = DateTime.UtcNow,
            });
        }

        run.TotalGrossPay = run.LineItems.Sum(x => x.GrossPay);
        run.TotalDeductions = run.LineItems.Sum(x => x.TotalDeductions);
        run.TotalNetPay = run.LineItems.Sum(x => x.NetPay);

        await _db.SaveChangesAsync();
        return MapRun(run, payPeriod);
    }

    public async Task<PayrollRunDto> SubmitPayrollAsync(Guid payrollRunId, string submittedByUserId)
    {
        var run = await _db.PayrollRuns
            .Include(x => x.LineItems)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException(PayrollRunNotFoundMessage);
        }

        if (run.Status != PayrollRunStatus.Draft && run.Status != PayrollRunStatus.Rejected)
        {
            throw new InvalidOperationException($"Payroll run cannot be submitted while {run.Status}.");
        }

        if (run.LineItems.Count == 0)
        {
            throw new InvalidOperationException("Payroll run has no line items.");
        }

        run.Status = PayrollRunStatus.Submitted;
        run.SubmittedAtUtc = DateTime.UtcNow;
        run.SubmittedByUserId = submittedByUserId;
        run.LastModifiedByUserId = submittedByUserId;
        run.LastModifiedUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapRun(run, run.PayPeriod);
    }

    public async Task<PayrollRunDto> WithdrawPayrollAsync(Guid payrollRunId, string requestedByUserId, bool isSuperAdmin, string? withdrawalReason)
    {
        var run = await _db.PayrollRuns
            .Include(x => x.PayPeriod)
            .Include(x => x.Payslips)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException(PayrollRunNotFoundMessage);
        }

        if (run.Status != PayrollRunStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted payroll runs can be withdrawn.");
        }

        if (!isSuperAdmin && !string.Equals(run.SubmittedByUserId, requestedByUserId, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Only the submitting accountant can withdraw this payroll run.");
        }

        run.Status = PayrollRunStatus.Draft;
        run.RejectionReason = string.IsNullOrWhiteSpace(withdrawalReason)
            ? "Withdrawn by accountant for correction."
            : $"Withdrawn for correction: {withdrawalReason.Trim()}";
        run.SubmittedAtUtc = null;
        run.SubmittedByUserId = null;
        run.LastModifiedByUserId = requestedByUserId;
        run.LastModifiedUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapRun(run, run.PayPeriod);
    }

    public async Task<PayrollRegisterDto> GetPayrollRegisterAsync(Guid payrollRunId)
    {
        var run = await _db.PayrollRuns
            .Include(x => x.PayPeriod)
            .Include(x => x.LineItems)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException(PayrollRunNotFoundMessage);
        }

        var lineItems = run.LineItems
            .Where(x => !x.IsDeleted)
            .Select(x => new PayrollLineRegisterDto
            {
                EmployeeId = x.EmployeeId,
                EmployeeName = x.EmployeeName,
                GrossPay = x.GrossPay,
                TrainTax = x.TrainTax,
                SssFee = x.SssFee,
                PhilHealthFee = x.PhilHealthFee,
                PagIbigFee = x.PagIbigFee,
                OtherDeductions = x.OtherDeductions,
                TotalDeductions = x.TotalDeductions,
                NetPay = x.NetPay,
            })
            .OrderBy(x => x.EmployeeName)
            .ToList();

        return new PayrollRegisterDto
        {
            PayrollRunId = run.Id,
            PayPeriod = new DateOnly(run.PayPeriod.Year, run.PayPeriod.Month, 1).ToString("MMMM yyyy"),
            Status = run.Status,
            LineItems = lineItems,
            Totals = new PayrollTotalsDto
            {
                TotalGrossPay = lineItems.Sum(x => x.GrossPay),
                TotalTrainTax = lineItems.Sum(x => x.TrainTax),
                TotalSssFee = lineItems.Sum(x => x.SssFee),
                TotalPhilHealthFee = lineItems.Sum(x => x.PhilHealthFee),
                TotalPagIbigFee = lineItems.Sum(x => x.PagIbigFee),
                TotalOtherDeductions = lineItems.Sum(x => x.OtherDeductions),
                TotalDeductions = lineItems.Sum(x => x.TotalDeductions),
                TotalNetPay = lineItems.Sum(x => x.NetPay),
            },
        };
    }

    public async Task<PayrollRunDto> ApprovePayrollAsync(Guid payrollRunId, ApprovePayrollRequest request, string approvedByUserId)
    {
        var run = await _db.PayrollRuns
            .Include(x => x.PayPeriod)
            .Include(x => x.LineItems)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException(PayrollRunNotFoundMessage);
        }

        if (run.Status != PayrollRunStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted payroll runs can be approved.");
        }

        run.Status = PayrollRunStatus.Approved;
        run.ApprovedAtUtc = DateTime.UtcNow;
        run.ApprovedByUserId = approvedByUserId;
        run.LastModifiedByUserId = approvedByUserId;
        run.LastModifiedUtc = DateTime.UtcNow;

        await GeneratePayslipsAsync(run, approvedByUserId);
        await _db.SaveChangesAsync();

        return MapRun(run, run.PayPeriod);
    }

    public async Task<PayrollRunDto> RejectPayrollAsync(Guid payrollRunId, RejectPayrollRequest request, string rejectedByUserId)
    {
        var run = await _db.PayrollRuns
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException(PayrollRunNotFoundMessage);
        }

        if (run.Status != PayrollRunStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted payroll runs can be rejected.");
        }

        run.Status = PayrollRunStatus.Rejected;
        run.RejectionReason = request.RejectionReason;
        run.LastModifiedByUserId = rejectedByUserId;
        run.LastModifiedUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapRun(run, run.PayPeriod);
    }

    public async Task<PayrollRunDto> ReopenPayrollAsync(Guid payrollRunId, ReopenPayrollRequest request, string requestedByUserId, bool isSuperAdmin, bool isCfo)
    {
        var run = await _db.PayrollRuns
            .Include(x => x.PayPeriod)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException(PayrollRunNotFoundMessage);
        }

        if (run.Status is not PayrollRunStatus.Approved and not PayrollRunStatus.Processed)
        {
            throw new InvalidOperationException("Only approved or processed payroll runs can be reopened.");
        }

        if (!isSuperAdmin)
        {
            if (!isCfo)
            {
                throw new InvalidOperationException("You are not allowed to reopen this payroll run.");
            }

            if (!run.ApprovedAtUtc.HasValue)
            {
                throw new InvalidOperationException("Payroll run cannot be reopened because approval timestamp is missing.");
            }

            var reopenWindow = TimeSpan.FromHours(24);
            if (DateTime.UtcNow - run.ApprovedAtUtc.Value > reopenWindow)
            {
                throw new InvalidOperationException("CFO reopen window has elapsed (24 hours after approval).");
            }
        }

        if (run.Status == PayrollRunStatus.Posted || run.JournalEntryId.HasValue)
        {
            throw new InvalidOperationException("Payroll run cannot be reopened after posting/payment.");
        }

        if (run.Payslips.Count > 0)
        {
            _db.Payslips.RemoveRange(run.Payslips);
        }

        run.Status = PayrollRunStatus.Draft;
        run.RejectionReason = $"Re-opened for correction: {request.ReopenReason.Trim()}";
        run.ApprovedAtUtc = null;
        run.ApprovedByUserId = null;
        run.SubmittedAtUtc = null;
        run.SubmittedByUserId = null;
        run.LastModifiedByUserId = requestedByUserId;
        run.LastModifiedUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapRun(run, run.PayPeriod);
    }

    public async Task<PayrollRunDto> PostToGeneralLedgerAsync(Guid payrollRunId, string postedByUserId)
    {
        var run = await _db.PayrollRuns
            .Include(x => x.PayPeriod)
            .Include(x => x.LineItems)
            .FirstOrDefaultAsync(x => x.Id == payrollRunId && !x.IsDeleted);

        if (run is null)
        {
            throw new KeyNotFoundException("Payroll run not found.");
        }

        if (run.Status != PayrollRunStatus.Approved && run.Status != PayrollRunStatus.Processed)
        {
            throw new InvalidOperationException("Payroll run must be approved before posting to GL.");
        }

        if (run.JournalEntryId.HasValue)
        {
            throw new InvalidOperationException("Payroll run is already posted to GL.");
        }

        var salaryExpense = await _db.ChartOfAccounts
            .Where(x => x.IsActive && x.Type == AccountType.Expense)
            .OrderBy(x => x.AccountCode)
            .FirstOrDefaultAsync();

        var cashAccount = await _db.ChartOfAccounts
            .Where(x => x.IsActive && x.Type == AccountType.Asset && (x.Name.Contains("Cash") || x.AccountCode.StartsWith("11")))
            .OrderBy(x => x.AccountCode)
            .FirstOrDefaultAsync();

        var liabilityAccount = await _db.ChartOfAccounts
            .Where(x => x.IsActive && x.Type == AccountType.Liability)
            .OrderBy(x => x.AccountCode)
            .FirstOrDefaultAsync();

        if (salaryExpense is null || cashAccount is null || liabilityAccount is null)
        {
            throw new InvalidOperationException("Required chart of accounts for payroll posting is not configured.");
        }

        var journal = new JournalEntry
        {
            Id = Guid.NewGuid(),
            EntryNumber = await GenerateJournalNumberAsync(),
            EntryDate = run.PayPeriod.PayDate,
            Description = $"Payroll for {run.PayPeriod.Month:D2}/{run.PayPeriod.Year}",
            ReferenceNo = run.Id.ToString(),
            Status = JournalEntryStatus.Posted,
            CreatedBy = postedByUserId,
            CreatedUtc = DateTime.UtcNow,
            PostedBy = postedByUserId,
            PostedUtc = DateTime.UtcNow,
            Lines = new List<JournalEntryLine>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    AccountId = salaryExpense.Id,
                    Description = "Payroll gross pay",
                    Debit = run.TotalGrossPay,
                    Credit = 0m,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    AccountId = cashAccount.Id,
                    Description = "Payroll net pay",
                    Debit = 0m,
                    Credit = run.TotalNetPay,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    AccountId = liabilityAccount.Id,
                    Description = "Payroll deductions payable",
                    Debit = 0m,
                    Credit = run.TotalDeductions,
                }
            }
        };

        _db.JournalEntries.Add(journal);

        run.JournalEntryId = journal.Id;
        run.Status = PayrollRunStatus.Posted;
        run.LastModifiedByUserId = postedByUserId;
        run.LastModifiedUtc = DateTime.UtcNow;

        var payPeriod = run.PayPeriod;
        payPeriod.Status = PayPeriodStatus.Closed;
        payPeriod.LastModifiedByUserId = postedByUserId;
        payPeriod.LastModifiedUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return MapRun(run);
    }

    public async Task<byte[]> GetPayslipPdfAsync(Guid payslipId, string requestingUserId, bool canViewAny)
    {
        var payslip = await _db.Payslips.FirstOrDefaultAsync(x => x.Id == payslipId);
        if (payslip is null)
        {
            throw new KeyNotFoundException("Payslip not found.");
        }

        if (!canViewAny && payslip.EmployeeId.ToString() != requestingUserId)
        {
            throw new UnauthorizedAccessException("You are not allowed to view this payslip.");
        }

        return GeneratePayslipPdf(payslip);
    }

    public async Task<IReadOnlyList<PayslipSummaryDto>> GetMyPayslipsAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var employeeId))
        {
            return Array.Empty<PayslipSummaryDto>();
        }

        return await _db.Payslips
            .Where(x => x.EmployeeId == employeeId)
            .OrderByDescending(x => x.PeriodStart)
            .Select(x => new PayslipSummaryDto
            {
                Id = x.Id,
                PayslipNumber = x.PayslipNumber,
                PayPeriod = $"{x.PeriodStart:MMM dd, yyyy} - {x.PeriodEnd:MMM dd, yyyy}",
                PeriodStart = x.PeriodStart,
                PeriodEnd = x.PeriodEnd,
                GrossPay = x.GrossPay,
                NetPay = x.NetPay,
                GeneratedAtUtc = x.GeneratedAtUtc,
            })
            .ToListAsync();
    }

    public async Task<TaxTableDto> CreateTaxTableAsync(CreateTaxTableRequest request)
    {
        if (request.MaxIncome.HasValue && request.MaxIncome < request.MinIncome)
        {
            throw new InvalidOperationException("Max income must be greater than or equal to min income.");
        }

        var taxTable = new TaxTable
        {
            Id = Guid.NewGuid(),
            Type = request.Type,
            Year = request.Year,
            MinIncome = request.MinIncome,
            MaxIncome = request.MaxIncome,
            Rate = request.Rate,
            Description = request.Description.Trim(),
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            CreatedUtc = DateTime.UtcNow,
        };

        _db.TaxTables.Add(taxTable);
        await _db.SaveChangesAsync();

        return MapTaxTable(taxTable);
    }

    public async Task<IReadOnlyList<TaxTableDto>> GetTaxTablesAsync(int? year = null, TaxTableType? type = null)
    {
        var query = _db.TaxTables.Where(x => !x.IsDeleted).AsQueryable();

        if (year.HasValue)
        {
            query = query.Where(x => x.Year == year.Value);
        }

        if (type.HasValue)
        {
            query = query.Where(x => x.Type == type.Value);
        }

        return await query
            .OrderBy(x => x.Type)
            .ThenBy(x => x.Year)
            .ThenBy(x => x.MinIncome)
            .Select(x => MapTaxTable(x))
            .ToListAsync();
    }

    public async Task DeleteTaxTableAsync(Guid id)
    {
        var entry = await _db.TaxTables.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted)
            ?? throw new InvalidOperationException("Tax table entry not found.");
        entry.IsDeleted = true;
        await _db.SaveChangesAsync();
    }

    public async Task<TaxTableDto> UpdateTaxTableAsync(Guid id, CreateTaxTableRequest request)
    {
        var entry = await _db.TaxTables.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted)
            ?? throw new InvalidOperationException("Tax table entry not found.");

        if (request.MaxIncome.HasValue && request.MaxIncome < request.MinIncome)
            throw new InvalidOperationException("Max income must be greater than or equal to min income.");

        entry.Type = request.Type;
        entry.Year = request.Year;
        entry.MinIncome = request.MinIncome;
        entry.MaxIncome = request.MaxIncome;
        entry.Rate = request.Rate;
        entry.Description = request.Description.Trim();
        entry.EffectiveFrom = request.EffectiveFrom;
        entry.EffectiveTo = request.EffectiveTo;

        await _db.SaveChangesAsync();
        return MapTaxTable(entry);
    }

    public Task<PayrollIntegrationCapabilitiesDto> GetIntegrationCapabilitiesAsync()
    {
        return Task.FromResult(new PayrollIntegrationCapabilitiesDto
        {
            CurrencyMode = "PHP_ONLY",
            SupportsDisplayOnlyCurrencyConversion = false,
            SupportsForeignCurrencyPayrollProcessing = false,
            SupportsBankFileExport = false,
            SupportsBirExport = false,
            SupportsGovContributionExport = false,
            Notes = "MVP is PHP-only payroll. Integration endpoints are reserved for future phases.",
        });
    }

    private async Task GeneratePayslipsAsync(PayrollRun run, string generatedBy)
    {
        var periodStart = new DateOnly(run.PayPeriod.Year, run.PayPeriod.Month, 1);
        var periodEnd = new DateOnly(run.PayPeriod.Year, run.PayPeriod.Month,
            DateTime.DaysInMonth(run.PayPeriod.Year, run.PayPeriod.Month));

        foreach (var line in run.LineItems.Where(x => !x.IsDeleted))
        {
            var exists = await _db.Payslips.AnyAsync(x =>
                x.PayrollRunId == run.Id
                && x.EmployeeId == line.EmployeeId);

            if (exists)
            {
                continue;
            }

            _db.Payslips.Add(new Payslip
            {
                Id = Guid.NewGuid(),
                PayrollRunId = run.Id,
                PayslipNumber = GeneratePayslipNumber(line.Id, periodStart),
                EmployeeId = line.EmployeeId,
                EmployeeName = line.EmployeeName,
                PeriodStart = periodStart,
                PeriodEnd = periodEnd,
                GrossPay = line.GrossPay,
                TaxDeduction = line.TrainTax,
                SssDeduction = line.SssFee,
                PhilHealthDeduction = line.PhilHealthFee,
                PagIbigDeduction = line.PagIbigFee,
                OtherDeductions = line.OtherDeductions,
                NetPay = line.NetPay,
                GeneratedBy = generatedBy,
                GeneratedAtUtc = DateTime.UtcNow,
            });

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == line.EmployeeId);
            if (user is not null)
            {
                user.LastPayrollProcessed = DateTime.UtcNow;
            }
        }
    }

    private static string GeneratePayslipNumber(Guid payrollLineItemId, DateOnly periodStart) =>
        $"PS-{periodStart:yyyyMM}-{payrollLineItemId:N}"[..32];

    private async Task<string> GenerateJournalNumberAsync()
    {
        var count = await _db.JournalEntries.CountAsync();
        return $"JE-{DateTime.UtcNow:yyyyMM}-{count + 1:D4}";
    }

    private async Task<decimal> CalculateTrainTaxAsync(decimal grossPay, int year)
    {
        var configured = await ResolveTaxTableAsync(grossPay, year, TaxTableType.Train);
        return grossPay * configured.Rate;
    }

    private async Task<decimal> CalculateContributionAsync(decimal grossPay, int year, TaxTableType type, bool isFixed = false)
    {
        var configured = await ResolveTaxTableAsync(grossPay, year, type);
        return isFixed ? configured.Rate : grossPay * configured.Rate;
    }

    private async Task<TaxTable> ResolveTaxTableAsync(decimal grossPay, int year, TaxTableType type)
    {
        var configured = await _db.TaxTables
            .Where(x => !x.IsDeleted
                && x.Type == type
                && x.Year == year
                && x.MinIncome <= grossPay
                && (!x.MaxIncome.HasValue || x.MaxIncome.Value >= grossPay))
            .OrderByDescending(x => x.MinIncome)
            .FirstOrDefaultAsync();

        if (configured is null)
        {
            throw new InvalidOperationException($"No active {type} tax table found for payroll year {year} and gross pay {grossPay:N2}.");
        }

        return configured;
    }

    private static PayPeriodDto MapPayPeriod(PayPeriod payPeriod)
    {
        return new PayPeriodDto
        {
            Id = payPeriod.Id,
            Year = payPeriod.Year,
            Month = payPeriod.Month,
            Frequency = payPeriod.Frequency,
            CutoffDate = payPeriod.CutoffDate,
            PayDate = payPeriod.PayDate,
            Status = payPeriod.Status,
            CreatedUtc = payPeriod.CreatedUtc,
        };
    }

    private static PayrollRunDto MapRun(PayrollRun run, PayPeriod? payPeriod = null)
    {
        var resolvedPayPeriod = payPeriod ?? run.PayPeriod;
        var payPeriodLabel = resolvedPayPeriod is null
            ? string.Empty
            : $"{resolvedPayPeriod.Year}-{resolvedPayPeriod.Month:D2}";

        return new PayrollRunDto
        {
            Id = run.Id,
            PayPeriodId = run.PayPeriodId,
            PayPeriodLabel = payPeriodLabel,
            Status = run.Status,
            TotalGrossPay = run.TotalGrossPay,
            TotalNetPay = run.TotalNetPay,
            TotalDeductions = run.TotalDeductions,
            SubmittedAtUtc = run.SubmittedAtUtc,
            ApprovedAtUtc = run.ApprovedAtUtc,
        };
    }

    private static TaxTableDto MapTaxTable(TaxTable taxTable)
    {
        return new TaxTableDto
        {
            Id = taxTable.Id,
            Type = taxTable.Type,
            Year = taxTable.Year,
            MinIncome = taxTable.MinIncome,
            MaxIncome = taxTable.MaxIncome,
            Rate = taxTable.Rate,
            Description = taxTable.Description,
            EffectiveFrom = taxTable.EffectiveFrom,
            EffectiveTo = taxTable.EffectiveTo,
        };
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
                            col.Item().Text("Payroll Payslip").FontSize(12).FontColor(Colors.Grey.Medium);
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
                        row.ConstantItem(120).AlignRight().Text($"PHP {payslip.GrossPay:N2}").Bold();
                    });

                    col.Item().PaddingTop(15).Text("Deductions").Bold().FontSize(12);
                    col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    AddDeductionRow(col, "Withholding Tax", payslip.TaxDeduction);
                    AddDeductionRow(col, "SSS", payslip.SssDeduction);
                    AddDeductionRow(col, "PhilHealth", payslip.PhilHealthDeduction);
                    AddDeductionRow(col, "Pag-IBIG", payslip.PagIbigDeduction);
                    if (payslip.OtherDeductions > 0)
                    {
                        AddDeductionRow(col, "Other Deductions", payslip.OtherDeductions);
                    }

                    col.Item().PaddingTop(15).LineHorizontal(2).LineColor(Colors.Black);
                    col.Item().PaddingTop(8).Row(row =>
                    {
                        row.RelativeItem().Text("Net Pay").Bold().FontSize(13);
                        row.ConstantItem(120).AlignRight().Text($"PHP {payslip.NetPay:N2}").Bold().FontSize(13).FontColor(Colors.Green.Darken2);
                    });
                });
            });
        }).GeneratePdf();
    }

    private static void AddDeductionRow(ColumnDescriptor col, string label, decimal amount)
    {
        col.Item().PaddingTop(3).Row(row =>
        {
            row.RelativeItem().Text(label).FontColor(Colors.Grey.Darken2);
            row.ConstantItem(120).AlignRight().Text($"PHP {amount:N2}").FontColor(Colors.Red.Darken1);
        });
    }
}
