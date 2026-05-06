using System.Text;
using System.Threading.RateLimiting;
using System.Security.Claims;
using Audit.Core;
using CMNetwork.Infrastructure;
using CMNetwork.Infrastructure.Data.Seeders;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Seeding;
using CMNetwork.Middleware;
using CMNetwork.Services;
using CMNetwork.Infrastructure.Services;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using OfficeOpenXml;

var builder = WebApplication.CreateBuilder(args);

ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

builder.Configuration.AddEnvironmentVariables();

var jwtSecret   = builder.Configuration["Jwt:Secret"]   ?? "fallback-secret-key-change-in-production-here";
var jwtIssuer   = builder.Configuration["Jwt:Issuer"]   ?? "cmnetwork";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "cmnetwork-client";

// ── Services ─────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddControllersWithViews();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHangfireServer();

// JWT token service (used by IdentityAuthService)
builder.Services.AddScoped<JwtTokenService>();

// Replace mock auth with Identity-backed implementation
builder.Services.AddScoped<IAuthService, IdentityAuthService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IInvoicePostingService, InvoicePostingService>();
builder.Services.AddScoped<SystemMaintenanceJobs>();

// ── CORS ──────────────────────────────────────────────────────────────────────
var configuredCorsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
var allowedCorsOrigins = configuredCorsOrigins is { Length: > 0 }
    ? configuredCorsOrigins
    :
    [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://localhost:5173",
        "https://localhost:3000"
    ];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .WithOrigins(allowedCorsOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// ── JWT Authentication ────────────────────────────────────────────────────────
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey        = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer          = true,
        ValidIssuer             = jwtIssuer,
        ValidateAudience        = true,
        ValidAudience           = jwtAudience,
        ClockSkew               = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var userId = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                ?? context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                context.Fail("Token is missing subject claim.");
                return;
            }

            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByIdAsync(userId);

            if (user is null || !user.IsActive)
            {
                context.Fail("User account is inactive or no longer exists.");
            }
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("super-admin", "SuperAdmin");
    });
});

// ── Rate Limiting (login endpoint) ────────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", config =>
    {
        config.PermitLimit       = 10;
        config.Window            = TimeSpan.FromMinutes(1);
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit        = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// ── Build ──────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Audit.NET EF provider mapping ─────────────────────────────────────────────
// Ignore the AuditLogEntry table itself to prevent recursive auditing.
Audit.EntityFramework.Configuration.Setup()
    .ForContext<CMNetworkDbContext>(c => c.IncludeEntityObjects())
    .UseOptOut()
    .Ignore<AuditLogEntry>();

Configuration.Setup()
    .UseEntityFramework(config => config
        .AuditTypeMapper(_ => typeof(AuditLogEntry))
        .AuditEntityAction<AuditLogEntry>((auditEvent, eventEntry, auditEntity) =>
        {
            // Resolve current-user context from the active HTTP request, if any.
            string? userId = null, userEmail = null, ip = null, ua = null;
            try
            {
                var httpAccessor = app.Services.GetService<IHttpContextAccessor>();
                var ctx = httpAccessor?.HttpContext;
                if (ctx is not null)
                {
                    var user = ctx.User;
                    userId = user?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                          ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    userEmail = user?.FindFirst(JwtRegisteredClaimNames.Email)?.Value
                             ?? user?.FindFirst(ClaimTypes.Email)?.Value;
                    if (ctx.Request.Headers.TryGetValue("X-Forwarded-For", out var fwd) &&
                        !string.IsNullOrWhiteSpace(fwd))
                    {
                        ip = fwd.ToString().Split(',')[0].Trim();
                    }
                    else
                    {
                        ip = ctx.Connection.RemoteIpAddress?.ToString();
                    }
                    var uaHeader = ctx.Request.Headers.UserAgent.ToString();
                    if (!string.IsNullOrWhiteSpace(uaHeader)) ua = uaHeader;
                }
            }
            catch { /* best-effort enrichment only */ }

            // Determine PK of the affected record (string-serialised).
            var pk = eventEntry.PrimaryKey is { Count: > 0 }
                ? string.Join(",", eventEntry.PrimaryKey.Values)
                : null;

            auditEntity.Id             = Guid.NewGuid();
            auditEntity.EntityName     = eventEntry.EntityType?.Name ?? auditEvent.EventType ?? "Entity";
            auditEntity.Action         = eventEntry.Action ?? "SaveChanges";
            auditEntity.ActionCategory = AuditCategories.DataChange;
            auditEntity.RecordId       = pk;
            auditEntity.PerformedBy    = userId ?? userEmail ?? auditEvent.Environment?.UserName ?? "system";
            auditEntity.UserEmail      = userEmail;
            auditEntity.IpAddress      = ip;
            auditEntity.UserAgent      = ua is { Length: > 512 } ? ua[..512] : ua;
            auditEntity.DetailsJson    = auditEvent.ToJson();
            auditEntity.CreatedUtc     = DateTime.UtcNow;
        })
        .IgnoreMatchedProperties(true));

// ── Migrate & Seed ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db     = scope.ServiceProvider.GetRequiredService<CMNetworkDbContext>();
    var recurringJobManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    await db.Database.MigrateAsync();
    
    // Only seed demo data in Development environment
    if (app.Environment.IsDevelopment())
    {
        var seeder = scope.ServiceProvider.GetRequiredService<DemoDataSeeder>();
        await seeder.SeedAsync();
    }
    
    SystemMaintenanceJobs.RegisterRecurringJobs(recurringJobManager);
}

// ── Middleware Pipeline ───────────────────────────────────────────────────────
app.UseMiddleware<GlobalExceptionMiddleware>();

// Security headers
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"]        = "DENY";
    ctx.Response.Headers["X-XSS-Protection"]       = "1; mode=block";
    ctx.Response.Headers["Referrer-Policy"]        = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Permissions-Policy"]     = "camera=(), microphone=(), geolocation=()";
    if (!app.Environment.IsDevelopment())
        ctx.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseCors("AllowFrontend");
app.UseHttpsRedirection();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<ApiRequestLoggingMiddleware>();
app.UseHangfireDashboard("/hangfire");
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapStaticAssets();
app.MapControllers();
app.MapFallbackToFile("index.html");

await app.RunAsync();
