using CMNetwork.Application.Services;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/customer")]
[Route("api/v1/customer")]
[Authorize(Roles = "customer")]
public class CustomerPortalController : ControllerBase
{
    private const string MissingCustomerMessage = "No customer record is linked to this account.";
    private const string IsoDateFormat = "yyyy-MM-dd";

    private readonly CMNetworkDbContext _dbContext;
    private readonly ICurrentCustomerService _currentCustomer;
    private readonly ICurrentUserService _currentUser;
    private readonly IPayMongoService _payMongoService;
    private readonly IAutoJournalService _autoJournalService;
    private readonly IConfiguration _configuration;
    private readonly UserManager<ApplicationUser> _userManager;
    private IMemoryCache MemoryCache => HttpContext.RequestServices.GetRequiredService<IMemoryCache>();

    public CustomerPortalController(
        CMNetworkDbContext dbContext,
        ICurrentCustomerService currentCustomer,
        ICurrentUserService currentUser,
        IPayMongoService payMongoService,
        IAutoJournalService autoJournalService,
        IConfiguration configuration,
        UserManager<ApplicationUser> userManager)
    {
        _dbContext = dbContext;
        _currentCustomer = currentCustomer;
        _currentUser = currentUser;
        _payMongoService = payMongoService;
        _autoJournalService = autoJournalService;
        _configuration = configuration;
        _userManager = userManager;
    }

