using CMNetwork.Application;
using CMNetwork.Infrastructure.Data.Seeders;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Seeding;
using CMNetwork.Infrastructure.Services;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CMNetwork.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";

        // Some hosted SQL Server providers require explicit TCP + port (e.g., databaseasp.net) in Linux containers.
        connectionString = NormalizeSqlConnectionString(connectionString);

        services.AddApplication();

        services.AddDbContext<CMNetworkDbContext>(options =>
            options.UseSqlServer(connectionString));

        // ASP.NET Core Identity
        services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
        {
            options.Password.RequiredLength = 12;
            options.Password.RequiredUniqueChars = 4;
            options.Password.RequireUppercase = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireDigit = true;
            options.Password.RequireNonAlphanumeric = true;
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
        services.AddScoped<ICurrentCustomerService, CurrentCustomerService>();
        services.AddScoped<IAuditEventLogger, AuditEventLogger>();
        services.AddScoped<IAutoJournalService, AutoJournalService>();
        services.AddScoped<IIntegrationCredentialService, IntegrationCredentialService>();
        services.AddHttpClient<IPayMongoService, PayMongoService>();

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

    private static string NormalizeSqlConnectionString(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;

        try
        {
            var builder = new SqlConnectionStringBuilder(connectionString);
            var dataSource = builder.DataSource?.Trim();
            if (string.IsNullOrWhiteSpace(dataSource)) return connectionString;

            var isDatabaseAspHost = dataSource.Contains("databaseasp.net", StringComparison.OrdinalIgnoreCase);
            var hasPort = dataSource.Contains(',');
            var isExplicitTcp = dataSource.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase);

            if (isDatabaseAspHost && !hasPort)
            {
                var host = isExplicitTcp ? dataSource[4..] : dataSource;
                builder.DataSource = $"tcp:{host},1433";
                if (!builder.ContainsKey("Connect Timeout") || builder.ConnectTimeout < 30)
                {
                    builder.ConnectTimeout = 30;
                }
                return builder.ConnectionString;
            }
        }
        catch
        {
            // Keep original connection string when parsing fails.
        }

        return connectionString;
    }
}
