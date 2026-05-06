using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace CMNetwork.Infrastructure.Persistence;

public class CMNetworkDesignTimeDbContextFactory : IDesignTimeDbContextFactory<CMNetworkDbContext>
{
    public CMNetworkDbContext CreateDbContext(string[] args)
    {
        var basePath = Path.Combine(Directory.GetCurrentDirectory(), "..", "CMNetwork.WebApi");

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=(localdb)\\MSSQLLocalDB;Database=CMNetwork;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";

        var optionsBuilder = new DbContextOptionsBuilder<CMNetworkDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new CMNetworkDbContext(optionsBuilder.Options);
    }
}
