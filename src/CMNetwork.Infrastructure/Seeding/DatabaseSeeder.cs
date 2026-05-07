using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Seeding;

public class DatabaseSeeder
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;

    private static readonly string[] Roles =
    [
        "super-admin", "accountant", "faculty-admin", "employee",
        "authorized-viewer", "auditor", "cfo"
    ];

    private static readonly Guid FinanceDeptId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid HrDeptId      = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid OpsDeptId     = Guid.Parse("10000000-0000-0000-0000-000000000003");

    public DatabaseSeeder(
        CMNetworkDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task SeedAsync()
    {
        // 1. Seed roles
        await EnsureRolesAsync();

        // 2. Seed demo users
        await SeedUserAsync(
            "super-admin@cmnetwork.com", "System", "Administrator",
            "Admin@CMN2026!", "super-admin", null);

        await SeedUserAsync(
            "accountant@cmnetwork.com", "John", "Accountant",
            "Acct@CMN2026!", "accountant", FinanceDeptId);

        await SeedUserAsync(
            "faculty-admin@cmnetwork.com", "Dr. Faculty", "Admin",
            "FacAdmin@CMN2026!", "faculty-admin", HrDeptId);

        await SeedUserAsync(
            "employee@cmnetwork.com", "Jane", "Employee",
            "Emp@CMN2026!", "employee", OpsDeptId);

        await SeedUserAsync(
            "viewer@cmnetwork.com", "Bob", "Viewer",
            "View@CMN2026!", "authorized-viewer", OpsDeptId);

        await SeedUserAsync(
            "auditor@cmnetwork.com", "Alice", "Auditor",
            "Aud@CMN2026!", "auditor", null);

        await SeedUserAsync(
            "cfo@cmnetwork.com", "Chief", "Financial Officer",
            "Cfo@CMN2026!", "cfo", FinanceDeptId);

        // 3. Seed baseline chart of accounts and fiscal period
        await SeedChartOfAccountsAsync();
        await SeedCurrentFiscalPeriodAsync();
    }

    public async Task EnsureRolesAsync()
    {
        foreach (var role in Roles)
        {
            if (!await _roleManager.RoleExistsAsync(role))
            {
                await _roleManager.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.NewGuid() });
            }
        }
    }

    public async Task SeedProductionBootstrapAdminAsync(IConfiguration configuration, ILogger logger)
    {
        await EnsureRolesAsync();

        var email = configuration["BootstrapAdmin:Email"];
        var password = configuration["BootstrapAdmin:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "Bootstrap admin credentials are not configured. Set BootstrapAdmin:Email and BootstrapAdmin:Password to create a production login on first deploy.");
            return;
        }

        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser is null)
        {
            var firstName = configuration["BootstrapAdmin:FirstName"] ?? "System";
            var lastName = configuration["BootstrapAdmin:LastName"] ?? "Administrator";

            var bootstrapUser = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                FirstName = firstName,
                LastName = lastName,
                IsActive = true,
                EmailConfirmed = true,
                JoinDate = DateOnly.FromDateTime(DateTime.UtcNow),
            };

            var createResult = await _userManager.CreateAsync(bootstrapUser, password);
            if (!createResult.Succeeded)
            {
                var errors = string.Join("; ", createResult.Errors.Select(error => error.Description));
                logger.LogError("Failed to create bootstrap admin {Email}: {Errors}", email, errors);
                return;
            }

            await _userManager.AddToRoleAsync(bootstrapUser, "super-admin");
            logger.LogInformation("Created bootstrap admin account {Email}.", email);
            return;
        }

        if (!await _userManager.IsInRoleAsync(existingUser, "super-admin"))
        {
            await _userManager.AddToRoleAsync(existingUser, "super-admin");
            logger.LogInformation("Assigned super-admin role to bootstrap account {Email}.", email);
        }
    }

    private async Task SeedChartOfAccountsAsync()
    {
        var existingCodes = await _dbContext.ChartOfAccounts
            .Select(x => x.AccountCode)
            .ToListAsync();

        var defaults = new[]
        {
            new { Code = "1000", Name = "Cash on Hand", Type = AccountType.Asset },
            new { Code = "1100", Name = "Accounts Receivable", Type = AccountType.Asset },
            new { Code = "1200", Name = "Supplies Inventory", Type = AccountType.Asset },
            new { Code = "2000", Name = "Accounts Payable", Type = AccountType.Liability },
            new { Code = "2100", Name = "Accrued Expenses", Type = AccountType.Liability },
            new { Code = "3000", Name = "Retained Earnings", Type = AccountType.Equity },
            new { Code = "4000", Name = "Service Revenue", Type = AccountType.Revenue },
            new { Code = "5000", Name = "Salaries Expense", Type = AccountType.Expense },
            new { Code = "5100", Name = "Utilities Expense", Type = AccountType.Expense }
        };

        foreach (var account in defaults)
        {
            if (existingCodes.Contains(account.Code, StringComparer.OrdinalIgnoreCase))
                continue;

            _dbContext.ChartOfAccounts.Add(new ChartOfAccount
            {
                Id = Guid.NewGuid(),
                AccountCode = account.Code,
                Name = account.Name,
                Type = account.Type,
                IsActive = true,
                CreatedUtc = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task SeedCurrentFiscalPeriodAsync()
    {
        var year = DateTime.UtcNow.Year;
        var name = $"FY {year}";

        var exists = await _dbContext.FiscalPeriods.AnyAsync(x => x.Name == name);
        if (exists)
            return;

        _dbContext.FiscalPeriods.Add(new FiscalPeriod
        {
            Id = Guid.NewGuid(),
            Name = name,
            StartDate = new DateOnly(year, 1, 1),
            EndDate = new DateOnly(year, 12, 31),
            IsClosed = false,
            CreatedUtc = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
    }

    private async Task SeedUserAsync(
        string email, string firstName, string lastName,
        string password, string role, Guid? departmentId)
    {
        if (await _userManager.FindByEmailAsync(email) is not null)
            return;

        var user = new ApplicationUser
        {
            Id            = Guid.NewGuid(),
            UserName      = email,
            Email         = email,
            FirstName     = firstName,
            LastName      = lastName,
            DepartmentId  = departmentId,
            IsActive      = true,
            EmailConfirmed = true,
            JoinDate      = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var result = await _userManager.CreateAsync(user, password);
        if (result.Succeeded)
            await _userManager.AddToRoleAsync(user, role);
    }
}
