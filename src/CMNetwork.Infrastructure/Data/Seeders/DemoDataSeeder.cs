using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Data.Seeders;

public class DemoDataSeeder
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly IInvoicePostingService _invoicePostingService;
    private readonly ILogger<DemoDataSeeder> _logger;

    public DemoDataSeeder(
        CMNetworkDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        IInvoicePostingService invoicePostingService,
        ILogger<DemoDataSeeder> logger)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _roleManager = roleManager;
        _invoicePostingService = invoicePostingService;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        var existingSuperAdmin = await _userManager.FindByEmailAsync("superadmin@cmnetwork.com");
        if (existingSuperAdmin is not null)
        {
            _logger.LogInformation("Demo data already seeded. Skipping DemoDataSeeder.");
            return;
        }

        _logger.LogInformation("Starting demo data seeding...");

        await EnsureRolesAsync();
        var departments = await SeedDepartmentsAsync();
        var users = await SeedUsersAsync(departments);
        var accounts = await SeedChartOfAccountsAsync();
        await SeedFiscalPeriodsAsync();
        var vendors = await SeedVendorsAsync();
        var customers = await SeedCustomersAsync();
        await SeedIntegrationSettingsAsync();
        await SeedBackupRecordsAsync();

        await SeedJournalEntriesAsync(accounts, users.Accountant);
        var seededApInvoices = await SeedAPInvoicesAsync(vendors, accounts, users.Accountant);
        var seededArInvoices = await SeedARInvoicesAsync(customers, accounts, users.Accountant);

        await _dbContext.SaveChangesAsync();

        // Post approved/sent invoices so demo GL and AP/AR views are linked by real entries.
        foreach (var invoice in seededApInvoices.Where(x => x.Status == APInvoiceStatus.Approved))
        {
            await _invoicePostingService.PostAPInvoiceAsync(invoice.Id);
        }

        foreach (var invoice in seededArInvoices.Where(x => x.Status == ARInvoiceStatus.Sent))
        {
            await _invoicePostingService.PostARInvoiceAsync(invoice.Id);
        }

        // Mark selected posted invoices as paid for status variety in demo views.
        var apPaid = seededApInvoices
            .Where(x => x.Status == APInvoiceStatus.Paid)
            .ToList();

        var arPaid = seededArInvoices
            .Where(x => x.Status == ARInvoiceStatus.Paid)
            .ToList();

        foreach (var invoice in apPaid)
        {
            invoice.LastModifiedUtc = DateTime.UtcNow;
            invoice.LastModifiedByUserId = users.Accountant.Id.ToString();
        }

        foreach (var invoice in arPaid)
        {
            invoice.LastModifiedUtc = DateTime.UtcNow;
            invoice.LastModifiedByUserId = users.Accountant.Id.ToString();
        }

        await _dbContext.SaveChangesAsync();
        await SeedAuditLogsAsync(users, seededApInvoices, seededArInvoices);
        _logger.LogInformation("Demo data seeding completed successfully.");
    }

    private async Task SeedAuditLogsAsync(
        (ApplicationUser SuperAdmin, ApplicationUser Auditor, ApplicationUser AuthorizedViewer, ApplicationUser Accountant, ApplicationUser FacultyAdmin, ApplicationUser Employee, ApplicationUser Cfo) users,
        IList<APInvoice> apInvoices,
        IList<ARInvoice> arInvoices)
    {
        if (await _dbContext.AuditLogs.AnyAsync())
        {
            return;
        }

        var now = DateTime.UtcNow;
        var entries = new List<AuditLogEntry>();

        AuditLogEntry Make(ApplicationUser user, string entity, string action, string category,
            string? recordId, object? details, int hoursAgo, string ip = "127.0.0.1")
            => new()
            {
                Id = Guid.NewGuid(),
                EntityName = entity,
                Action = action,
                ActionCategory = category,
                RecordId = recordId,
                PerformedBy = user.Id.ToString(),
                UserEmail = user.Email,
                IpAddress = ip,
                UserAgent = "Mozilla/5.0 (Demo Seed)",
                DetailsJson = details is null
                    ? null
                    : System.Text.Json.JsonSerializer.Serialize(details),
                CreatedUtc = now.AddHours(-hoursAgo),
            };

        // Login / logout events – spread across 7 days
        entries.Add(Make(users.SuperAdmin, "Auth", "LoginSucceeded", AuditCategories.Login, users.SuperAdmin.Id.ToString(),
            new { email = users.SuperAdmin.Email, role = "super-admin" }, 168, "10.0.0.10"));
        entries.Add(Make(users.SuperAdmin, "Auth", "Logout", AuditCategories.Logout, users.SuperAdmin.Id.ToString(), null, 160, "10.0.0.10"));
        entries.Add(Make(users.SuperAdmin, "Auth", "LoginSucceeded", AuditCategories.Login, users.SuperAdmin.Id.ToString(),
            new { email = users.SuperAdmin.Email, role = "super-admin" }, 72, "10.0.0.10"));
        entries.Add(Make(users.SuperAdmin, "Auth", "Logout", AuditCategories.Logout, users.SuperAdmin.Id.ToString(), null, 66, "10.0.0.10"));
        entries.Add(Make(users.SuperAdmin, "Auth", "LoginSucceeded", AuditCategories.Login, users.SuperAdmin.Id.ToString(),
            new { email = users.SuperAdmin.Email, role = "super-admin" }, 26, "10.0.0.10"));
        entries.Add(Make(users.SuperAdmin, "Auth", "Logout", AuditCategories.Logout, users.SuperAdmin.Id.ToString(), null, 22, "10.0.0.10"));

        entries.Add(Make(users.Accountant, "Auth", "LoginFailed", AuditCategories.Login, null,
            new { email = users.Accountant.Email, reason = "InvalidCredentialsOrLocked" }, 145, "10.0.0.21"));
        entries.Add(Make(users.Accountant, "Auth", "LoginFailed", AuditCategories.Login, null,
            new { email = users.Accountant.Email, reason = "InvalidCredentialsOrLocked" }, 144, "10.0.0.21"));
        entries.Add(Make(users.Accountant, "Auth", "LoginSucceeded", AuditCategories.Login, users.Accountant.Id.ToString(),
            new { email = users.Accountant.Email, role = "accountant" }, 143, "10.0.0.21"));
        entries.Add(Make(users.Accountant, "Auth", "Logout", AuditCategories.Logout, users.Accountant.Id.ToString(), null, 140, "10.0.0.21"));
        entries.Add(Make(users.Accountant, "Auth", "LoginSucceeded", AuditCategories.Login, users.Accountant.Id.ToString(),
            new { email = users.Accountant.Email, role = "accountant" }, 48, "10.0.0.21"));
        entries.Add(Make(users.Accountant, "Auth", "LoginSucceeded", AuditCategories.Login, users.Accountant.Id.ToString(),
            new { email = users.Accountant.Email, role = "accountant" }, 18, "10.0.0.21"));

        entries.Add(Make(users.Cfo, "Auth", "LoginSucceeded", AuditCategories.Login, users.Cfo.Id.ToString(),
            new { email = users.Cfo.Email, role = "cfo" }, 96, "10.0.0.42"));
        entries.Add(Make(users.Cfo, "Auth", "Logout", AuditCategories.Logout, users.Cfo.Id.ToString(), null, 90, "10.0.0.42"));
        entries.Add(Make(users.Cfo, "Auth", "LoginSucceeded", AuditCategories.Login, users.Cfo.Id.ToString(),
            new { email = users.Cfo.Email, role = "cfo" }, 12, "10.0.0.42"));

        entries.Add(Make(users.Auditor, "Auth", "LoginSucceeded", AuditCategories.Login, users.Auditor.Id.ToString(),
            new { email = users.Auditor.Email, role = "auditor" }, 120, "10.0.0.55"));
        entries.Add(Make(users.Auditor, "Auth", "Logout", AuditCategories.Logout, users.Auditor.Id.ToString(), null, 110, "10.0.0.55"));
        entries.Add(Make(users.Auditor, "Auth", "LoginSucceeded", AuditCategories.Login, users.Auditor.Id.ToString(),
            new { email = users.Auditor.Email, role = "auditor" }, 6, "10.0.0.55"));

        entries.Add(Make(users.FacultyAdmin, "Auth", "LoginSucceeded", AuditCategories.Login, users.FacultyAdmin.Id.ToString(),
            new { email = users.FacultyAdmin.Email, role = "faculty-admin" }, 36, "192.168.1.12"));
        entries.Add(Make(users.Employee, "Auth", "LoginSucceeded", AuditCategories.Login, users.Employee.Id.ToString(),
            new { email = users.Employee.Email, role = "employee" }, 24, "192.168.1.88"));

        // MFA events
        entries.Add(Make(users.SuperAdmin, "Auth", "LoginMfaChallenge", AuditCategories.Auth, users.SuperAdmin.Id.ToString(),
            new { email = users.SuperAdmin.Email, method = "TOTP" }, 72, "10.0.0.10"));
        entries.Add(Make(users.Cfo, "Auth", "MfaEnabled", AuditCategories.Security, users.Cfo.Id.ToString(),
            new { email = users.Cfo.Email }, 80, "10.0.0.42"));

        // AP Invoice approvals & voids
        for (var i = 0; i < Math.Min(4, apInvoices.Count); i++)
        {
            var inv = apInvoices[i];
            entries.Add(Make(users.Accountant, nameof(APInvoice), "Approved", AuditCategories.Approval,
                inv.Id.ToString(),
                new { inv.InvoiceNumber, inv.TotalAmount, vendor = inv.VendorId }, 130 - i * 8));
        }
        if (apInvoices.Count > 4)
        {
            var voided = apInvoices[4];
            entries.Add(Make(users.Accountant, nameof(APInvoice), "Voided", AuditCategories.Approval,
                voided.Id.ToString(),
                new { voided.InvoiceNumber, reason = "Duplicate invoice detected" }, 100));
        }

        // AR Invoice events
        for (var i = 0; i < Math.Min(4, arInvoices.Count); i++)
        {
            var inv = arInvoices[i];
            entries.Add(Make(users.Accountant, nameof(ARInvoice), "Sent", AuditCategories.DataChange,
                inv.Id.ToString(),
                new { inv.InvoiceNumber, inv.TotalAmount, customer = inv.CustomerId }, 90 - i * 6));
        }
        if (arInvoices.Count > 4)
        {
            var paid = arInvoices[4];
            entries.Add(Make(users.Accountant, nameof(ARInvoice), "MarkedPaid", AuditCategories.Approval,
                paid.Id.ToString(),
                new { paid.InvoiceNumber, paid.TotalAmount, paymentRef = "BPI-TRF-20260428" }, 50));
        }

        // Report exports
        entries.Add(Make(users.Cfo, "Report", "Exported", AuditCategories.Export, "income-statement",
            new { report = "income-statement", format = "Excel", from = "2026-01-01", to = "2026-04-30" }, 48));
        entries.Add(Make(users.Cfo, "Report", "Exported", AuditCategories.Export, "balance-sheet",
            new { report = "balance-sheet", format = "PDF", asOf = "2026-04-30" }, 24));
        entries.Add(Make(users.Auditor, "Report", "Exported", AuditCategories.Export, "aging-ap",
            new { report = "aging-ap", format = "Excel", asOf = "2026-05-01" }, 8));
        entries.Add(Make(users.Auditor, "Report", "Exported", AuditCategories.Export, "aging-ar",
            new { report = "aging-ar", format = "Excel", asOf = "2026-05-01" }, 7));
        entries.Add(Make(users.AuthorizedViewer, "Report", "Exported", AuditCategories.Export, "income-statement",
            new { report = "income-statement", format = "PDF", from = "2026-01-01", to = "2026-03-31" }, 60));

        // Audit log review
        entries.Add(Make(users.Auditor, nameof(AuditLogEntry), "Reviewed", AuditCategories.Review, null,
            new { count = 12, note = "Monthly compliance review — April 2026" }, 5));

        // Security / settings changes
        entries.Add(Make(users.SuperAdmin, nameof(SecurityPolicy), "Update", AuditCategories.Security,
            "30000000-0000-0000-0000-000000000002",
            new { policy = "Session Timeout", oldValue = "30 minutes", newValue = "20 minutes" }, 150));
        entries.Add(Make(users.SuperAdmin, nameof(SecurityPolicy), "Update", AuditCategories.Security,
            "30000000-0000-0000-0000-000000000001",
            new { policy = "Password Complexity", change = "Minimum length raised from 8 to 12" }, 72));
        entries.Add(Make(users.SuperAdmin, "IntegrationSetting", "Update", AuditCategories.System,
            null,
            new { integration = "Bank Feed Connector", change = "Endpoint URL updated" }, 96));

        // User management
        entries.Add(Make(users.SuperAdmin, "ApplicationUser", "Created", AuditCategories.UserMgmt,
            users.Employee.Id.ToString(),
            new { email = users.Employee.Email, role = "employee", department = "Marketing" }, 720));
        entries.Add(Make(users.SuperAdmin, "ApplicationUser", "RoleAssigned", AuditCategories.UserMgmt,
            users.FacultyAdmin.Id.ToString(),
            new { email = users.FacultyAdmin.Email, role = "faculty-admin" }, 500));
        entries.Add(Make(users.SuperAdmin, "ApplicationUser", "Deactivated", AuditCategories.UserMgmt,
            users.AuthorizedViewer.Id.ToString(),
            new { email = users.AuthorizedViewer.Email, reason = "Temporary suspension pending review" }, 200));
        entries.Add(Make(users.SuperAdmin, "ApplicationUser", "Reactivated", AuditCategories.UserMgmt,
            users.AuthorizedViewer.Id.ToString(),
            new { email = users.AuthorizedViewer.Email, reason = "Review completed, access restored" }, 168));

        // General ledger data changes (auto-created by Audit.NET, simulated here for seed variety)
        entries.Add(Make(users.Accountant, "JournalEntry", "Insert", AuditCategories.DataChange,
            null,
            new { description = "April payroll accrual", debit = 3_850_000, credit = 3_850_000 }, 35));
        entries.Add(Make(users.Accountant, "JournalEntry", "Insert", AuditCategories.DataChange,
            null,
            new { description = "Utilities expense — April 2026", debit = 84_500, credit = 84_500 }, 30));
        entries.Add(Make(users.Accountant, "ChartOfAccount", "Update", AuditCategories.DataChange,
            null,
            new { accountCode = "5700", change = "IsActive set to false (retired account)" }, 110));

        // API request samples (middleware-generated category)
        entries.Add(Make(users.Auditor, "GET /api/vendors", "GET", AuditCategories.ApiRequest, "200",
            new { path = "/api/vendors", statusCode = 200, durationMs = 41 }, 6));
        entries.Add(Make(users.Cfo, "GET /api/reports/income-statement", "GET", AuditCategories.ApiRequest, "200",
            new { path = "/api/reports/income-statement", statusCode = 200, durationMs = 128 }, 12));
        entries.Add(Make(users.Accountant, "POST /api/apinvoices", "POST", AuditCategories.ApiRequest, "201",
            new { path = "/api/apinvoices", statusCode = 201, durationMs = 89 }, 130));
        entries.Add(Make(users.Accountant, "PUT /api/apinvoices", "PUT", AuditCategories.ApiRequest, "200",
            new { path = "/api/apinvoices", statusCode = 200, durationMs = 67 }, 100));

        _dbContext.AuditLogs.AddRange(entries);
        await _dbContext.SaveChangesAsync();
    }

    private async Task EnsureRolesAsync()
    {
        var roles = new[]
        {
            "super-admin", "accountant", "faculty-admin", "employee", "authorized-viewer", "auditor", "cfo",
            "SuperAdmin", "Accountant", "FacultyAdmin", "Employee", "AuthorizedViewer", "Auditor", "CFO"
        };

        foreach (var role in roles)
        {
            if (!await _roleManager.RoleExistsAsync(role))
            {
                await _roleManager.CreateAsync(new IdentityRole<Guid> { Id = Guid.NewGuid(), Name = role, NormalizedName = role.ToUpperInvariant() });
            }
        }
    }

    private async Task<Dictionary<string, Department>> SeedDepartmentsAsync()
    {
        var target = new[]
        {
            new { Code = "ADM", Name = "Admin", BudgetAmount = 2_400_000m, Description = "Corporate administration" },
            new { Code = "FIN", Name = "Finance", BudgetAmount = 3_100_000m, Description = "Finance and accounting operations" },
            new { Code = "ENG", Name = "Engineering", BudgetAmount = 8_500_000m, Description = "Engineering and delivery" },
            new { Code = "SAL", Name = "Sales", BudgetAmount = 5_700_000m, Description = "Sales operations" },
            new { Code = "MKT", Name = "Marketing", BudgetAmount = 2_900_000m, Description = "Marketing and campaigns" }
        };

        var byCode = await _dbContext.Departments.ToDictionaryAsync(x => x.Code);

        foreach (var item in target)
        {
            if (byCode.TryGetValue(item.Code, out var existing))
            {
                existing.Name = item.Name;
                existing.Description = item.Description;
                existing.BudgetAmount = item.BudgetAmount;
            }
            else
            {
                var department = new Department
                {
                    Id = Guid.NewGuid(),
                    Code = item.Code,
                    Name = item.Name,
                    Description = item.Description,
                    BudgetAmount = item.BudgetAmount
                };
                _dbContext.Departments.Add(department);
                byCode[item.Code] = department;
            }
        }

        await _dbContext.SaveChangesAsync();
        return byCode;
    }

    private async Task<(ApplicationUser SuperAdmin, ApplicationUser Auditor, ApplicationUser AuthorizedViewer, ApplicationUser Accountant, ApplicationUser FacultyAdmin, ApplicationUser Employee, ApplicationUser Cfo)> SeedUsersAsync(Dictionary<string, Department> departments)
    {
        var superAdmin = await EnsureUserAsync(
            email: "superadmin@cmnetwork.com",
            password: "Cmnetwork123!",
            primaryRole: "super-admin",
            secondaryRole: "SuperAdmin",
            firstName: "Super",
            lastName: "Admin",
            middleName: "",
            birthdate: new DateOnly(1985, 1, 1),
            gender: "Male",
            address: "CMNetwork HQ",
            tin: "000-000-000-000",
            sss: "00-0000000-0",
            departmentId: departments["ADM"].Id);

        var auditor = await EnsureUserAsync(
            email: "auditor.demo@cmnetwork.com",
            password: "Demo123!",
            primaryRole: "auditor",
            secondaryRole: "Auditor",
            firstName: "Maria",
            lastName: "Del Rosario",
            middleName: "Santos",
            birthdate: new DateOnly(1987, 7, 12),
            gender: "Female",
            address: "Quezon City, Metro Manila",
            tin: "143-219-887-000",
            sss: "34-1200459-8",
            departmentId: departments["FIN"].Id);

        var authorizedViewer = await EnsureUserAsync(
            email: "viewer.demo@cmnetwork.com",
            password: "Demo123!",
            primaryRole: "authorized-viewer",
            secondaryRole: "AuthorizedViewer",
            firstName: "Jose",
            lastName: "Villanueva",
            middleName: "Reyes",
            birthdate: new DateOnly(1989, 11, 4),
            gender: "Male",
            address: "Makati City, Metro Manila",
            tin: "214-778-399-000",
            sss: "45-3309188-2",
            departmentId: departments["ADM"].Id);

        var accountant = await EnsureUserAsync(
            email: "accountant.demo@cmnetwork.com",
            password: "Demo123!",
            primaryRole: "accountant",
            secondaryRole: "Accountant",
            firstName: "Carla",
            lastName: "Mendoza",
            middleName: "Lopez",
            birthdate: new DateOnly(1990, 5, 30),
            gender: "Female",
            address: "Pasig City, Metro Manila",
            tin: "315-557-992-000",
            sss: "56-4471022-5",
            departmentId: departments["FIN"].Id);

        var facultyAdmin = await EnsureUserAsync(
            email: "facultyadmin.demo@cmnetwork.com",
            password: "Demo123!",
            primaryRole: "faculty-admin",
            secondaryRole: "FacultyAdmin",
            firstName: "Ramon",
            lastName: "Bautista",
            middleName: "Cruz",
            birthdate: new DateOnly(1986, 3, 18),
            gender: "Male",
            address: "Antipolo, Rizal",
            tin: "416-665-219-000",
            sss: "67-5592831-6",
            departmentId: departments["ENG"].Id);

        var employee = await EnsureUserAsync(
            email: "employee.demo@cmnetwork.com",
            password: "Demo123!",
            primaryRole: "employee",
            secondaryRole: "Employee",
            firstName: "Angela",
            lastName: "Navarro",
            middleName: "Diaz",
            birthdate: new DateOnly(1995, 9, 9),
            gender: "Female",
            address: "Taguig City, Metro Manila",
            tin: "518-223-775-000",
            sss: "78-6645019-4",
            departmentId: departments["MKT"].Id);

        var cfo = await EnsureUserAsync(
            email: "cfo.demo@cmnetwork.com",
            password: "Demo123!",
            primaryRole: "cfo",
            secondaryRole: "CFO",
            firstName: "Eduardo",
            lastName: "Santos",
            middleName: "Garcia",
            birthdate: new DateOnly(1982, 2, 22),
            gender: "Male",
            address: "Alabang, Muntinlupa",
            tin: "612-451-338-000",
            sss: "89-7708124-1",
            departmentId: departments["FIN"].Id);

        return (superAdmin, auditor, authorizedViewer, accountant, facultyAdmin, employee, cfo);
    }

    private async Task<ApplicationUser> EnsureUserAsync(
        string email,
        string password,
        string primaryRole,
        string secondaryRole,
        string firstName,
        string lastName,
        string middleName,
        DateOnly birthdate,
        string gender,
        string address,
        string tin,
        string sss,
        Guid departmentId)
    {
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            return existing;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            IsActive = true,
            FirstName = firstName,
            LastName = lastName,
            MiddleName = middleName,
            Birthdate = birthdate,
            Gender = gender,
            Address = address,
            TIN = tin,
            SSS = sss,
            DepartmentId = departmentId,
            JoinDate = new DateOnly(2025, 12, 1),
            CreatedUtc = DateTime.UtcNow,
        };

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            throw new InvalidOperationException($"Failed creating user {email}: {string.Join(", ", createResult.Errors.Select(x => x.Description))}");
        }

        await _userManager.AddToRoleAsync(user, primaryRole);
        if (!string.Equals(primaryRole, secondaryRole, StringComparison.OrdinalIgnoreCase))
        {
            await _userManager.AddToRoleAsync(user, secondaryRole);
        }

        return user;
    }

    private async Task<Dictionary<string, ChartOfAccount>> SeedChartOfAccountsAsync()
    {
        var existing = await _dbContext.ChartOfAccounts.ToListAsync();
        var byCode = existing.ToDictionary(x => x.AccountCode, StringComparer.OrdinalIgnoreCase);

        var templates = new List<(string Code, string Name, AccountType Type, string? ParentCode, bool IsActive)>
        {
            ("1000", "Current Assets", AccountType.Asset, null, true),
            ("1100", "Cash", AccountType.Asset, "1000", true),
            ("1110", "Cash in Bank - BDO", AccountType.Asset, "1100", true),
            ("1120", "Cash in Bank - BPI", AccountType.Asset, "1100", true),
            ("1130", "Accounts Receivable", AccountType.Asset, "1000", true),
            ("1140", "Prepaid Expenses", AccountType.Asset, "1000", true),
            ("1150", "Supplies Inventory", AccountType.Asset, "1000", true),
            ("1200", "Non-Current Assets", AccountType.Asset, null, true),
            ("1210", "Office Equipment", AccountType.Asset, "1200", true),
            ("1220", "Accumulated Depreciation", AccountType.Asset, "1200", true),
            ("1230", "Legacy IT Equipment", AccountType.Asset, "1200", false),

            ("2000", "Current Liabilities", AccountType.Liability, null, true),
            ("2100", "Accounts Payable", AccountType.Liability, "2000", true),
            ("2110", "Accrued Expenses", AccountType.Liability, "2000", true),
            ("2120", "Withholding Tax Payable", AccountType.Liability, "2000", true),
            ("2200", "Long-Term Liabilities", AccountType.Liability, null, true),
            ("2210", "Notes Payable", AccountType.Liability, "2200", true),
            ("2220", "Deferred Revenue", AccountType.Liability, "2200", true),

            ("3000", "Equity", AccountType.Equity, null, true),
            ("3100", "Owner Capital", AccountType.Equity, "3000", true),
            ("3200", "Retained Earnings", AccountType.Equity, "3000", true),
            ("3300", "Current Year Earnings", AccountType.Equity, "3000", true),

            ("4000", "Revenue", AccountType.Revenue, null, true),
            ("4100", "Service Revenue", AccountType.Revenue, "4000", true),
            ("4200", "Consulting Revenue", AccountType.Revenue, "4000", true),
            ("4300", "Training Revenue", AccountType.Revenue, "4000", true),
            ("4400", "Other Income", AccountType.Revenue, "4000", true),

            ("5000", "Cost and Expenses", AccountType.Expense, null, true),
            ("5100", "Cost of Goods Sold", AccountType.Expense, "5000", true),
            ("5200", "Salaries Expense", AccountType.Expense, "5000", true),
            ("5300", "Benefits Expense", AccountType.Expense, "5000", true),
            ("5400", "Rent Expense", AccountType.Expense, "5000", true),
            ("5500", "Utilities Expense", AccountType.Expense, "5000", true),
            ("5600", "Office Supplies Expense", AccountType.Expense, "5000", true),
            ("5700", "Marketing Expense", AccountType.Expense, "5000", true),
            ("5800", "Transportation Expense", AccountType.Expense, "5000", true),
            ("5900", "Depreciation Expense", AccountType.Expense, "5000", true),
            ("5950", "Legacy Expense Bucket", AccountType.Expense, "5000", false),
        };

        foreach (var template in templates)
        {
            if (!byCode.TryGetValue(template.Code, out var account))
            {
                account = new ChartOfAccount
                {
                    Id = Guid.NewGuid(),
                    AccountCode = template.Code,
                    Name = template.Name,
                    Type = template.Type,
                    IsActive = template.IsActive,
                    CreatedUtc = DateTime.UtcNow,
                };
                _dbContext.ChartOfAccounts.Add(account);
                byCode[template.Code] = account;
            }
            else
            {
                account.Name = template.Name;
                account.Type = template.Type;
                account.IsActive = template.IsActive;
            }
        }

        // Parent relationships after all accounts are ensured.
        foreach (var template in templates.Where(x => x.ParentCode is not null))
        {
            var child = byCode[template.Code];
            var parent = byCode[template.ParentCode!];
            child.ParentAccountId = parent.Id;
        }

        await _dbContext.SaveChangesAsync();
        return byCode;
    }

    private async Task SeedFiscalPeriodsAsync()
    {
        var periods = await _dbContext.FiscalPeriods.ToListAsync();

        FiscalPeriod Ensure(string name, DateOnly start, DateOnly end, bool closed)
        {
            var period = periods.FirstOrDefault(x => x.Name == name);
            if (period is null)
            {
                period = new FiscalPeriod
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    StartDate = start,
                    EndDate = end,
                    IsClosed = closed,
                    CreatedUtc = DateTime.UtcNow,
                };
                _dbContext.FiscalPeriods.Add(period);
                periods.Add(period);
            }
            else
            {
                period.StartDate = start;
                period.EndDate = end;
                period.IsClosed = closed;
            }

            return period;
        }

        Ensure("2025-12", new DateOnly(2025, 12, 1), new DateOnly(2025, 12, 31), true);

        for (var month = 1; month <= 12; month++)
        {
            var start = new DateOnly(2026, month, 1);
            var end = start.AddMonths(1).AddDays(-1);
            var closed = month is 1 or 2;
            Ensure($"2026-{month:00}", start, end, closed);
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task<List<Vendor>> SeedVendorsAsync()
    {
        if (await _dbContext.Vendors.AnyAsync())
        {
            return await _dbContext.Vendors.OrderBy(x => x.VendorCode).ToListAsync();
        }

        var vendors = new List<Vendor>
        {
            NewVendor("VND-001", "Metro Office Essentials Inc.", "Marlon Reyes", "procurement@metrooffice.ph", "(02) 8400-1101", "Ortigas Center", "Pasig", "NCR", "1605", "Philippines", "211-901-220-000", "Net 30", 450000),
            NewVendor("VND-002", "Northern Utilities & Power Corp.", "Ana Lim", "billing@nupc.ph", "(02) 8820-1142", "BGC", "Taguig", "NCR", "1634", "Philippines", "318-111-430-000", "Net 15", 980000),
            NewVendor("VND-003", "Pacific IT Solutions", "Rico Santos", "sales@pacificit.ph", "(02) 8711-2225", "Cebu IT Park", "Cebu City", "Cebu", "6000", "Philippines", "325-551-120-000", "Net 30", 1600000),
            NewVendor("VND-004", "Southline Facility Services", "Grace Mercado", "accounts@southlinefs.ph", "(02) 8355-3310", "Filinvest", "Muntinlupa", "NCR", "1781", "Philippines", "422-541-887-000", "Net 15", 780000),
            NewVendor("VND-005", "Prime Logistics Express", "Jayson Cruz", "finance@primelex.ph", "(02) 8601-4450", "Aseana", "Paranaque", "NCR", "1701", "Philippines", "512-330-198-000", "Net 30", 620000),
            NewVendor("VND-006", "Luzon Printing House", "Nina Villanueva", "ar@lphouse.ph", "(02) 8895-6621", "España", "Manila", "NCR", "1008", "Philippines", "610-318-891-000", "Net 15", 240000),
            NewVendor("VND-007", "Summit Security Systems", "Edward Dy", "payments@summitsec.ph", "(02) 8722-7740", "Makati Ave", "Makati", "NCR", "1227", "Philippines", "702-134-558-000", "Net 30", 540000),
            NewVendor("VND-008", "VisMin Travel Services", "Leah Francisco", "invoice@vismintravel.ph", "(02) 8912-8511", "Ayala Alabang", "Muntinlupa", "NCR", "1780", "Philippines", "811-540-777-000", "Net 30", 300000),
            NewVendor("VND-009", "Atlas Marketing Partners", "Rina Caguioa", "billing@atlasmk.ph", "(02) 8334-9042", "UP Town Center", "Quezon City", "NCR", "1101", "Philippines", "901-210-344-000", "Net 15", 470000),
            NewVendor("VND-010", "Harbor Lease & Realty", "Leo Dizon", "collections@harborlease.ph", "(02) 8532-0019", "Bay City", "Pasay", "NCR", "1300", "Philippines", "312-991-770-000", "Net 30", 1100000),
            NewVendor("VND-011", "GreenGrid Internet Services", "Pat Gomez", "accounts@greengrid.ph", "(02) 8668-3021", "Diliman", "Quezon City", "NCR", "1100", "Philippines", "401-220-781-000", "Net 15", 250000),
            NewVendor("VND-012", "Peak Training Institute", "Donna Javier", "invoice@peaktraining.ph", "(02) 8781-2205", "Clark", "Angeles", "Pampanga", "2009", "Philippines", "510-334-601-000", "Net 30", 180000),
        };

        _dbContext.Vendors.AddRange(vendors);
        await _dbContext.SaveChangesAsync();
        return vendors;
    }

    private static Vendor NewVendor(
        string code, string name, string contact, string email, string phone,
        string address, string city, string state, string postalCode, string country,
        string taxId, string paymentTerms, decimal creditLimit)
    {
        return new Vendor
        {
            Id = Guid.NewGuid(),
            VendorCode = code,
            Name = name,
            ContactPerson = contact,
            Email = email,
            PhoneNumber = phone,
            Address = address,
            City = city,
            State = state,
            PostalCode = postalCode,
            Country = country,
            TaxId = taxId,
            PaymentTerms = paymentTerms,
            CreditLimit = creditLimit,
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
        };
    }

    private async Task<List<Customer>> SeedCustomersAsync()
    {
        if (await _dbContext.Customers.AnyAsync())
        {
            return await _dbContext.Customers.OrderBy(x => x.CustomerCode).ToListAsync();
        }

        var customers = new List<Customer>
        {
            NewCustomer("CST-001", "Ateneo Digital Services", "Mica Abad", "acctspayable@ateneods.ph", "(02) 8426-6001", "Katipunan Ave", "Quezon City", "NCR", "1108", "Philippines", "120-773-220-000", "Net 30", 1800000),
            NewCustomer("CST-002", "Lakeshore University", "Patrick Uy", "finance@lakeshoreu.ph", "(02) 8432-2171", "Laguna Blvd", "Calamba", "Laguna", "4027", "Philippines", "222-441-101-000", "Net 30", 2500000),
            NewCustomer("CST-003", "Metro Retail Holdings", "Alyssa Tan", "billing@metroretail.ph", "(02) 8800-4302", "Greenhills", "San Juan", "NCR", "1502", "Philippines", "311-228-903-000", "Net 15", 900000),
            NewCustomer("CST-004", "Visayas Construction Group", "Ralph Pineda", "ap@vcg.ph", "(032) 420-9011", "Mabolo", "Cebu City", "Cebu", "6000", "Philippines", "401-772-220-000", "Net 30", 2200000),
            NewCustomer("CST-005", "Southern Hospital Network", "Myrna dela Cruz", "finops@shn.ph", "(082) 222-4510", "J.P. Laurel", "Davao City", "Davao del Sur", "8000", "Philippines", "510-330-742-000", "Net 15", 1300000),
            NewCustomer("CST-006", "Bayview Hotels and Resorts", "Rey Narvaez", "accounting@bayviewhr.ph", "(02) 8555-7112", "Roxas Blvd", "Pasay", "NCR", "1300", "Philippines", "620-215-619-000", "Net 30", 1450000),
            NewCustomer("CST-007", "Bicol AgriTech", "Lorie Perez", "billing@bicolagri.ph", "(052) 742-1902", "Magsaysay Ave", "Naga", "Camarines Sur", "4400", "Philippines", "701-981-342-000", "Net 15", 700000),
            NewCustomer("CST-008", "Northwind Manufacturing", "Rene Castillo", "finance@northwindmfg.ph", "(045) 963-7720", "McArthur Highway", "San Fernando", "Pampanga", "2000", "Philippines", "812-310-007-000", "Net 30", 1900000),
            NewCustomer("CST-009", "Prime Education Foundation", "Janine Ocampo", "ar@primeed.ph", "(02) 8671-4505", "Ortigas Avenue", "Pasig", "NCR", "1605", "Philippines", "903-440-892-000", "Net 15", 600000),
            NewCustomer("CST-010", "Pacific Maritime Corp", "Ken Soriano", "invoice@pacmaritime.ph", "(032) 418-5510", "Pier 4", "Cebu City", "Cebu", "6015", "Philippines", "411-282-631-000", "Net 30", 2400000),
            NewCustomer("CST-011", "Alto Pharma Distribution", "Donna Aguirre", "finance@altopharma.ph", "(02) 8910-2221", "Sucat Road", "Paranaque", "NCR", "1715", "Philippines", "355-122-799-000", "Net 15", 1250000),
            NewCustomer("CST-012", "FilCampus Consortium", "Harold Rosales", "accts@filcampus.ph", "(02) 8483-0092", "Espana Blvd", "Manila", "NCR", "1015", "Philippines", "266-801-944-000", "Net 30", 1650000),
        };

        _dbContext.Customers.AddRange(customers);
        await _dbContext.SaveChangesAsync();
        return customers;
    }

    private async Task SeedIntegrationSettingsAsync()
    {
        if (await _dbContext.IntegrationSettings.AnyAsync())
        {
            return;
        }

        _dbContext.IntegrationSettings.AddRange(
            new IntegrationSetting
            {
                Id = Guid.NewGuid(),
                Name = "Payroll Service",
                Status = "active",
                Endpoint = "https://sandbox-api.cmnetwork.local/payroll",
                LastSyncUtc = DateTime.UtcNow.AddMinutes(-45),
            },
            new IntegrationSetting
            {
                Id = Guid.NewGuid(),
                Name = "Tax Compliance Gateway",
                Status = "active",
                Endpoint = "https://sandbox-api.cmnetwork.local/tax",
                LastSyncUtc = DateTime.UtcNow.AddHours(-2),
            },
            new IntegrationSetting
            {
                Id = Guid.NewGuid(),
                Name = "Bank Feed Connector",
                Status = "active",
                Endpoint = "https://sandbox-api.cmnetwork.local/bank-feed",
                LastSyncUtc = DateTime.UtcNow.AddMinutes(-15),
            },
            new IntegrationSetting
            {
                Id = Guid.NewGuid(),
                Name = "Business Analytics",
                Status = "inactive",
                Endpoint = "https://sandbox-api.cmnetwork.local/analytics",
                LastSyncUtc = DateTime.UtcNow.AddDays(-2),
            }
        );

        await _dbContext.SaveChangesAsync();
    }

    private async Task SeedBackupRecordsAsync()
    {
        if (await _dbContext.BackupRecords.AnyAsync())
        {
            return;
        }

        _dbContext.BackupRecords.AddRange(
            new BackupRecord
            {
                Id = Guid.NewGuid(),
                StartedUtc = DateTime.UtcNow.Date.AddHours(2).AddDays(-1),
                Status = "success",
                SizeInMb = 2388.2m,
                DurationSeconds = 905,
            },
            new BackupRecord
            {
                Id = Guid.NewGuid(),
                StartedUtc = DateTime.UtcNow.Date.AddHours(2).AddDays(-2),
                Status = "success",
                SizeInMb = 2355.7m,
                DurationSeconds = 881,
            },
            new BackupRecord
            {
                Id = Guid.NewGuid(),
                StartedUtc = DateTime.UtcNow.Date.AddHours(2).AddDays(-3),
                Status = "success",
                SizeInMb = 2321.4m,
                DurationSeconds = 867,
            }
        );

        await _dbContext.SaveChangesAsync();
    }

    private static Customer NewCustomer(
        string code, string name, string contact, string email, string phone,
        string address, string city, string state, string postalCode, string country,
        string taxId, string paymentTerms, decimal creditLimit)
    {
        return new Customer
        {
            Id = Guid.NewGuid(),
            CustomerCode = code,
            Name = name,
            ContactPerson = contact,
            Email = email,
            PhoneNumber = phone,
            Address = address,
            City = city,
            State = state,
            PostalCode = postalCode,
            Country = country,
            TaxId = taxId,
            PaymentTerms = paymentTerms,
            CreditLimit = creditLimit,
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
        };
    }

    private async Task SeedJournalEntriesAsync(Dictionary<string, ChartOfAccount> accounts, ApplicationUser accountant)
    {
        if (await _dbContext.JournalEntries.AnyAsync())
        {
            return;
        }

        var entries = new List<JournalEntry>
        {
            CreateJournalEntry(
                entryNumber: "JE-202512-0001",
                entryDate: new DateOnly(2025, 12, 31),
                description: "Opening balances",
                referenceNo: "OPEN-2026",
                createdBy: accountant.Id.ToString(),
                postedBy: accountant.Id.ToString(),
                lines: new List<(string Code, decimal Debit, decimal Credit, string Description)>
                {
                    ("1110", 2_100_000m, 0m, "Opening cash balance"),
                    ("1120", 1_450_000m, 0m, "Opening bank balance"),
                    ("1130", 1_000_000m, 0m, "Opening receivables"),
                    ("1150", 280_000m, 0m, "Opening supplies"),
                    ("1210", 3_200_000m, 0m, "Opening equipment"),
                    ("2100", 0m, 1_450_000m, "Opening payables"),
                    ("2210", 0m, 1_200_000m, "Opening notes payable"),
                    ("3100", 0m, 3_000_000m, "Owner capital"),
                    ("3200", 0m, 2_380_000m, "Retained earnings"),
                },
                accounts: accounts),

            CreateJournalEntry(
                entryNumber: "JE-202603-0101",
                entryDate: new DateOnly(2026, 3, 10),
                description: "March revenue and collections batch",
                referenceNo: "OPS-2026-03-A",
                createdBy: accountant.Id.ToString(),
                postedBy: accountant.Id.ToString(),
                lines: new List<(string Code, decimal Debit, decimal Credit, string Description)>
                {
                    ("1130", 620_000m, 0m, "Invoices issued"),
                    ("4100", 0m, 400_000m, "Service revenue"),
                    ("4200", 0m, 140_000m, "Consulting revenue"),
                    ("4300", 0m, 80_000m, "Training revenue"),
                },
                accounts: accounts),

            CreateJournalEntry(
                entryNumber: "JE-202603-0102",
                entryDate: new DateOnly(2026, 3, 19),
                description: "March operating expenses",
                referenceNo: "OPS-2026-03-B",
                createdBy: accountant.Id.ToString(),
                postedBy: accountant.Id.ToString(),
                lines: new List<(string Code, decimal Debit, decimal Credit, string Description)>
                {
                    ("5200", 280_000m, 0m, "Payroll"),
                    ("5400", 95_000m, 0m, "Office rent"),
                    ("5500", 52_000m, 0m, "Utilities"),
                    ("5600", 38_000m, 0m, "Office supplies"),
                    ("2100", 0m, 465_000m, "Vendor obligations"),
                },
                accounts: accounts),

            CreateJournalEntry(
                entryNumber: "JE-202604-0101",
                entryDate: new DateOnly(2026, 4, 8),
                description: "April collections from receivables",
                referenceNo: "COL-2026-04-A",
                createdBy: accountant.Id.ToString(),
                postedBy: accountant.Id.ToString(),
                lines: new List<(string Code, decimal Debit, decimal Credit, string Description)>
                {
                    ("1110", 470_000m, 0m, "Cash collections"),
                    ("1130", 0m, 470_000m, "Receivable settlement"),
                },
                accounts: accounts),

            CreateJournalEntry(
                entryNumber: "JE-202604-0102",
                entryDate: new DateOnly(2026, 4, 23),
                description: "April cash disbursements",
                referenceNo: "PAY-2026-04-A",
                createdBy: accountant.Id.ToString(),
                postedBy: accountant.Id.ToString(),
                lines: new List<(string Code, decimal Debit, decimal Credit, string Description)>
                {
                    ("2100", 360_000m, 0m, "AP settlements"),
                    ("1110", 0m, 360_000m, "Cash paid"),
                },
                accounts: accounts),
        };

        _dbContext.JournalEntries.AddRange(entries);
        await _dbContext.SaveChangesAsync();
    }

    private static JournalEntry CreateJournalEntry(
        string entryNumber,
        DateOnly entryDate,
        string description,
        string referenceNo,
        string createdBy,
        string postedBy,
        List<(string Code, decimal Debit, decimal Credit, string Description)> lines,
        Dictionary<string, ChartOfAccount> accounts)
    {
        var debitTotal = lines.Sum(x => x.Debit);
        var creditTotal = lines.Sum(x => x.Credit);
        if (debitTotal != creditTotal)
        {
            throw new InvalidOperationException($"Journal entry {entryNumber} is not balanced: {debitTotal} != {creditTotal}");
        }

        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            EntryNumber = entryNumber,
            EntryDate = entryDate,
            Description = description,
            ReferenceNo = referenceNo,
            Status = JournalEntryStatus.Posted,
            CreatedBy = createdBy,
            CreatedUtc = DateTime.UtcNow,
            PostedBy = postedBy,
            PostedUtc = DateTime.UtcNow,
        };

        foreach (var line in lines)
        {
            entry.Lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = entry.Id,
                AccountId = accounts[line.Code].Id,
                Description = line.Description,
                Debit = line.Debit,
                Credit = line.Credit,
            });
        }

        return entry;
    }

    private async Task<List<APInvoice>> SeedAPInvoicesAsync(List<Vendor> vendors, Dictionary<string, ChartOfAccount> accounts, ApplicationUser accountant)
    {
        if (await _dbContext.APInvoices.AnyAsync())
        {
            return await _dbContext.APInvoices
                .Include(x => x.Lines)
                .OrderBy(x => x.InvoiceNumber)
                .ToListAsync();
        }

        var expenseCodes = new[] { "5200", "5300", "5400", "5500", "5600", "5700", "5800" };
        var random = new Random(20260429);
        var invoices = new List<APInvoice>();
        var statusPlan = new[]
        {
            APInvoiceStatus.Draft, APInvoiceStatus.Draft, APInvoiceStatus.Submitted,
            APInvoiceStatus.Submitted, APInvoiceStatus.Approved, APInvoiceStatus.Approved,
            APInvoiceStatus.Approved, APInvoiceStatus.Approved, APInvoiceStatus.Paid,
            APInvoiceStatus.Paid, APInvoiceStatus.Paid, APInvoiceStatus.Paid,
            APInvoiceStatus.Draft, APInvoiceStatus.Submitted, APInvoiceStatus.Approved,
        };

        for (var i = 0; i < 15; i++)
        {
            var vendor = vendors[i % vendors.Count];
            var invoiceDate = new DateTime(2026, 3, 1).AddDays(i * 3);
            var dueDate = invoiceDate.AddDays(i % 2 == 0 ? 15 : 30);
            var lines = new List<APInvoiceLine>();

            var lineCount = (i % 2 == 0) ? 2 : 3;
            for (var l = 0; l < lineCount; l++)
            {
                var qty = random.Next(1, 5);
                var unitPrice = random.Next(7_500, 36_000);
                var amount = qty * unitPrice;
                var tax = Math.Round(amount * 0.12m, 2);
                var code = expenseCodes[(i + l) % expenseCodes.Length];

                lines.Add(new APInvoiceLine
                {
                    Id = Guid.NewGuid(),
                    ChartOfAccountId = accounts[code].Id,
                    Description = $"{accounts[code].Name} charge ({vendor.Name})",
                    Quantity = qty,
                    UnitPrice = unitPrice,
                    Amount = amount,
                    TaxAmount = tax,
                    CreatedUtc = DateTime.UtcNow,
                });
            }

            var status = statusPlan[i];
            var invoice = new APInvoice
            {
                Id = Guid.NewGuid(),
                VendorId = vendor.Id,
                InvoiceNumber = $"AP-2026-{i + 1:0000}",
                InvoiceDate = invoiceDate,
                DueDate = dueDate,
                Status = status,
                TotalAmount = lines.Sum(x => x.Amount + (x.TaxAmount ?? 0m)),
                CreatedByUserId = accountant.Id.ToString(),
                CreatedUtc = DateTime.UtcNow.AddDays(-i),
                LastModifiedByUserId = accountant.Id.ToString(),
                LastModifiedUtc = DateTime.UtcNow.AddDays(-i),
            };

            foreach (var line in lines)
            {
                line.APInvoiceId = invoice.Id;
                invoice.Lines.Add(line);
            }

            invoices.Add(invoice);
        }

        // Ensure "paid" invoices were posted first; mark them paid after status mix is established.
        foreach (var paidInvoice in invoices.Where(x => x.Status == APInvoiceStatus.Paid))
        {
            paidInvoice.Status = APInvoiceStatus.Approved;
        }

        _dbContext.APInvoices.AddRange(invoices);
        await _dbContext.SaveChangesAsync();

        foreach (var paidInvoice in invoices.Where(x => x.InvoiceNumber is "AP-2026-0009" or "AP-2026-0010" or "AP-2026-0011" or "AP-2026-0012"))
        {
            paidInvoice.Status = APInvoiceStatus.Paid;
        }

        await _dbContext.SaveChangesAsync();
        return invoices;
    }

    private async Task<List<ARInvoice>> SeedARInvoicesAsync(List<Customer> customers, Dictionary<string, ChartOfAccount> accounts, ApplicationUser accountant)
    {
        if (await _dbContext.ARInvoices.AnyAsync())
        {
            return await _dbContext.ARInvoices
                .Include(x => x.Lines)
                .OrderBy(x => x.InvoiceNumber)
                .ToListAsync();
        }

        var revenueCodes = new[] { "4100", "4200", "4300", "4400" };
        var random = new Random(20260501);
        var invoices = new List<ARInvoice>();
        var statusPlan = new[]
        {
            ARInvoiceStatus.Draft, ARInvoiceStatus.Draft, ARInvoiceStatus.Sent,
            ARInvoiceStatus.Sent, ARInvoiceStatus.Sent, ARInvoiceStatus.Paid,
            ARInvoiceStatus.Paid, ARInvoiceStatus.Sent, ARInvoiceStatus.Draft,
            ARInvoiceStatus.Paid, ARInvoiceStatus.Sent, ARInvoiceStatus.Draft,
            ARInvoiceStatus.Sent, ARInvoiceStatus.Paid, ARInvoiceStatus.Sent,
        };

        for (var i = 0; i < 15; i++)
        {
            var customer = customers[i % customers.Count];
            var invoiceDate = new DateTime(2026, 3, 2).AddDays(i * 2);
            var dueDate = invoiceDate.AddDays(i % 3 == 0 ? 15 : 30);
            var lines = new List<ARInvoiceLine>();

            var lineCount = (i % 3 == 0) ? 2 : 3;
            for (var l = 0; l < lineCount; l++)
            {
                var qty = random.Next(1, 4);
                var unitPrice = random.Next(12_000, 50_000);
                var amount = qty * unitPrice;
                var tax = Math.Round(amount * 0.12m, 2);
                var code = revenueCodes[(i + l) % revenueCodes.Length];

                lines.Add(new ARInvoiceLine
                {
                    Id = Guid.NewGuid(),
                    ChartOfAccountId = accounts[code].Id,
                    Description = $"{accounts[code].Name} for {customer.Name}",
                    Quantity = qty,
                    UnitPrice = unitPrice,
                    Amount = amount,
                    TaxAmount = tax,
                    CreatedUtc = DateTime.UtcNow,
                });
            }

            var status = statusPlan[i];
            var invoice = new ARInvoice
            {
                Id = Guid.NewGuid(),
                CustomerId = customer.Id,
                InvoiceNumber = $"AR-2026-{i + 1:0000}",
                InvoiceDate = invoiceDate,
                DueDate = dueDate,
                Status = status,
                TotalAmount = lines.Sum(x => x.Amount + (x.TaxAmount ?? 0m)),
                CreatedByUserId = accountant.Id.ToString(),
                CreatedUtc = DateTime.UtcNow.AddDays(-i),
                LastModifiedByUserId = accountant.Id.ToString(),
                LastModifiedUtc = DateTime.UtcNow.AddDays(-i),
            };

            foreach (var line in lines)
            {
                line.ARInvoiceId = invoice.Id;
                invoice.Lines.Add(line);
            }

            invoices.Add(invoice);
        }

        // Ensure "paid" invoices were posted first; mark them paid afterwards.
        foreach (var paidInvoice in invoices.Where(x => x.Status == ARInvoiceStatus.Paid))
        {
            paidInvoice.Status = ARInvoiceStatus.Sent;
        }

        _dbContext.ARInvoices.AddRange(invoices);
        await _dbContext.SaveChangesAsync();

        foreach (var paidInvoice in invoices.Where(x => x.InvoiceNumber is "AR-2026-0006" or "AR-2026-0007" or "AR-2026-0010" or "AR-2026-0014"))
        {
            paidInvoice.Status = ARInvoiceStatus.Paid;
        }

        await _dbContext.SaveChangesAsync();
        return invoices;
    }
}
