using CMNetwork.Application;
using CMNetwork.Infrastructure.Data.Seeders;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Seeding;
using CMNetwork.Infrastructure.Services;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CMNetwork.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var dbModeOverride = Environment.GetEnvironmentVariable("CMNETWORK_DB_MODE");

        var localConnectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";

        var monsterAspConnectionString = configuration.GetConnectionString("MonsterAspConnection");
        var useMonsterAsp = configuration.GetValue<bool>("Database:UseMonsterAsp");

        if (!string.IsNullOrWhiteSpace(dbModeOverride))
        {
            if (string.Equals(dbModeOverride, "MonsterAsp", StringComparison.OrdinalIgnoreCase))
            {
                useMonsterAsp = true;
            }
            else if (string.Equals(dbModeOverride, "Local", StringComparison.OrdinalIgnoreCase))
            {
                useMonsterAsp = false;
            }
        }

        var connectionString = useMonsterAsp && !string.IsNullOrWhiteSpace(monsterAspConnectionString)
            ? monsterAspConnectionString
            : localConnectionString;

        services.AddApplication();

        services.AddDbContext<CMNetworkDbContext>(options =>
            options.UseSqlServer(connectionString));

        // ASP.NET Core Identity
        services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
        {
            options.Password.RequiredLength = 8;
            options.Password.RequiredUniqueChars = 1;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireDigit = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
            options.User.RequireUniqueEmail = true;
            options.Tokens.AuthenticatorTokenProvider = TokenOptions.DefaultAuthenticatorProvider;
        })
        .AddEntityFrameworkStores<CMNetworkDbContext>()
        .AddDefaultTokenProviders();

        services.AddScoped<DatabaseSeeder>();
        services.AddScoped<DemoDataSeeder>();

        // ── Audit infrastructure ────────────────────────────────────────
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IAuditEventLogger, AuditEventLogger>();

        services.AddHangfire(config =>
            config
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings()
                .UseSqlServerStorage(connectionString, new SqlServerStorageOptions
                {
                    CommandBatchMaxTimeout = TimeSpan.FromMinutes(5),
                    SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
                    QueuePollInterval = TimeSpan.Zero,
                    UseRecommendedIsolationLevel = true,
                    DisableGlobalLocks = true
                }));

        return services;
    }
}
