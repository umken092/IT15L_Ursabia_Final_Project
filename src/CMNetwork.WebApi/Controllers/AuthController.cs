using System.Security.Claims;
using System.Text;
using CMNetwork.Infrastructure.Services;
using CMNetwork.Infrastructure.Identity;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using CMNetwork.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using CMNetwork.Domain.Entities;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string SmtpSettingsPolicyName = "smtp-settings";
    private static readonly TimeSpan CustomerOtpLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan CustomerOtpResendCooldown = TimeSpan.FromMinutes(1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IAuthService _authService;
    private readonly IAuditEventLogger _audit;
    private readonly ILogger<AuthController> _logger;
    private readonly RuntimeHealthStatus _runtimeHealth;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly CMNetworkDbContext _dbContext;
    private readonly IEmailServiceFactory _emailServiceFactory;

    public AuthController(
        IAuthService authService,
        IAuditEventLogger audit,
        ILogger<AuthController> logger,
        RuntimeHealthStatus runtimeHealth,
        UserManager<ApplicationUser> userManager,
        CMNetworkDbContext dbContext,
        IEmailServiceFactory emailServiceFactory)
    {
        _authService = authService;
        _audit       = audit;
        _logger      = logger;
        _runtimeHealth = runtimeHealth;
        _userManager = userManager;
        _dbContext = dbContext;
        _emailServiceFactory = emailServiceFactory;
    }

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid request" });

        var ip       = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _authService.LoginAsync(request, ip);

        if (response is null)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "LoginFailed",
                category: AuditCategories.Login,
                details: new { email = request.Email, reason = "InvalidCredentialsOrLocked" },
                performedByOverride: request.Email,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);
            return Unauthorized(new { message = "Invalid credentials or account locked." });
        }

        if (response.RequiresCustomerOtpVerification)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "LoginBlockedPendingCustomerOtp",
                category: AuditCategories.Security,
                recordId: response.User.Id,
                details: new { email = request.Email },
                performedByOverride: response.User.Id,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);

            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Your customer account is pending email verification. Enter the OTP sent to your email before signing in.",
                requiresCustomerOtpVerification = true,
                email = request.Email,
            });
        }

        if (response.RequiresMfa)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "LoginMfaChallenge",
                category: AuditCategories.Login,
                details: new { email = request.Email },
                performedByOverride: request.Email,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);

            return Ok(new { requiresMfa = true, mfaSessionToken = response.MfaSessionToken, email = request.Email });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "LoginSucceeded",
            category: AuditCategories.Login,
            recordId: response.User.Id,
            details: new { email = response.User.Email, role = response.User.Role },
            performedByOverride: response.User.Id,
            userEmailOverride: response.User.Email,
            ipAddressOverride: ip);

        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? body)
    {
        if (!string.IsNullOrWhiteSpace(body?.RefreshToken))
            await _authService.RevokeRefreshTokenAsync(body.RefreshToken);

        await _audit.LogAsync(
            entityName: "Auth",
            action: "Logout",
            category: AuditCategories.Logout,
            recordId: User.FindFirstValue(JwtRegisteredClaimNames.Sub));

        return Ok(new { message = "Logged out successfully." });
    }

    [HttpPost("validate")]
    public async Task<IActionResult> ValidateToken([FromBody] TokenValidationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { message = "Token is required." });

        var response = await _authService.ValidateTokenAsync(request.Token);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "Refresh token is required." });

        var ip     = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.RefreshTokenAsync(request.RefreshToken, ip);

        if (result is null)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "RefreshTokenRejected",
                category: AuditCategories.Auth,
                details: new { reason = "InvalidOrExpired" },
                ipAddressOverride: ip);
            return Unauthorized(new { message = "Invalid or expired refresh token." });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "RefreshTokenIssued",
            category: AuditCategories.Auth,
            ipAddressOverride: ip);

        return Ok(result);
    }

    [HttpGet("mfa/setup")]
    [Authorize]
    public async Task<IActionResult> MfaSetup()
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId is null) return Unauthorized();

        var result = await _authService.GetMfaSetupAsync(userId);
        return Ok(result);
    }

    [HttpPost("mfa/enable")]
    [Authorize]
    public async Task<IActionResult> MfaEnable([FromBody] MfaEnableRequest request)
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId is null) return Unauthorized();

        var ok = await _authService.EnableMfaAsync(userId, request.Code);
        if (!ok) return BadRequest(new { message = "Invalid verification code." });

        await _audit.LogAsync(
            entityName: "Auth",
            action: "MfaEnabled",
            category: AuditCategories.Security,
            recordId: userId);

        return Ok(new { message = "Two-factor authentication enabled." });
    }

    [HttpPost("mfa/verify")]
    public async Task<IActionResult> MfaVerify([FromBody] MfaVerifyRequest request)
    {
        var ip     = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _authService.VerifyMfaAndLoginAsync(request, ip);

        if (result is null)
        {
            await _audit.LogAsync(
                entityName: "Auth",
                action: "MfaVerificationFailed",
                category: AuditCategories.Login,
                details: new { email = request.Email },
                performedByOverride: request.Email,
                userEmailOverride: request.Email,
                ipAddressOverride: ip);
            return Unauthorized(new { message = "Invalid MFA code." });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "MfaLoginSucceeded",
            category: AuditCategories.Login,
            recordId: result.User.Id,
            details: new { email = result.User.Email },
            performedByOverride: result.User.Id,
            userEmailOverride: result.User.Email,
            ipAddressOverride: ip);

        return Ok(result);
    }

    [HttpPost("mfa/disable")]
    [Authorize]
    public async Task<IActionResult> MfaDisable([FromBody] MfaDisableRequest request)
    {
        var userId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (userId is null) return Unauthorized();

        var ok = await _authService.DisableMfaAsync(userId, request.Password);
        if (!ok) return BadRequest(new { message = "Invalid password." });

        await _audit.LogAsync(
            entityName: "Auth",
            action: "MfaDisabled",
            category: AuditCategories.Security,
            recordId: userId);

        return Ok(new { message = "Two-factor authentication disabled." });
    }

    [HttpPost("password/forgot")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required." });
        }

        var normalizedEmail = request.Email.Trim();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);
        if (user is not null && user.IsActive)
        {
            var smtpSettings = await GetSmtpSettingsAsync();
            if (smtpSettings is not null)
            {
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
                var resetUrl = BuildResetUrl(request.ResetUrl, normalizedEmail, encodedToken);

                var body = $"""
                           Hello {user.FullName},

                           We received a request to reset your CMNetwork password.
                           Use the link below to continue:

                           {resetUrl}

                           If you did not request this, you can ignore this email.
                           """;

                var emailService = _emailServiceFactory.GetEmailService(smtpSettings);
                var sendResult = await emailService.SendEmailAsync(
                    smtpSettings,
                    recipientEmail: normalizedEmail,
                    subject: "CMNetwork password reset",
                    body: body,
                    isBodyHtml: false,
                    recipientName: user.FullName);

                if (!sendResult.Success)
                {
                    _logger.LogWarning("Forgot-password email send failed for {Email}: {Message}", normalizedEmail, sendResult.Message);
                }
            }
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "PasswordResetRequested",
            category: AuditCategories.Security,
            details: new { email = normalizedEmail },
            performedByOverride: normalizedEmail,
            userEmailOverride: normalizedEmail,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new { message = "If the account exists, a password reset email has been sent." });
    }

    [HttpPost("register/customer")]
    [EnableRateLimiting("login")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterCustomer([FromBody] RegisterCustomerRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Please provide valid registration details." });
        }

        var firstName = request.FirstName?.Trim() ?? string.Empty;
        var middleName = request.MiddleName?.Trim() ?? string.Empty;
        var lastName = request.LastName?.Trim() ?? string.Empty;

        // Backward compatibility for older clients that still send only FullName.
        if ((string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
            && !string.IsNullOrWhiteSpace(request.FullName))
        {
            var split = SplitName(request.FullName.Trim());
            if (string.IsNullOrWhiteSpace(firstName)) firstName = split.firstName;
            if (string.IsNullOrWhiteSpace(middleName)) middleName = split.middleName;
            if (string.IsNullOrWhiteSpace(lastName)) lastName = split.lastName;
        }

        if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
        {
            return BadRequest(new { message = "First name and last name are required." });
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.BirthDate > today)
        {
            return BadRequest(new { message = "Birthdate cannot be in the future." });
        }

        var computedAge = today.Year - request.BirthDate.Year;
        var birthDateThisYear = request.BirthDate.AddYears(computedAge);
        if (birthDateThisYear > today) computedAge--;

        if (Math.Abs(computedAge - request.Age) > 1)
        {
            return BadRequest(new { message = "Age does not match the selected birthdate." });
        }

        var normalizedEmail = request.Email.Trim();
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser is not null)
        {
            return Conflict(new { message = "An account with this email already exists." });
        }

        var fullName = string.Join(' ', new[] { firstName, middleName, lastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim();

        var existingCustomer = await _dbContext.Customers
            .FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == normalizedEmail.ToLower());

        Customer customer;
        if (existingCustomer is not null)
        {
            if (!existingCustomer.IsActive)
            {
                return BadRequest(new { message = "This customer profile is inactive. Please contact support." });
            }

            existingCustomer.FirstName = firstName;
            existingCustomer.MiddleName = middleName;
            existingCustomer.LastName = lastName;
            existingCustomer.BirthDate = request.BirthDate;
            existingCustomer.Age = request.Age;
            existingCustomer.Gender = request.Gender.Trim();
            existingCustomer.MaritalStatus = request.MaritalStatus.Trim();
            existingCustomer.Address = request.Address.Trim();
            existingCustomer.City = request.City.Trim();
            existingCustomer.Country = request.Country.Trim();
            existingCustomer.PostalCode = request.PostalCode.Trim();
            existingCustomer.PhoneNumber = request.ContactNumber.Trim();
            existingCustomer.ContactPerson = fullName;
            existingCustomer.Name = string.IsNullOrWhiteSpace(request.CompanyName) ? fullName : request.CompanyName.Trim();
            existingCustomer.LastUpdatedUtc = DateTime.UtcNow;
            customer = existingCustomer;
        }
        else
        {
            var generatedCode = await GenerateCustomerCodeAsync();
            // Generate a unique 6-digit OTP
            string otp = await GenerateUniqueOtpAsync();
            customer = new Customer
            {
                Id = Guid.NewGuid(),
                CustomerCode = generatedCode,
                Name = string.IsNullOrWhiteSpace(request.CompanyName) ? fullName : request.CompanyName.Trim(),
                FirstName = firstName,
                MiddleName = middleName,
                LastName = lastName,
                BirthDate = request.BirthDate,
                Age = request.Age,
                Gender = request.Gender.Trim(),
                MaritalStatus = request.MaritalStatus.Trim(),
                ContactPerson = fullName,
                Email = normalizedEmail,
                PhoneNumber = request.ContactNumber.Trim(),
                Address = request.Address.Trim(),
                City = request.City.Trim(),
                Country = request.Country.Trim(),
                PostalCode = request.PostalCode.Trim(),
                IsActive = true,
                CreatedUtc = DateTime.UtcNow,
                RegistrationOtp = otp,
                RegistrationOtpGeneratedUtc = DateTime.UtcNow,
                RegistrationOtpVerified = false,
            };
            _dbContext.Customers.Add(customer);
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FirstName = firstName,
            MiddleName = middleName,
            LastName = lastName,
            Birthdate = request.BirthDate,
            Gender = request.Gender.Trim(),
            Address = request.Address.Trim(),
            PhoneNumber = request.ContactNumber.Trim(),
            IsActive = true,
            EmailConfirmed = true,
            CustomerId = customer.Id,
            CreatedUtc = DateTime.UtcNow,
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                message = string.Join(" ", createResult.Errors.Select(e => e.Description)),
                errors = createResult.Errors.ToDictionary(e => e.Code, e => e.Description)
            });
        }

        var roleResult = await _userManager.AddToRoleAsync(user, "customer");
        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);
            return BadRequest(new { message = "Unable to assign customer access role." });
        }

        await _dbContext.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(customer.RegistrationOtp))
        {
            await SendCustomerRegistrationOtpEmailAsync(customer, fullName, normalizedEmail);
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "CustomerRegistered",
            category: AuditCategories.Security,
            recordId: user.Id.ToString(),
            details: new { email = normalizedEmail, customerId = customer.Id },
            performedByOverride: user.Id.ToString(),
            userEmailOverride: normalizedEmail,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new { message = "Registration successful. Please check your email for your OTP." });
    }

    private async Task<string> GenerateUniqueOtpAsync()
    {
        var random = new Random();
        for (int i = 0; i < 10; i++)
        {
            var otp = random.Next(100000, 999999).ToString();
            var validAfterUtc = DateTime.UtcNow.Subtract(CustomerOtpLifetime);
            var exists = await _dbContext.Customers.AnyAsync(c => c.RegistrationOtp == otp && c.RegistrationOtpGeneratedUtc > validAfterUtc && !c.RegistrationOtpVerified);
            if (!exists)
                return otp;
        }

        return random.Next(100000, 999999).ToString();
    }

    [HttpPost("resend/customer-otp")]
    [EnableRateLimiting("login")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendCustomerOtp([FromBody] CustomerOtpResendRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new AuthResponse { Success = false, Message = "A valid email is required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var successMessage = "If the account exists and still requires verification, a new OTP has been sent.";
        var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == normalizedEmail);

        if (customer is null || !customer.IsActive || customer.RegistrationOtpVerified)
        {
            return Ok(new AuthResponse { Success = true, Message = successMessage });
        }

        var linkedUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (linkedUser is null || !linkedUser.IsActive || linkedUser.CustomerId != customer.Id)
        {
            return Ok(new AuthResponse { Success = true, Message = successMessage });
        }

        if (customer.RegistrationOtpGeneratedUtc.HasValue && DateTime.UtcNow - customer.RegistrationOtpGeneratedUtc.Value < CustomerOtpResendCooldown)
        {
            return Ok(new AuthResponse
            {
                Success = true,
                Message = "A verification code was sent recently. Please wait about a minute before requesting another one."
            });
        }

        customer.RegistrationOtp = await GenerateUniqueOtpAsync();
        customer.RegistrationOtpGeneratedUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        await SendCustomerRegistrationOtpEmailAsync(customer, customer.ContactPerson ?? customer.Name, normalizedEmail);

        await _audit.LogAsync(
            entityName: "Auth",
            action: "CustomerOtpResent",
            category: AuditCategories.Security,
            recordId: customer.Id.ToString(),
            details: new { email = normalizedEmail },
            performedByOverride: linkedUser.Id.ToString(),
            userEmailOverride: normalizedEmail,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new AuthResponse { Success = true, Message = successMessage });
    }

    [HttpPost("password/reset")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email)
            || string.IsNullOrWhiteSpace(request.Token)
            || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Email, token, and new password are required." });
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive)
        {
            return BadRequest(new { message = "Invalid reset request." });
        }

        string decodedToken;
        try
        {
            decodedToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token.Trim()));
        }
        catch
        {
            return BadRequest(new { message = "Invalid reset token." });
        }

        var result = await _userManager.ResetPasswordAsync(user, decodedToken, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = string.Join(" ", result.Errors.Select(x => x.Description)) });
        }

        await _audit.LogAsync(
            entityName: "Auth",
            action: "PasswordReset",
            category: AuditCategories.Security,
            recordId: user.Id.ToString(),
            details: new { email = user.Email },
            performedByOverride: user.Id.ToString(),
            userEmailOverride: user.Email,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new { message = "Password reset successful." });
    }

    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new
        {
            status = _runtimeHealth.DatabaseAvailable ? "healthy" : "degraded",
            service = "Auth service is running",
            timestamp = DateTime.UtcNow,
            startedUtc = _runtimeHealth.StartedUtc,
            database = new
            {
                available = _runtimeHealth.DatabaseAvailable,
                message = _runtimeHealth.DatabaseStatusMessage
            },
            hangfire = new
            {
                enabled = _runtimeHealth.HangfireEnabled,
                started = _runtimeHealth.HangfireStarted
            }
        });

    private async Task<SmtpSettingsDto?> GetSmtpSettingsAsync()
    {
        var policy = await _dbContext.SecurityPolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Name == SmtpSettingsPolicyName);

        if (policy is null || string.IsNullOrWhiteSpace(policy.Value))
        {
            return null;
        }

        try
        {
            var dto = JsonSerializer.Deserialize<SmtpSettingsDto>(policy.Value, JsonOptions);
            if (dto is null || string.IsNullOrWhiteSpace(dto.Host) || string.IsNullOrWhiteSpace(dto.FromEmail))
            {
                return null;
            }

            return dto;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildResetUrl(string? resetUrl, string email, string token)
    {
        if (string.IsNullOrWhiteSpace(resetUrl))
        {
            return $"https://example.invalid/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
        }

        var separator = resetUrl.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        return $"{resetUrl}{separator}email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
    }

    private async Task<string> GenerateCustomerCodeAsync()
    {
        for (var i = 0; i < 10; i++)
        {
            var code = $"CUST-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(100, 999)}";
            var exists = await _dbContext.Customers.AnyAsync(c => c.CustomerCode == code);
            if (!exists)
            {
                return code;
            }
        }

        return $"CUST-{Guid.NewGuid():N}"[..18].ToUpperInvariant();
    }

    private static (string firstName, string middleName, string lastName) SplitName(string fullName)
    {
        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
        {
            return ("Customer", string.Empty, "User");
        }

        if (parts.Length == 1)
        {
            return (parts[0], string.Empty, "Customer");
        }

        if (parts.Length == 2)
        {
            return (parts[0], string.Empty, parts[1]);
        }

        var firstName = parts[0];
        var lastName = parts[^1];
        var middleName = string.Join(' ', parts[1..^1]);
        return (firstName, middleName, lastName);
    }

    [HttpPost("verify/customer-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyCustomerOtp([FromBody] CustomerOtpVerifyRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new CustomerOtpVerifyResponse { Success = false, Message = "Invalid request." });

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == normalizedEmail);
        if (customer == null || string.IsNullOrWhiteSpace(customer.RegistrationOtp))
            return BadRequest(new CustomerOtpVerifyResponse { Success = false, Message = "No OTP found for this customer." });

        if (customer.RegistrationOtpVerified)
            return Ok(new CustomerOtpVerifyResponse { Success = true, Message = "OTP already verified." });

        if (customer.RegistrationOtpGeneratedUtc == null || customer.RegistrationOtpGeneratedUtc < DateTime.UtcNow.Subtract(CustomerOtpLifetime))
            return BadRequest(new CustomerOtpVerifyResponse { Success = false, Message = "OTP has expired. Please request a new one." });

        if (customer.RegistrationOtp != request.Otp)
            return BadRequest(new CustomerOtpVerifyResponse { Success = false, Message = "Invalid OTP. Please check and try again." });

        customer.RegistrationOtpVerified = true;
        await _dbContext.SaveChangesAsync();

        await _audit.LogAsync(
            entityName: "Auth",
            action: "CustomerOtpVerified",
            category: AuditCategories.Security,
            recordId: customer.Id.ToString(),
            details: new { email = customer.Email },
            performedByOverride: customer.Id.ToString(),
            userEmailOverride: customer.Email,
            ipAddressOverride: HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(new CustomerOtpVerifyResponse { Success = true, Message = "OTP verified successfully. You can now sign in." });
    }

    [HttpGet("admin/otp/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetOtpStatus(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        var otpStatus = new
        {
            user.Email,
            user.PhoneNumber,
            user.EmailConfirmed,
            user.PhoneNumberConfirmed
        };

        return Ok(otpStatus);
    }

    [HttpPost("admin/otp/resend/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResendOtp(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        var result = await _authService.ResendOtpAsync(user);
        if (!result)
            return BadRequest(new { message = "Failed to resend OTP." });

        return Ok(new { message = "OTP resent successfully." });
    }

    private async Task SendCustomerRegistrationOtpEmailAsync(Customer customer, string recipientName, string recipientEmail)
    {
        if (string.IsNullOrWhiteSpace(customer.RegistrationOtp))
        {
            return;
        }

        var smtpSettings = await GetSmtpSettingsAsync();
        if (smtpSettings == null)
        {
            return;
        }

        var emailService = _emailServiceFactory.GetEmailService(smtpSettings);
        var displayName = string.IsNullOrWhiteSpace(recipientName) ? customer.ContactPerson ?? customer.Name : recipientName.Trim();
        var subject = "Your Customer Portal Registration OTP";
        var body = $@"Hello {displayName},<br/><br/>Your one-time passcode (OTP) is: <b>{customer.RegistrationOtp}</b><br/><br/>This code is valid for 10 minutes. Please enter it to verify your account.<br/><br/>If you did not request this, please ignore this email.";

        await emailService.SendEmailAsync(
            smtpSettings,
            recipientEmail,
            subject,
            body,
            true,
            displayName);
    }
}