    private async Task<Customer?> GetCurrentCustomerAsync()
    {
        // Compatibility fallback for old tokens without customerId claim.
        var email = User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue("email")
                    ?? User.Identity?.Name;

        try
        {
            if (_currentCustomer.CustomerId.HasValue)
            {
                return await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == _currentCustomer.CustomerId.Value);
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return await _dbContext.Customers
                .FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == email.ToLower());
        }
        catch
        {
            // In environments where new profile columns are not migrated yet,
            // EF entity materialization can fail. Fallback to a legacy-safe query.
            return await GetCurrentCustomerLegacySafeAsync(_currentCustomer.CustomerId, email);
        }
    }

    private async Task<Customer?> GetCurrentCustomerLegacySafeAsync(Guid? customerId, string? email)
    {
        var legacySafeQuery = _dbContext.Customers.FromSqlRaw(@"
SELECT
    Id,
    CustomerCode,
    Name,
    CAST(NULL AS nvarchar(64)) AS FirstName,
    CAST(NULL AS nvarchar(64)) AS MiddleName,
    CAST(NULL AS nvarchar(64)) AS LastName,
    CAST(NULL AS date) AS BirthDate,
    CAST(NULL AS int) AS Age,
    CAST(NULL AS nvarchar(16)) AS Gender,
    CAST(NULL AS nvarchar(32)) AS MaritalStatus,
    ContactPerson,
    Email,
    PhoneNumber,
    Address,
    City,
    [State],
    PostalCode,
    Country,
    TaxId,
    PaymentTerms,
    CreditLimit,
    IsActive,
    CreatedUtc,
    LastUpdatedUtc,
    RegistrationOtp,
    RegistrationOtpGeneratedUtc,
    RegistrationOtpVerified,
    CAST(NULL AS nvarchar(32)) AS TIN,
    CAST(NULL AS nvarchar(32)) AS SSS,
    CAST(NULL AS nvarchar(128)) AS BankAccount,
    CAST(NULL AS nvarchar(128)) AS BankName,
    CAST(0 AS int) AS BankVerificationStatus,
    CAST(NULL AS datetime2) AS BankVerifiedAtUtc
FROM Customers");

        if (customerId.HasValue)
        {
            return await legacySafeQuery.FirstOrDefaultAsync(c => c.Id == customerId.Value);
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        return await legacySafeQuery
            .FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == email.ToLower());
    }

    private async Task<bool> HasExtendedCustomerProfileColumnsAsync()
    {
        return await MemoryCache.GetOrCreateAsync("customer:extended-profile-columns:v1", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            try
            {
                var query = @"
SELECT CASE
    WHEN COL_LENGTH('Customers', 'TIN') IS NOT NULL
     AND COL_LENGTH('Customers', 'SSS') IS NOT NULL
     AND COL_LENGTH('Customers', 'BankAccount') IS NOT NULL
     AND COL_LENGTH('Customers', 'BankName') IS NOT NULL
     AND COL_LENGTH('Customers', 'BankVerificationStatus') IS NOT NULL
    THEN 1 ELSE 0 END";

                var hasColumns = await _dbContext.Database.SqlQueryRaw<int>(query).SingleAsync();
                return hasColumns == 1;
            }
            catch
            {
                return false;
            }
        });
    }

    private async Task<bool> HasDemographicCustomerProfileColumnsAsync()
    {
        return await MemoryCache.GetOrCreateAsync("customer:demographic-profile-columns:v1", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            try
            {
                var query = @"
SELECT CASE
    WHEN COL_LENGTH('Customers', 'BirthDate') IS NOT NULL
     AND COL_LENGTH('Customers', 'Age') IS NOT NULL
     AND COL_LENGTH('Customers', 'Gender') IS NOT NULL
     AND COL_LENGTH('Customers', 'MaritalStatus') IS NOT NULL
    THEN 1 ELSE 0 END";

                var hasColumns = await _dbContext.Database.SqlQueryRaw<int>(query).SingleAsync();
                return hasColumns == 1;
            }
            catch
            {
                return false;
            }
        });
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .ToListAsync();

        var outstandingBalance = invoices
            .Where(inv => inv.Status is not ARInvoiceStatus.Paid and not ARInvoiceStatus.Void)
            .Sum(inv => inv.TotalAmount);

        var overdueAmount = invoices
            .Where(inv => inv.Status is not ARInvoiceStatus.Paid and not ARInvoiceStatus.Void && inv.DueDate < DateTime.UtcNow)
            .Sum(inv => inv.TotalAmount);

        var lastPaymentDate = await _dbContext.CustomerPayments
            .Where(x => x.CustomerId == customer.Id && x.Status == CustomerPaymentStatus.Completed)
            .OrderByDescending(x => x.CompletedAt)
            .Select(x => x.CompletedAt)
            .FirstOrDefaultAsync();

        return Ok(new
        {
            customerName = customer.Name,
            customerCode = customer.CustomerCode,
            outstandingBalance,
            overdueAmount,
            lastPaymentDate,
            invoiceCount = invoices.Count,
            recentInvoices = invoices.Take(5).Select(inv => new
            {
                inv.Id,
                inv.InvoiceNumber,
                inv.InvoiceDate,
                inv.DueDate,
                inv.TotalAmount,
                status = inv.Status.ToString(),
            })
        });
    }

    /// <summary>Returns all AR invoices for the authenticated customer.</summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> GetMyInvoices()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .Select(inv => new
            {
                inv.Id,
                inv.InvoiceNumber,
                InvoiceDate = inv.InvoiceDate.ToString(IsoDateFormat),
                DueDate = inv.DueDate.ToString(IsoDateFormat),
                inv.TotalAmount,
                Status = inv.Status.ToString(),
            })
            .ToListAsync();

        return Ok(new
        {
            customerName = customer.Name,
            customerCode = customer.CustomerCode,
            invoices,
        });
    }

    [HttpGet("invoices/{id:guid}")]
    public async Task<IActionResult> GetMyInvoice(Guid id)
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoice = await _dbContext.ARInvoices
            .Include(x => x.Lines)
            .ThenInclude(x => x.Account)
            .FirstOrDefaultAsync(inv => inv.Id == id && inv.CustomerId == customer.Id && !inv.IsDeleted);

        if (invoice is null)
        {
            return NotFound(new { message = "Invoice not found." });
        }

        return Ok(new
        {
            invoice.Id,
            invoice.InvoiceNumber,
            InvoiceDate = invoice.InvoiceDate.ToString(IsoDateFormat),
            DueDate = invoice.DueDate.ToString(IsoDateFormat),
            invoice.TotalAmount,
            Status = invoice.Status.ToString(),
            Lines = invoice.Lines.Select(line => new
            {
                line.Id,
                line.Description,
                line.Quantity,
                line.UnitPrice,
                line.Amount,
                line.TaxAmount,
                AccountCode = line.Account.AccountCode,
                AccountName = line.Account.Name,
            })
        });
    }

    [HttpGet("payments")]
    public async Task<IActionResult> GetMyPayments()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var payments = await _dbContext.CustomerPayments
            .Where(x => x.CustomerId == customer.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.Amount,
                Status = x.Status.ToString(),
                x.PayMongoCheckoutSessionId,
                x.CreatedAt,
                x.CompletedAt,
                x.InvoiceIds,
            })
            .ToListAsync();

        return Ok(payments);
    }

    [HttpPost("payments/intent")]
    public async Task<IActionResult> CreatePaymentIntent(
        [FromBody] CreatePaymentIntentRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        if (request.InvoiceIds.Count == 0)
        {
            return BadRequest(new { message = "At least one invoice must be selected." });
        }

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => request.InvoiceIds.Contains(inv.Id)
                          && inv.CustomerId == customer.Id
                          && !inv.IsDeleted
                          && inv.Status != ARInvoiceStatus.Paid
                          && inv.Status != ARInvoiceStatus.Void)
            .ToListAsync();

        if (invoices.Count == 0)
        {
            return BadRequest(new { message = "No valid unpaid invoices found for this customer." });
        }

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existing = await _dbContext.CustomerPayments
                .Where(x => x.CustomerId == customer.Id && x.IdempotencyKey == idempotencyKey)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            if (existing is not null)
            {
                return Ok(new
                {
                    paymentId = existing.Id,
                    checkoutSessionId = existing.PayMongoCheckoutSessionId,
                    redirectUrl = existing.CheckoutUrl,
                    amount = existing.Amount,
                    reused = true,
                });
            }
        }

        var total = request.Amount > 0 ? request.Amount : invoices.Sum(x => x.TotalAmount);
        var description = $"CMNetwork payment for {invoices.Count} invoice(s): {string.Join(", ", invoices.Select(x => x.InvoiceNumber))}";
        var appBaseUrl = _configuration["AppBaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
        var successUrl = $"{appBaseUrl}/module/customer-portal?payment=success&refId={{CHECKOUT_SESSION_ID}}";
        var cancelUrl = $"{appBaseUrl}/module/customer-portal?payment=cancel";

        var checkout = await _payMongoService.CreateCheckoutSessionAsync(total, description, successUrl, cancelUrl);

        var payment = new CustomerPayment
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            Amount = total,
            Status = CustomerPaymentStatus.AwaitingPayment,
            PayMongoCheckoutSessionId = checkout.CheckoutSessionId,
            IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey,
            CheckoutUrl = checkout.CheckoutUrl,
            InvoiceIds = string.Join(',', invoices.Select(x => x.Id)),
            CreatedByUserId = _currentUser.UserId ?? "system",
            CreatedAt = DateTime.UtcNow,
        };

        _dbContext.CustomerPayments.Add(payment);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            paymentId = payment.Id,
            checkoutSessionId = checkout.CheckoutSessionId,
            redirectUrl = checkout.CheckoutUrl,
            amount = total,
        });
    }

    [HttpPost("payments/confirm")]
    public async Task<IActionResult> ConfirmPayment([FromQuery] string refId)
    {
        if (string.IsNullOrWhiteSpace(refId))
        {
            return BadRequest(new { message = "Missing checkout session reference." });
        }

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var payment = await _dbContext.CustomerPayments
            .FirstOrDefaultAsync(x => x.PayMongoCheckoutSessionId == refId && x.CustomerId == customer.Id);

        if (payment is null)
        {
            return NotFound(new { message = "Payment record not found." });
        }

        if (payment.Status == CustomerPaymentStatus.Completed)
        {
            return Ok(new { message = "Payment already completed.", paymentId = payment.Id });
        }

        var status = await _payMongoService.GetCheckoutSessionStatusAsync(refId);
        if (!string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = $"Payment is not completed yet (status: {status})." });
        }

        await ApplyCompletedPaymentAsync(payment);

        return Ok(new { message = "Payment confirmed and applied.", paymentId = payment.Id });
    }

    private async Task ApplyCompletedPaymentAsync(CustomerPayment payment)
    {
        if (payment.Status == CustomerPaymentStatus.Completed)
        {
            return;
        }

        await using var tx = await _dbContext.Database.BeginTransactionAsync();

        var invoiceIds = payment.InvoiceIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(value => Guid.TryParse(value, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        var invoices = await _dbContext.ARInvoices
            .Where(x => invoiceIds.Contains(x.Id) && !x.IsDeleted)
            .ToListAsync();

        foreach (var invoice in invoices)
        {
            invoice.Status = ARInvoiceStatus.Paid;
        }

        payment.Status = CustomerPaymentStatus.Completed;
        payment.CompletedAt = DateTime.UtcNow;

        await _autoJournalService.PostCustomerCashReceiptAsync(
            payment.Amount,
            $"Customer payment via PayMongo for {invoices.Count} invoice(s)",
            payment.PayMongoCheckoutSessionId ?? payment.Id.ToString(),
            payment.CreatedByUserId);

        await _dbContext.SaveChangesAsync();
        await tx.CommitAsync();
    }

    /// <summary>Returns a PDF account statement for the authenticated customer.</summary>
    [HttpGet("statement")]
    public async Task<IActionResult> GetStatement()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var invoices = await _dbContext.ARInvoices
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .ToListAsync();

        var pdf = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("CMNetwork ERP").Bold().FontSize(18);
                    col.Item().Text("Account Statement").FontSize(13).FontColor(Colors.Grey.Darken2);
                    col.Item().PaddingTop(6).Text($"Customer: {customer.Name} ({customer.CustomerCode})");
                    col.Item().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC");
                });

                page.Content().PaddingTop(16).Table(table =>
                {
                    table.ColumnsDefinition(cols =>
                    {
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                        cols.RelativeColumn(2);
                    });

                    // Header row
                    static IContainer CellStyle(IContainer c) =>
                        c.BorderBottom(1).BorderColor(Colors.Grey.Lighten1).PaddingVertical(4).PaddingHorizontal(4);

                    table.Header(header =>
                    {
                        header.Cell().Element(CellStyle).Text("Invoice #").Bold();
                        header.Cell().Element(CellStyle).Text("Date").Bold();
                        header.Cell().Element(CellStyle).Text("Due Date").Bold();
                        header.Cell().Element(CellStyle).AlignRight().Text("Amount").Bold();
                        header.Cell().Element(CellStyle).AlignCenter().Text("Status").Bold();
                    });

                    foreach (var inv in invoices)
                    {
                        table.Cell().Element(CellStyle).Text(inv.InvoiceNumber);
                        table.Cell().Element(CellStyle).Text(inv.InvoiceDate.ToString(IsoDateFormat));
                        table.Cell().Element(CellStyle).Text(inv.DueDate.ToString(IsoDateFormat));
                        table.Cell().Element(CellStyle).AlignRight().Text($"₱{inv.TotalAmount:N2}");
                        table.Cell().Element(CellStyle).AlignCenter().Text(inv.Status.ToString());
                    }
                });

                var totalOutstanding = invoices
                    .Where(i => i.Status != ARInvoiceStatus.Paid && i.Status != ARInvoiceStatus.Void)
                    .Sum(i => i.TotalAmount);

                page.Content().PaddingTop(4).AlignRight()
                    .Text($"Outstanding Balance: ₱{totalOutstanding:N2}")
                    .Bold().FontSize(11);

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();

        return File(pdf, "application/pdf",
            $"statement-{customer.CustomerCode}-{DateTime.UtcNow:yyyyMMdd}.pdf");
    }

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var hasExtendedColumns = await HasExtendedCustomerProfileColumnsAsync();
        var hasDemographicColumns = await HasDemographicCustomerProfileColumnsAsync();

        return Ok(new
        {
            id = customer.Id,
            firstName = customer.ContactPerson ?? string.Empty,
            lastName = customer.Name,
            email = customer.Email,
            phoneNumber = customer.PhoneNumber,
            companyName = customer.Name,
            address = customer.Address,
            city = customer.City,
            state = customer.State,
            country = customer.Country,
            postalCode = customer.PostalCode,
            zipCode = customer.PostalCode,
            birthDate = hasDemographicColumns ? customer.BirthDate : null,
            age = hasDemographicColumns ? customer.Age : null,
            gender = hasDemographicColumns ? customer.Gender : null,
            maritalStatus = hasDemographicColumns ? customer.MaritalStatus : null,
            tin = hasExtendedColumns ? customer.TIN : null,
            sss = hasExtendedColumns ? customer.SSS : null,
            bankAccount = hasExtendedColumns ? customer.BankAccount : null,
            bankName = hasExtendedColumns ? customer.BankName : null,
            bankVerificationStatus = hasExtendedColumns ? customer.BankVerificationStatus.ToString() : BankVerificationStatus.NotVerified.ToString(),
            bankVerifiedAtUtc = hasExtendedColumns ? customer.BankVerifiedAtUtc : null
        });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateCustomerProfileRequest request)
    {
        var hasExtendedColumns = await HasExtendedCustomerProfileColumnsAsync();
        var hasDemographicColumns = await HasDemographicCustomerProfileColumnsAsync();

        // On legacy schemas, extended columns do not exist yet.
        // Ignore extended field validation so profile updates do not fail with 400.
        if (!hasExtendedColumns)
        {
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.TIN));
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.SSS));
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.BankAccount));
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.BankName));
        }

        if (!hasDemographicColumns)
        {
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.BirthDate));
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.Age));
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.Gender));
            ModelState.Remove(nameof(UpdateCustomerProfileRequest.MaritalStatus));
        }

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        if (!string.IsNullOrWhiteSpace(request.FirstName))
            customer.ContactPerson = request.FirstName;

        if (!string.IsNullOrWhiteSpace(request.LastName))
            customer.Name = request.LastName;

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
            customer.PhoneNumber = request.PhoneNumber;

        if (!string.IsNullOrWhiteSpace(request.Address))
            customer.Address = request.Address;

        if (!string.IsNullOrWhiteSpace(request.City))
            customer.City = request.City;

        if (!string.IsNullOrWhiteSpace(request.State))
            customer.State = request.State;

        if (!string.IsNullOrWhiteSpace(request.Country))
            customer.Country = request.Country;

        var postalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? request.ZipCode : request.PostalCode;
        if (!string.IsNullOrWhiteSpace(postalCode))
            customer.PostalCode = postalCode;

        if (hasDemographicColumns)
        {
            if (request.BirthDate.HasValue)
                customer.BirthDate = request.BirthDate.Value;

            if (request.Age.HasValue)
                customer.Age = request.Age.Value;

            if (!string.IsNullOrWhiteSpace(request.Gender))
                customer.Gender = request.Gender;

            if (!string.IsNullOrWhiteSpace(request.MaritalStatus))
                customer.MaritalStatus = request.MaritalStatus;
        }

        if (hasExtendedColumns)
        {
            if (request.TIN is not null)
                customer.TIN = string.IsNullOrWhiteSpace(request.TIN) ? null : request.TIN;

            if (request.SSS is not null)
                customer.SSS = string.IsNullOrWhiteSpace(request.SSS) ? null : request.SSS;

            if (request.BankAccount is not null)
                customer.BankAccount = string.IsNullOrWhiteSpace(request.BankAccount) ? null : request.BankAccount;

            if (request.BankName is not null)
                customer.BankName = string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName;

        }

        customer.LastUpdatedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            id = customer.Id,
            firstName = customer.ContactPerson ?? string.Empty,
            lastName = customer.Name,
            email = customer.Email,
            phoneNumber = customer.PhoneNumber,
            companyName = customer.Name,
            address = customer.Address,
            city = customer.City,
            state = customer.State,
            country = customer.Country,
            postalCode = customer.PostalCode,
            zipCode = customer.PostalCode,
            birthDate = hasDemographicColumns ? customer.BirthDate : null,
            age = hasDemographicColumns ? customer.Age : null,
            gender = hasDemographicColumns ? customer.Gender : null,
            maritalStatus = hasDemographicColumns ? customer.MaritalStatus : null,
            tin = hasExtendedColumns ? customer.TIN : null,
            sss = hasExtendedColumns ? customer.SSS : null,
            bankAccount = hasExtendedColumns ? customer.BankAccount : null,
            bankName = hasExtendedColumns ? customer.BankName : null,
            bankVerificationStatus = hasExtendedColumns ? customer.BankVerificationStatus.ToString() : BankVerificationStatus.NotVerified.ToString(),
            bankVerifiedAtUtc = hasExtendedColumns ? customer.BankVerifiedAtUtc : null,
            message = hasExtendedColumns
                ? "Profile updated successfully"
                : hasDemographicColumns
                    ? "Profile updated. TIN/SSS/Bank fields will be available after database migration."
                    : "Profile updated. Demographic and extended profile fields will be available after database migration."
        });
    }

    [HttpGet("loan-access-check")]
    public async Task<IActionResult> CheckLoanAccess()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var hasExtendedColumns = await HasExtendedCustomerProfileColumnsAsync();

        var profileFields = new[]
        {
            customer.ContactPerson, customer.Email, customer.PhoneNumber,
            customer.Address, customer.City, customer.State, customer.Country,
            customer.PostalCode,
            hasExtendedColumns ? customer.TIN : null,
            hasExtendedColumns ? customer.SSS : null,
            hasExtendedColumns ? customer.BankAccount : null,
            hasExtendedColumns ? customer.BankName : null
        };

        var filledCount = profileFields.Count(f => !string.IsNullOrWhiteSpace(f));
        var completionPercentage = (int)Math.Round((filledCount / (double)profileFields.Length) * 100);
        var isBankVerified = hasExtendedColumns && customer.BankVerificationStatus == BankVerificationStatus.Verified;
        var canAccessLoans = completionPercentage >= 80 && isBankVerified;

        return Ok(new LoanAccessCheckResponse
        {
            CanAccessLoans = canAccessLoans,
            ProfileCompletionPercentage = completionPercentage,
            IsBankVerified = isBankVerified,
            Message = canAccessLoans
                ? "Your profile is complete and bank is verified. Loan access is enabled."
                : completionPercentage < 80
                    ? $"Complete {100 - completionPercentage}% more of your profile to unlock loan access."
                    : "Bank verification is required to access loans. Please verify your bank account."
        });
    }

    [HttpGet("profile-schema-health")]
    public async Task<IActionResult> GetProfileSchemaHealth()
    {
        var hasExtendedColumns = await HasExtendedCustomerProfileColumnsAsync();
        var hasDemographicColumns = await HasDemographicCustomerProfileColumnsAsync();

        return Ok(new
        {
            schema = hasExtendedColumns && hasDemographicColumns
                ? "extended"
                : hasDemographicColumns
                    ? "demographic-only"
                    : "legacy",
            hasExtendedProfileColumns = hasExtendedColumns,
            hasDemographicProfileColumns = hasDemographicColumns,
            requiredExtendedColumns = new[]
            {
                "TIN",
                "SSS",
                "BankAccount",
                "BankName",
                "BankVerificationStatus"
            },
            requiredDemographicColumns = new[]
            {
                "BirthDate",
                "Age",
                "Gender",
                "MaritalStatus"
            },
            guidance = hasExtendedColumns && hasDemographicColumns
                ? "Profile and loan-gating schema is in sync."
                : hasDemographicColumns
                    ? "Demographic fields are enabled. Apply migration 20260518_AddProfileCompletionAndLoanAccess to enable TIN/SSS/Bank fields and full loan gating."
                    : "DB is running legacy Customers schema. Apply migrations for demographic and extended profile columns.",
            checkedAtUtc = DateTime.UtcNow
        });
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (string.IsNullOrWhiteSpace(request.OldPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { message = "Old password and new password are required." });

        if (request.OldPassword == request.NewPassword)
            return BadRequest(new { message = "New password must be different from the old password." });

        var user = await _userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized(new { message = "User not found." });

        var result = await _userManager.ChangePasswordAsync(user, request.OldPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { message = $"Password change failed: {errors}" });
        }

        return Ok(new { message = "Password changed successfully" });
    }

    [HttpGet("budgets")]
    public async Task<IActionResult> GetBudgets()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var spentAmount = await _dbContext.ARInvoices
            .AsNoTracking()
            .Where(inv => inv.CustomerId == customer.Id && !inv.IsDeleted && inv.Status != ARInvoiceStatus.Void)
            .SumAsync(inv => (decimal?)inv.TotalAmount) ?? 0m;

        var now = DateTime.UtcNow;
        var budget = new
        {
            id = customer.Id,
            name = $"{customer.Name} Credit Budget",
            allocatedAmount = customer.CreditLimit,
            spentAmount,
            remainingAmount = customer.CreditLimit - spentAmount,
            startDate = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            endDate = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1).AddDays(-1),
            status = spentAmount <= customer.CreditLimit ? "OnTrack" : "Exceeded"
        };

        return Ok(new { budgets = new[] { budget } });
    }

    [HttpPost("budgets/adjustment-request")]
    [HttpPost("budgets/request-adjustment")]
    public async Task<IActionResult> RequestBudgetAdjustment([FromBody] RequestBudgetAdjustmentRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        if (request.RequestedAmount <= 0)
            return BadRequest(new { message = "Requested amount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 10)
            return BadRequest(new { message = "Reason must be at least 10 characters." });

        var requestId = Guid.NewGuid();
        var requestNumber = $"BAR-{DateTime.UtcNow:yyyyMMdd}-{requestId.ToString().Substring(0, 8)}";

        var adjustmentRequest = new CMNetwork.Domain.Entities.CustomerBudgetAdjustmentRequest
        {
            Id = requestId,
            RequestNumber = requestNumber,
            CustomerId = customer.Id,
            BudgetId = request.BudgetId,
            BudgetName = request.BudgetId.ToString(),
            RequestedAmount = request.RequestedAmount,
            Reason = request.Reason,
            Status = CMNetwork.Domain.Entities.BudgetAdjustmentStatus.Pending,
            RequestedAtUtc = DateTime.UtcNow
        };

        _dbContext.CustomerBudgetAdjustmentRequests.Add(adjustmentRequest);
        await _dbContext.SaveChangesAsync();

        return Ok(new { requestId, requestNumber });
    }

    [HttpGet("budgets/adjustment-requests")]
    public async Task<IActionResult> GetBudgetAdjustmentRequests()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var requests = await _dbContext.CustomerBudgetAdjustmentRequests
            .Where(r => r.CustomerId == customer.Id)
            .OrderByDescending(r => r.RequestedAtUtc)
            .Select(r => new
            {
                r.Id,
                r.RequestNumber,
                r.BudgetName,
                r.RequestedAmount,
                r.Reason,
                Status = r.Status.ToString(),
                r.RequestedAtUtc,
                r.ApprovedAtUtc,
                r.DecisionNotes
            })
            .ToListAsync();

        return Ok(new { requests });
    }

    [HttpGet("expense-claims")]
    public async Task<IActionResult> GetExpenseClaims()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var claims = await _dbContext.ExpenseClaims
            .AsNoTracking()
            .Where(c => c.EmployeeId == customer.Id)
            .OrderByDescending(c => c.CreatedAtUtc)
            .Select(c => new
            {
                c.Id,
                c.ClaimNumber,
                c.Description,
                c.Amount,
                c.Category,
                SubmittedDate = c.SubmittedAtUtc,
                Status = c.Status.ToString(),
                c.ReviewedAtUtc,
                c.ReviewNotes
            })
            .ToListAsync();

        return Ok(new { claims });
    }

    [HttpPost("expense-claims/submit")]
    public async Task<IActionResult> SubmitExpenseClaim([FromBody] SubmitExpenseClaimRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        if (request.Amount <= 0)
            return BadRequest(new { message = "Amount must be greater than zero." });

        if (request.Amount > 10_000_000)
            return BadRequest(new { message = "Amount exceeds allowed maximum." });

        if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Trim().Length < 5)
            return BadRequest(new { message = "Description must be at least 5 characters." });

        if (string.IsNullOrWhiteSpace(request.Category))
            return BadRequest(new { message = "Category is required." });

        var claimNumber = $"EC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 8)}";

        var claim = new CMNetwork.Domain.Entities.ExpenseClaim
        {
            Id = Guid.NewGuid(),
            ClaimNumber = claimNumber,
            EmployeeId = customer.Id,
            EmployeeName = customer.Name,
            ClaimDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Category = request.Category,
            Description = request.Description,
            Amount = request.Amount,
            MerchantName = request.MerchantName,
            ProjectCode = request.ProjectCode,
            ReceiptUrl = request.ReceiptUrl,
            Status = CMNetwork.Domain.Entities.ExpenseClaimStatus.Submitted,
            SubmittedAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.ExpenseClaims.Add(claim);
        await _dbContext.SaveChangesAsync();

        return Ok(new { claimId = claim.Id, claimNumber });
    }

    [HttpGet("support/tickets")]
    public async Task<IActionResult> GetSupportTickets()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var tickets = await _dbContext.SupportTickets
            .Where(t => t.CustomerId == customer.Id)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new
            {
                t.Id,
                t.TicketNumber,
                t.Subject,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                CreatedDate = t.CreatedAtUtc,
                t.ResolvedAtUtc
            })
            .ToListAsync();

        return Ok(new { tickets });
    }

    [HttpPost("support/tickets")]
    [HttpPost("support/tickets/create")]
    public async Task<IActionResult> CreateSupportTicket([FromBody] CreateSupportTicketRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { message = "Subject and description are required." });

        if (request.Subject.Trim().Length < 5 || request.Subject.Trim().Length > 256)
            return BadRequest(new { message = "Subject must be between 5 and 256 characters." });

        if (request.Description.Trim().Length < 10 || request.Description.Trim().Length > 2048)
            return BadRequest(new { message = "Description must be between 10 and 2048 characters." });

        var priority = request.Priority switch
        {
            "Low" => CMNetwork.Domain.Entities.SupportTicketPriority.Low,
            "Medium" => CMNetwork.Domain.Entities.SupportTicketPriority.Medium,
            "High" => CMNetwork.Domain.Entities.SupportTicketPriority.High,
            "Urgent" => CMNetwork.Domain.Entities.SupportTicketPriority.Urgent,
            _ => CMNetwork.Domain.Entities.SupportTicketPriority.Medium
        };

        var ticketNumber = $"TKT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 8)}";

        var ticket = new CMNetwork.Domain.Entities.SupportTicket
        {
            Id = Guid.NewGuid(),
            TicketNumber = ticketNumber,
            CustomerId = customer.Id,
            Subject = request.Subject,
            Description = request.Description,
            Status = CMNetwork.Domain.Entities.SupportTicketStatus.Open,
            Priority = priority,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.SupportTickets.Add(ticket);
        await _dbContext.SaveChangesAsync();

        return Ok(new { ticketId = ticket.Id, ticketNumber });
    }

    [HttpGet("support/faqs")]
    public async Task<IActionResult> GetFAQs()
    {
        var faqs = await MemoryCache.GetOrCreateAsync("customer:faqs:active", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            entry.SlidingExpiration = TimeSpan.FromMinutes(2);
            return await _dbContext.FAQs
                .AsNoTracking()
                .Where(f => f.IsActive)
                .OrderBy(f => f.Category)
                .ThenBy(f => f.DisplayOrder)
                .Select(f => new
                {
                    f.Id,
                    f.Question,
                    f.Answer,
                    f.Category,
                    f.DisplayOrder
                })
                .ToListAsync();
        });

        return Ok(new { faqs });
    }

    [HttpGet("approvals/pending")]
    public async Task<IActionResult> GetPendingApprovals()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        try
        {
            var approvals = await _dbContext.CustomerBudgetAdjustmentRequests
                .AsNoTracking()
                .Where(r => r.CustomerId == customer.Id && r.Status == BudgetAdjustmentStatus.Pending)
                .Select(r => new
                {
                    r.Id,
                    Title = $"Budget Adjustment Request: {r.BudgetName}",
                    Description = r.Reason,
                    Type = "Budget Adjustment",
                    Status = r.Status.ToString(),
                    SubmittedDate = r.RequestedAtUtc,
                    r.ApprovedAtUtc
                })
                .OrderByDescending(r => r.SubmittedDate)
                .ToListAsync();

            return Ok(new { approvals });
        }
        catch
        {
            return Ok(new { approvals = Array.Empty<object>() });
        }
    }

    [HttpGet("approvals/approved")]
    public async Task<IActionResult> GetApprovedRequests()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        try
        {
            var approvals = await _dbContext.CustomerBudgetAdjustmentRequests
                .AsNoTracking()
                .Where(r => r.CustomerId == customer.Id && r.Status == BudgetAdjustmentStatus.Approved)
                .Select(r => new
                {
                    r.Id,
                    Title = $"Budget Adjustment Request: {r.BudgetName}",
                    Description = r.Reason,
                    Type = "Budget Adjustment",
                    Status = r.Status.ToString(),
                    SubmittedDate = r.RequestedAtUtc,
                    r.ApprovedAtUtc
                })
                .OrderByDescending(r => r.ApprovedAtUtc)
                .ToListAsync();

            return Ok(new { approvals });
        }
        catch
        {
            return Ok(new { approvals = Array.Empty<object>() });
        }
    }

    [HttpGet("reports")]
    [HttpGet("reports/financial")]
    public async Task<IActionResult> GetFinancialReports()
    {
        var customer = await GetCurrentCustomerAsync();
        if (customer is null)
        {
            return NotFound(new { message = MissingCustomerMessage });
        }

        var cacheKey = $"customer:reports:{customer.Id}";
        var reports = await MemoryCache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
            entry.SlidingExpiration = TimeSpan.FromMinutes(1);

            var generatedDate = DateTime.UtcNow;
            var result = new List<object>();

            var invoiceCount = await _dbContext.ARInvoices
                .AsNoTracking()
                .Where(i => i.CustomerId == customer.Id && !i.IsDeleted)
                .CountAsync();

            var totalAmount = await _dbContext.ARInvoices
                .AsNoTracking()
                .Where(i => i.CustomerId == customer.Id && !i.IsDeleted)
                .SumAsync(i => (decimal?)i.TotalAmount) ?? 0m;

            if (invoiceCount > 0)
            {
                result.Add(new
                {
                    reportName = "Invoice Summary",
                    reportType = "Summary",
                    generatedDate,
                    description = $"Total of {invoiceCount} invoices amounting to ₱{totalAmount:N2}"
                });
            }

            var paymentCount = await _dbContext.CustomerPayments
                .AsNoTracking()
                .Where(p => p.CustomerId == customer.Id)
                .CountAsync();

            var completedPayments = await _dbContext.CustomerPayments
                .AsNoTracking()
                .Where(p => p.CustomerId == customer.Id && p.Status == CustomerPaymentStatus.Completed)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            if (paymentCount > 0)
            {
                result.Add(new
                {
                    reportName = "Payment History",
                    reportType = "Payment",
                    generatedDate,
                    description = $"Total of {paymentCount} payment transactions, ₱{completedPayments:N2} completed"
                });
            }

            return result;
        });

        return Ok(new { reports });
    }
}

public sealed class CreatePaymentIntentRequest
{
    [Required]
    [MinLength(1)]
    public List<Guid> InvoiceIds { get; set; } = [];

    [Range(0.01, 100000000)]
    public decimal Amount { get; set; }
}

public sealed class RequestBudgetAdjustmentRequest
{
    public Guid BudgetId { get; set; }

    [Range(0.01, 100000000)]
    public decimal RequestedAmount { get; set; }

    [Required]
    [StringLength(1024, MinimumLength = 10)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class SubmitExpenseClaimRequest
{
    [Required]
    [StringLength(1000, MinimumLength = 5)]
    public string Description { get; set; } = string.Empty;

    [Range(0.01, 10000000)]
    public decimal Amount { get; set; }

    [Required]
    [StringLength(128, MinimumLength = 2)]
    public string Category { get; set; } = string.Empty;

    [StringLength(256)]
    public string? MerchantName { get; set; }

    [StringLength(128)]
    public string? ProjectCode { get; set; }

    [StringLength(1024)]
    public string? ReceiptUrl { get; set; }
}

public sealed class CreateSupportTicketRequest
{
    [Required]
    [StringLength(256, MinimumLength = 5)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    [StringLength(2048, MinimumLength = 10)]
    public string Description { get; set; } = string.Empty;

    [RegularExpression("^(Low|Medium|High|Urgent)$")]
    public string Priority { get; set; } = "Medium";
}

public sealed class UpdateCustomerProfileRequest
{
    [StringLength(64)]
    public string? FirstName { get; set; }

    [StringLength(64)]
    public string? LastName { get; set; }

    [Phone]
    [StringLength(32)]
    public string? PhoneNumber { get; set; }

    [StringLength(512)]
    public string? Address { get; set; }

    [StringLength(128)]
    public string? City { get; set; }

    [StringLength(64)]
    public string? State { get; set; }

    [StringLength(128)]
    public string? Country { get; set; }

    [StringLength(16)]
    public string? PostalCode { get; set; }

    [StringLength(16)]
    public string? ZipCode { get; set; }

    public DateOnly? BirthDate { get; set; }

    [Range(0, 150)]
    public int? Age { get; set; }

    [StringLength(16)]
    [RegularExpression("^(Male|Female|Other|Prefer not to say)$")]
    public string? Gender { get; set; }

    [StringLength(32)]
    [RegularExpression("^(Single|Married|Separated|Divorced|Widowed)$")]
    public string? MaritalStatus { get; set; }

    [StringLength(32)]
    public string? TIN { get; set; }

    [StringLength(32)]
    public string? SSS { get; set; }

    [StringLength(128)]
    public string? BankAccount { get; set; }

    [StringLength(128)]
    public string? BankName { get; set; }
}

public sealed class LoanAccessCheckResponse
{
    public bool CanAccessLoans { get; set; }
    public int ProfileCompletionPercentage { get; set; }
    public bool IsBankVerified { get; set; }
    public string? Message { get; set; }
}
