# CMNetwork Security Features

## Overview

This document describes the complete security architecture of CMNetwork, including authentication mechanisms, authorization layers, audit logging, and compliance controls. Security is built into every layer of the application: API endpoints, database access, user sessions, and data transmission.

---

## 1. Authentication

### JWT Bearer Token Authentication

CMNetwork implements stateless authentication using JSON Web Tokens (JWT), eliminating the need for server-side session storage while maintaining security.

#### JWT Token Structure

**Issued by:** [JwtTokenService.cs](../src/CMNetwork.Infrastructure/Identity/JwtTokenService.cs)

**Token Composition:**

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",  // User ID (GUID)
  "email": "user@cmnetwork.com",                   // Email
  "fullName": "John Doe",                          // Display name
  "role": "accountant",                            // Primary role
  "departmentId": "dept-guid",                     // Department assignment
  "iat": 1715001600,                               // Issued at (Unix timestamp)
  "nbf": 1715001600,                               // Not before
  "exp": 1715002500,                               // Expiration (15 minutes later)
  "iss": "cmnetwork",                              // Issuer
  "aud": "cmnetwork-client",                       // Audience
  "jti": "12345-uuid-67890"                        // JWT ID (for revocation)
}

Signature: HMACSHA256(base64(header) + "." + base64(payload), secret)
```

**Why JWT?**
- **Stateless:** No server-side session storage; scales horizontally
- **Self-contained:** All claims embedded in token; no database lookup needed for validation
- **Compact:** Efficient for HTTP headers
- **Standard:** Well-supported across frameworks and languages

---

#### Token Generation Process

```csharp
// Location: JwtTokenService.GenerateAccessTokenAsync()

1. Query user's assigned roles (e.g., ["accountant", "budget-officer"])
2. Create claims list:
   - Standard claims (sub, email, jti, exp)
   - Custom claims (fullName, role, departmentId)
   - Role claims (one per role)
3. Load JWT secret from configuration
   - Validate secret exists and has minimum length
4. Create symmetric key using HMACSHA256 algorithm
5. Set token expiration (15 minutes from now, configurable)
6. Sign token with key
7. Serialize to compact JWT format
8. Return token string
```

**Configuration (appsettings.Development.json):**
```json
{
  "Jwt": {
    "Secret": "your-super-secret-key-min-32-chars",
    "Issuer": "cmnetwork",
    "Audience": "cmnetwork-client",
    "AccessTokenMinutes": 15
  }
}
```

**Security Considerations:**
- Secret should be **at least 32 characters** (256 bits) for HMACSHA256
- Never commit secrets to source code; use environment variables or .NET User Secrets
- Rotate secrets periodically in production
- Store production secret in Render environment configuration

---

#### Token Validation & Claims Transformation

**Location:** [JwtBearerDefaults Configuration in Program.cs](../src/CMNetwork.WebApi/Program.cs)

**Validation Steps:**

```csharp
TokenValidationParameters = new TokenValidationParameters
{
  ValidateIssuerSigningKey = true,         // Verify signature matches secret
  IssuerSigningKey = symmetricKey,         // HMACSHA256 key
  ValidateIssuer = true,                   // Verify "iss" claim
  ValidIssuer = "cmnetwork",               // Expected issuer
  ValidateAudience = true,                 // Verify "aud" claim
  ValidAudience = "cmnetwork-client",      // Expected audience
  ClockSkew = TimeSpan.Zero,               // No time tolerance (strict)
}
```

**Process Flow on Each Request:**

```
1. Extract Authorization header
2. Parse "Bearer {token}" format
3. Validate token signature (check if tampered)
4. Validate issuer matches expected value
5. Validate audience matches expected value
6. Validate expiration (check if exp < now)
7. Create ClaimsPrincipal from token
8. Apply RoleNormalizationTransformation:
   - Convert PascalCase roles to lowercase-hyphen
   - E.g., "FacultyAdmin" → "faculty-admin"
   - Ensures @Authorize(Roles="faculty-admin") works
9. Attach principal to HttpContext.User
10. Continue to endpoint logic
```

**Location:** [RoleNormalizationTransformation.cs](../src/CMNetwork.WebApi/Services/RoleNormalizationTransformation.cs)

---

### Multi-Factor Authentication (MFA)

CMNetwork supports optional Time-based One-Time Password (TOTP) MFA using standard authenticator apps (Google Authenticator, Microsoft Authenticator, Authy, etc.).

#### MFA Setup Flow

**API Endpoint:** `POST /api/auth/mfa/setup`

```
1. User requests MFA setup
   GET /api/auth/mfa/setup

2. Backend generates shared secret:
   - Create random 32-byte secret
   - Encode to Base32 format
   - Generate authenticator URI (otpauth://)

3. Return to frontend:
   {
     "sharedKey": "JBSWY3DPEBLW64TMMQ...",
     "authenticatorUri": "otpauth://totp/cmnetwork:user@example.com?secret=..."
   }

4. Frontend displays QR code (from authenticatorUri)

5. User scans QR code with authenticator app
   - App derives same shared secret
   - Generates 6-digit TOTP codes

6. User enters TOTP code from app: "123456"
   GET /api/auth/mfa/verify?code=123456

7. Backend verifies TOTP:
   - Generate current TOTP from shared secret
   - Compare with user's input (±30 sec window)
   - If match: Set user.TwoFactorEnabled = true
   - Store shared secret in database

8. Return success: MFA enabled
```

**Why TOTP?**
- **Stateless:** No server-side message queue needed
- **Standard:** Works with any TOTP authenticator app
- **Secure:** Based on HMAC-SHA1 standard (RFC 6238)
- **Time-based:** 30-second rotation prevents reuse
- **Offline:** Works without internet connection

---

#### MFA Enforcement Policy

Configured in [SecurityPolicyModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/SecurityPolicyModule.tsx) and enforced in [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs).

**MFA Levels:**

| Level | Roles Required | Flow |
|-------|----------------|------|
| `none` | N/A | MFA optional for all users |
| `high-privilege` | `super-admin`, `cfo`, `auditor` | MFA mandatory during login for these roles |
| `all` | Everyone | MFA mandatory during login for all users |

**Login Flow with MFA:**

```
1. User enters email and password
   POST /api/auth/login

2. Backend validates credentials (standard)

3. If credentials valid:
   - Check user.TwoFactorEnabled
   - Check MFA policy level
   - If (user.TwoFactorEnabled OR policy == "all"):
       * Generate temp MFA session token (15 min expiry)
       * Return requiresMfa=true + mfaSessionToken

4. Frontend redirects to MFA code entry screen

5. User enters 6-digit code from authenticator
   POST /api/auth/mfa/verify with mfaSessionToken

6. Backend verifies TOTP code (±30 second window)

7. If valid:
   - Mark session as MFA-verified
   - Generate final access + refresh tokens
   - Audit log: "MfaVerified"

8. Frontend stores tokens in memory (not localStorage)
```

**Location:** [IdentityAuthService.cs](../src/CMNetwork.WebApi/Services/IdentityAuthService.cs) → `EnableMfaAsync()` and `VerifyMfaAsync()`

---

### Password Security

CMNetwork uses ASP.NET Identity's built-in password hashing and configurable policies.

#### Password Hashing

**Algorithm:** PBKDF2 (Password-Based Key Derivation Function 2)  
**Provider:** ASP.NET Core Identity default hasher  
**Configuration:**

```csharp
// In DependencyInjection.cs
services.Configure<PasswordHasherOptions>(options =>
{
  options.IterationCount = 10000;  // Number of iterations (default 10K)
  options.Rng = new SystemRandom(); // Use cryptographically secure RNG
});
```

**Hash Storage:** All passwords stored as irreversible hashes in `AspNetUsers.PasswordHash` column  
**Never stored as:** Plain text, encrypted strings, or reversible encodings

#### Password Policy

Customizable policy enforced both client-side (UX) and server-side (security):

**Default Policy:**
```json
{
  "minLength": 12,
  "maxLength": 128,
  "blockedTerms": [
    "password", "123456", "12345678", "qwerty",
    "admin", "administrator", "welcome", "letmein", "abc123"
  ],
  "forbidUserContext": true,      // Block user's name, email, etc.
  "forbidCompanyName": true,      // Block "cmnetwork"
  "expireOnlyOnCompromise": true,  // No forced rotation
  "allowUnicode": true,            // Allow non-ASCII characters
  "requireUppercase": false,       // Optional uppercase
  "requireLowercase": false,       // Optional lowercase
  "requireNumbers": false,         // Optional digits
  "requireSymbols": false,         // Optional symbols
  "preventReuse": 0                // Don't track history
}
```

**Why These Defaults?**

Modern security best practices (NIST SP 800-63B) recommend:
- **Long passphrases over complexity:** Easier to remember, more secure
- **No forced rotation:** Encourages weaker passwords and post-its
- **Breach dictionary checking:** Blocks compromised passwords
- **User-context awareness:** Prevents guessable variations
- **No length requirement limits:** Encourage long passphrases

---

#### Password Validation Algorithm

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `ValidatePasswordAgainstPolicy()`

```csharp
1. Check minimum length:
   if (password.Length < policy.MinLength)
     → Reject: "Use at least N characters"

2. Check maximum length:
   if (password.Length > policy.MaxLength)
     → Reject: "Use no more than N characters"

3. Check against blocked terms:
   foreach (term in policy.BlockedTerms):
     if (password.ToLowerInvariant().Contains(term))
       → Reject: "Contains compromised or common word"

4. Check company name (if enabled):
   if (policy.ForbidCompanyName && password contains "cmnetwork")
     → Reject: "Cannot contain company name"

5. Check user context (if enabled):
   userContextTerms = [username, email, firstName, lastName, ...]
   foreach (term in userContextTerms):
     if (password contains term)
       → Reject: "Cannot contain user's name or email"

6. All checks pass → Accept password
```

---

#### Auto-Generated Employee Passwords

When creating new employees via Admin UI, system auto-generates secure passwords:

**Pattern:** `Harbor-slate-lumen-{year}-{randomDigits}!`

**Example:** `Harbor-slate-lumen-2026-847!`

**Generation Algorithm:**

```csharp
private static string ResolveGeneratedPassword(string? requestedPassword)
{
  if (!string.IsNullOrWhiteSpace(requestedPassword))
    return requestedPassword;
  
  // Pattern: Harbor-slate-lumen-{year}-{randomDigits}!
  // Example: Harbor-slate-lumen-2026-847!
  
  var year = DateTime.UtcNow.Year;
  var randomDigits = Random.Shared.Next(100, 999);
  return $"Harbor-slate-lumen-{year}-{randomDigits}!";
}
```

**Why this pattern?**
- ✅ 12+ characters (meets policy)
- ✅ Mixed case (uppercase: Harbor, slate, lumen)
- ✅ Contains digit (year + random)
- ✅ Contains symbol (!)
- ✅ Memorable but unique
- ✅ No personal context
- ✅ Complies with ASP.NET Identity default policy

**Location:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs) → `ResolveGeneratedPassword()` method

---

### Account Lockout

Protects against brute-force attacks by locking accounts after repeated failed login attempts.

**Configuration:**
```json
{
  "maxFailedAttempts": 5,
  "lockoutDurationMinutes": 15,
  "resetCounterAfterMinutes": 30
}
```

**Process Flow:**

```
1. User enters incorrect password
2. Backend increments AccessFailedCount
3. Audit log: "LoginFailed"
4. Return 401 Unauthorized

5. If AccessFailedCount >= MaxFailedAttempts:
   - Set LockoutEnd = now + LockoutDurationMinutes
   - User receives error: "Account locked. Try again in 15 minutes."

6. If user waits LockoutDuration:
   - LockoutEnd expires
   - Next login attempt resets AccessFailedCount to 0

7. If user logs in successfully:
   - Reset AccessFailedCount to 0
   - Clear LockoutEnd
```

**Location:** ASP.NET Core Identity (built-in)  
**Configured in:** [DependencyInjection.cs](../src/CMNetwork.Infrastructure/DependencyInjection.cs)

---

## 2. Authorization

### Role-Based Access Control (RBAC)

Every protected endpoint requires authorization. CMNetwork uses both:
- **Role-based** (which role can access)
- **Resource-based** (can user access this record)

#### Role Hierarchy

```
Super Admin (all permissions)
├── CFO (financial decisions)
├── Faculty Admin (department management)
├── Accountant (daily GL/AP/AR)
├── Budget Manager (budget approvals)
├── Budget Officer (budget tracking)
├── Auditor (read-only audit)
├── Employee (personal functions)
├── Authorized Viewer (limited dashboard)
└── Customer (portal access)
```

---

#### Authorization Decorators

**Example 1: Role-based authorization**
```csharp
[Authorize(Roles = "accountant,cfo,super-admin")]
public async Task<IActionResult> CreateJournal([FromBody] CreateJournalRequest request)
{
  // Only users with one of these roles can call this endpoint
}
```

**Example 2: Super-admin-only policy**
```csharp
[Authorize(Policy = "SuperAdminOnly")]
public class AdminController : ControllerBase
{
  // All endpoints require super-admin role
}
```

**Example 3: Complex role routing**
```csharp
[HttpPost("invoices/{id}/approve")]
[Authorize(Roles = "faculty-admin,cfo,super-admin,accountant")]
public async Task<IActionResult> ApproveInvoice(Guid id, ...)
{
  // Business logic validates:
  // - Current user's role has approval authority
  // - User didn't create the invoice (prevent self-approval)
  // - Invoice meets approval thresholds (amount-based routing)
}
```

**Location:** [Program.cs](../src/CMNetwork.WebApi/Program.cs) → Authentication middleware setup

---

#### Policy-Based Authorization

**SuperAdminOnly Policy:**

```csharp
// In Program.cs
builder.Services.AddAuthorization(options =>
{
  options.AddPolicy("SuperAdminOnly", policy =>
    policy.RequireRole("super-admin"));
});
```

---

### Resource-Based Authorization

Beyond role checks, CMNetwork validates users can only access records they own or have permission to view.

#### Example: Customer Portal Access

**Scenario:** Customer tries to view another customer's invoices

**Protection:**

```csharp
[HttpGet("invoices")]
[Authorize(Roles = "customer")]
public async Task<IActionResult> GetMyInvoices()
{
  // Step 1: Extract email from JWT claims
  var userEmail = User.FindFirstValue(ClaimTypes.Email);
  
  // Step 2: Look up Customer entity matching email
  var customer = await _db.Customers
    .FirstOrDefaultAsync(c => c.Email.ToLower() == userEmail.ToLower());
  
  // Step 3: If no customer: Return 404 (not 403)
  if (customer == null)
    return NotFound();
  
  // Step 4: Query invoices only for this customer
  var invoices = await _db.ARInvoices
    .Where(inv => inv.CustomerId == customer.Id)  // ← Resource filter
    .ToListAsync();
  
  return Ok(invoices);
}
```

**Security Principle:** Every query that fetches sensitive data must include a filter based on the authenticated user's identity.

---

#### Example: Self-Approval Prevention

**Scenario:** Employee creates approval queue item, cannot approve own request

```csharp
[HttpPost("{id}/approve")]
[Authorize(Roles = "faculty-admin,cfo,super-admin,accountant")]
public async Task<IActionResult> Approve(Guid id, ...)
{
  var item = await _db.ApprovalQueue.FirstOrDefaultAsync(x => x.Id == id);
  
  var currentUserId = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
  
  // Prevent self-approval
  if (item.RequestedByUserId == currentUserId)
    return BadRequest(new { message = "You cannot approve your own request." });
  
  // Continue with approval...
}
```

---

## 3. Audit Logging

Comprehensive audit trail of all system changes, enabled automatically via `Audit.EntityFramework` library.

### Audit Architecture

**Components:**

| Component | Purpose |
|-----------|---------|
| [AuditLogEntry](../src/CMNetwork.Domain/Entities/AuditLogEntry.cs) | Domain model for audit records |
| [AuditEventLogger.cs](../src/CMNetwork.Infrastructure/Services/AuditEventLogger.cs) | Service for logging events |
| [CMNetworkDbContext.cs](../src/CMNetwork.Infrastructure/Persistence/CMNetworkDbContext.cs) | EF Core configured with `[AuditDbContext]` |
| `AuditLogs` table | SQL Server table storing all events |

---

### Audit Event Logging

**Location:** [AuditEventLogger.cs](../src/CMNetwork.Infrastructure/Services/AuditEventLogger.cs)

**Public Method:**

```csharp
public async Task LogAsync(
  string entityName,            // e.g., "APInvoice", "Auth"
  string action,                // e.g., "Created", "LoginFailed"
  string category,              // e.g., AuditCategories.Create
  string? recordId = null,      // Entity ID (if applicable)
  object? details = null,       // Additional JSON details
  string? performedByOverride = null,  // Override performer (for external triggers)
  string? userEmailOverride = null,    // Override email
  string? ipAddressOverride = null,    // Override IP
  CancellationToken cancellationToken = default)
```

**Process Flow:**

```
1. Create AuditLogEntry entity:
   - EntityName: Truncated to 128 chars
   - Action: Truncated to 64 chars
   - ActionCategory: Truncated to 32 chars
   - RecordId: Truncated to 128 chars
   - PerformedBy: User or override value
   - UserEmail: User email or override
   - IpAddress: Captured from HttpContext
   - UserAgent: Browser user agent
   - DetailsJson: Serialize object to JSON
   - CreatedUtc: Current timestamp

2. Create fresh DbContext scope
   (Prevents audit writes from interfering with caller's transaction)

3. Add entry to AuditLogs DbSet

4. SaveChangesAsync()

5. If exception:
   - Log error to ILogger
   - Do NOT propagate (audit failures must not break business logic)
```

**Why separate scope?**
- Audit writes must never cause business transaction rollback
- If audit logging fails, core operation succeeds (with warning logged)
- Ensures audit is non-blocking and fault-tolerant

---

### Audit Categories

**Standard Categories:**

```csharp
public static class AuditCategories
{
  public const string Create = "Create";
  public const string Update = "Update";
  public const string Delete = "Delete";
  public const string Login = "Login";
  public const string Logout = "Logout";
  public const string Security = "Security";
  public const string Approval = "Approval";
  public const string Posting = "Posting";
  public const string System = "System";
}
```

---

### Automatic Change Tracking

The `Audit.EntityFramework` library automatically tracks **all EF Core changes**. No explicit logging needed for database modifications.

**Configured in:** [CMNetworkDbContext.cs](../src/CMNetwork.Infrastructure/Persistence/CMNetworkDbContext.cs)

```csharp
[AuditDbContext]  // ← Enables automatic tracking
public class CMNetworkDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
  // Any SaveChanges() call automatically audits all entity changes
}
```

**What Gets Tracked:**
- ✅ CREATE: New entity inserted
- ✅ UPDATE: Entity properties modified
- ✅ DELETE: Entity marked as deleted
- ✅ Who: User ID captured from claims
- ✅ When: Timestamp recorded
- ✅ What: Old and new values stored

**What Gets Excluded:**
- ❌ Password hashes (never logged)
- ❌ Refresh tokens (sensitive)
- ❌ Temporary session data

---

### Audit Query Example

**API:** `GET /api/audit-logs?entityName=APInvoice&action=Created&page=1`

**Response:**
```json
{
  "items": [
    {
      "id": "audit-log-guid",
      "entityName": "APInvoice",
      "action": "Created",
      "recordId": "ap-invoice-guid",
      "performedBy": "accountant@cmnetwork.com",
      "userEmail": "accountant@cmnetwork.com",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "details": {
        "invoiceNumber": "INV-2026-00456",
        "vendorId": "vendor-guid",
        "totalAmount": 15000.00,
        "status": "Draft"
      },
      "createdUtc": "2026-05-10T14:00:00Z"
    }
  ]
}
```

**Audit Report Use Cases:**
1. **Compliance:** Demonstrate controls for financial audits
2. **Forensics:** Investigate unauthorized changes
3. **Accountability:** Track who made decisions
4. **Debugging:** Understand system state changes

---

## 4. Data Protection at Rest

### SQL Server Encryption

**Production Database:** MonsterAsp SQL Server  
**Encryption:** Transparent Data Encryption (TDE) — enabled at database level

**What TDE Protects:**
- ✅ Database files on disk
- ✅ Backup files
- ✅ Transaction logs
- ✅ Sensitive PII/financial data

**What TDE Does NOT Protect:**
- ❌ Data in memory (while queried)
- ❌ Data in transit over network
- ❌ Access control (still requires authentication)

**Configuration:** Managed by MonsterAsp hosting provider (not exposed to application code)

---

### Entity Framework Query Interceptors

**Purpose:** Ensure sensitive data is never returned accidentally

**Example: Exclude passwords from queries**

```csharp
// In CMNetworkDbContext.cs
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
  modelBuilder.Entity<ApplicationUser>()
    .Ignore(u => u.PasswordHash);  // Never serialize
  
  modelBuilder.Entity<RefreshToken>()
    .Property(rt => rt.Token)
    .IsRequired(); // Ensure token value is loaded
}
```

---

## 5. Data Protection in Transit

### HTTPS/TLS Encryption

All API communication is encrypted end-to-end using HTTPS with TLS 1.3.

**Production URL:** `https://it15l-ursabia-final-project.onrender.com`  
**SSL Certificate:** Auto-provisioned by Render (Let's Encrypt)  
**Renewal:** Automatic

**Configuration in Program.cs:**

```csharp
// Enforce HTTPS redirection
app.UseHttpsRedirection();

// Strict Transport Security header
app.UseHsts();
```

**What's Protected:**
- ✅ Authorization tokens (in Authorization header)
- ✅ Request/response body (all API data)
- ✅ Cookies (if used)
- ✅ User credentials

**What's NOT Protected:**
- ❌ URL path (server name, endpoint visible)
- ❌ Domain name (SNI visible)
- ❌ Packet metadata (source/dest IP)

---

### CORS Policy

**Purpose:** Prevent unauthorized cross-origin access  
**Configuration:** [Program.cs](../src/CMNetwork.WebApi/Program.cs)

```csharp
var allowedCorsOrigins = new[]
{
  "http://localhost:5173",          // Local Vite dev
  "http://localhost:3000",          // Local React dev
  "https://localhost:5173",         // HTTPS local
  "https://localhost:3000",         // HTTPS local
  "https://cmnetwork-frontend.vercel.app"  // Production frontend (if separate)
};

builder.Services.AddCors(options =>
{
  options.AddPolicy("AllowFrontend", policy =>
  {
    policy
      .WithOrigins(allowedCorsOrigins)
      .AllowAnyMethod()
      .AllowAnyHeader()
      .AllowCredentials();  // Allow Authorization header
  });
});

// Apply CORS middleware
app.UseCors("AllowFrontend");
```

**How CORS Works:**

```
1. Browser makes request to different origin (e.g., frontend to API)
2. Browser sends preflight OPTIONS request with:
   - Origin: https://frontend.example.com
   - Access-Control-Request-Method: POST
   - Access-Control-Request-Headers: Authorization, Content-Type

3. Server checks if origin is in allowlist

4. If allowed:
   - Return: Access-Control-Allow-Origin: https://frontend.example.com
   - Browser permits request

5. If not allowed:
   - Server does not return CORS header
   - Browser blocks request (even if 200 OK received)
```

---

## 6. Rate Limiting

Prevents abuse and DoS attacks by limiting request rates per endpoint and per IP.

### Login Rate Limiting

**Configuration:** [AuthController.cs](../src/CMNetwork.WebApi/Controllers/AuthController.cs)

```csharp
[HttpPost("login")]
[EnableRateLimiting("login")]
public async Task<IActionResult> Login([FromBody] LoginRequest request)
{
  // Endpoint implementation
}

// Configured in Program.cs:
builder.Services.AddRateLimiter(options =>
{
  options.AddPolicy("login", httpContext =>
    RateLimitPartition.GetFixedWindowLimiter(
      partitionKey: httpContext.Connection.RemoteIpAddress?.ToString(),
      factory: partition => new FixedWindowRateLimiterOptions
      {
        AutoReplenishment = true,
        PermitLimit = 10,
        Window = TimeSpan.FromMinutes(15)
      }));
});
```

**Rate Limit:** 10 login attempts per IP address per 15 minutes

**Response When Limited:**
```
HTTP 429 Too Many Requests
Retry-After: 45
```

**Why This Limit?**
- Allows ~1 attempt per 90 seconds (reasonable for typos)
- Blocks sustained brute-force attacks (100+ attempts)
- Resets automatically after 15 minutes

---

## 7. Security Headers

HTTP security headers instruct browsers to enforce additional security policies.

**Configured in Middleware:** [Program.cs](../src/CMNetwork.WebApi/Program.cs)

```csharp
app.Use(async (context, next) =>
{
  // Prevent MIME type sniffing
  context.Response.Headers["X-Content-Type-Options"] = "nosniff";
  
  // Prevent clickjacking
  context.Response.Headers["X-Frame-Options"] = "DENY";
  
  // Strict Transport Security (HTTPS only)
  context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  
  // Referrer Policy
  context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  
  // Content Security Policy (strict XSS protection)
  context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'";
  
  await next();
});
```

**What Each Header Prevents:**

| Header | Prevents |
|--------|----------|
| `X-Content-Type-Options: nosniff` | Browser from guessing MIME types; requires correct Content-Type |
| `X-Frame-Options: DENY` | Embedding API in `<iframe>` tags (clickjacking) |
| `Strict-Transport-Security` | Downgrade to HTTP; forces HTTPS for future requests |
| `Referrer-Policy` | Leaking sensitive info in referrer URL |
| `Content-Security-Policy` | Inline script execution (XSS attacks) |

---

## 8. Input Validation & SQL Injection Prevention

### Model Validation

**Frontend Validation:** [UserManagementModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/UserManagementModule.tsx)

```typescript
const validateEmail = (email: string): boolean => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return pattern.test(email)
}

const validatePassword = (password: string, policy: PasswordPolicy): string[] => {
  const errors: string[] = []
  if (password.length < policy.minLength) {
    errors.push(`Use at least ${policy.minLength} characters.`)
  }
  // ... more checks
  return errors
}
```

**Backend Validation:** [AdminController.cs](../src/CMNetwork.WebApi/Controllers/AdminController.cs)

```csharp
[HttpPost("users")]
public async Task<IActionResult> CreateUser([FromBody] CreateAdminUserRequest request)
{
  if (!ModelState.IsValid)
    return BadRequest(ModelState);  // Automatic validation error response
  
  // Field validators run automatically
  // Required fields, email format, string length, etc.
}
```

**Data Annotations:** [AdminModels.cs](../src/CMNetwork.WebApi/Models/AdminModels.cs)

```csharp
public class CreateAdminUserRequest
{
  [Required(ErrorMessage = "Email is required.")]
  [EmailAddress(ErrorMessage = "Invalid email format.")]
  [StringLength(256)]
  public string Email { get; set; } = string.Empty;
  
  [Required]
  [StringLength(128, MinimumLength = 2)]
  public string FirstName { get; set; } = string.Empty;
}
```

---

### SQL Injection Prevention

CMNetwork uses **parameterized queries** via Entity Framework Core. Raw SQL is avoided entirely.

**Safe (Parameterized):**
```csharp
// User input automatically parameterized
var users = await _db.Users
  .Where(u => u.Email == emailFromRequest)  // ← Parameterized
  .ToListAsync();
```

**Unsafe (Never used):**
```csharp
// String concatenation: VULNERABLE TO SQL INJECTION
var query = $"SELECT * FROM Users WHERE Email = '{userInput}'";
// If userInput = "'; DROP TABLE Users; --"
// Result: SELECT * FROM Users WHERE Email = ''; DROP TABLE Users; --'
```

**EF Core Protection:**
- ✅ LINQ queries automatically converted to parameterized SQL
- ✅ Values passed as query parameters, never concatenated
- ✅ SQL Server driver handles escaping

---

## 9. Secure Session Management

### Session Storage (Frontend)

**Location:** [apiClient.ts](../src/CMNetwork.ClientApp/src/services/apiClient.ts)

Tokens are stored **in memory only**, not `localStorage` or `sessionStorage`.

```typescript
let storedAccessToken = ""  // ← Memory (cleared on page refresh)
let storedRefreshToken = ""

export const setTokens = (accessToken: string, refreshToken: string) => {
  storedAccessToken = accessToken
  storedRefreshToken = refreshToken
}

export const getAccessToken = () => storedAccessToken
```

**Why in-memory?**
- ✅ XSS attacks cannot steal tokens (not in DOM)
- ❌ Tokens lost on page refresh (requires re-login)
- Trade-off: Security > Convenience for financial app

**Alternative: Httponly Cookies**
- Could use httpOnly cookies (server sets, browser auto-attaches)
- More resilient to page refresh
- Vulnerable to CSRF attacks (if not protected)
- CMNetwork chose in-memory for highest XSS protection

---

### Idle Session Timeout

Configured in [SecurityPolicyModule.tsx](../src/CMNetwork.ClientApp/src/pages/modules/SecurityPolicyModule.tsx)

**Default:** 30 minutes idle timeout

**Process:**

```
1. User logs in → session active

2. No API requests for 30 minutes → idle

3. Next API request:
   - Backend checks last activity timestamp
   - If 30+ minutes: Reject with 401 Unauthorized
   - Frontend redirects to login

4. User must re-authenticate

5. On activity: Update last-activity timestamp
```

---

### Single Session Per User (Optional)

If enabled, user can only have one active login per browser.

**Configuration:**
```json
{
  "session": {
    "singleSessionPerUser": true
  }
}
```

**Enforcement:**
```csharp
// On login:
1. Revoke all existing refresh tokens for user
2. Issue new refresh token
3. Previous sessions immediately invalidated
   (next request fails, forces re-login)
```

---

## 10. Dependency Vulnerabilities

### NuGet Package Security

All NuGet dependencies are specified with pinned versions in `.csproj` files.

```xml
<!-- CMNetwork.WebApi.csproj -->
<ItemGroup>
  <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.0" />
  <PackageReference Include="Audit.EntityFramework.Core" Version="25.0.0" />
  <PackageReference Include="QuestPDF" Version="2024.3.0" />
  <PackageReference Include="EPPlus" Version="7.0.0" />
</ItemGroup>
```

**Security Best Practices:**
- Pin versions (not floating)
- Review release notes for security fixes
- Update quarterly (balance security vs. stability)
- Use GitHub Dependabot for alerts

**npm Vulnerabilities (Frontend):**

Checked via `npm audit` during CI/CD builds.

```bash
$ cd src/CMNetwork.ClientApp
$ npm audit
```

---

## 11. Compliance & Security Checklist

### OWASP Top 10 Coverage

| OWASP Risk | CMNetwork Mitigation |
|------------|---------------------|
| A01: Broken Access Control | Role-based + resource-based auth; self-approval prevention |
| A02: Cryptographic Failures | HTTPS TLS 1.3; password hashing (PBKDF2) |
| A03: Injection | Parameterized queries (EF Core); input validation |
| A04: Insecure Design | Security-first architecture; audit logging; MFA optional |
| A05: Security Misconfiguration | Security policy module; HTTPS forced; headers set |
| A06: Vulnerable Components | Pinned dependencies; npm audit; GitHub Dependabot |
| A07: Auth Failures | JWT validation; lockout policy; MFA support |
| A08: Software/Data Integrity | TDE at-rest encryption; HTTPS in-transit; audit trail |
| A09: Logging Gaps | Comprehensive audit logging; AuditEventLogger |
| A10: SSRF | No external API calls; closed network scope |

---

### Security Audit Checklist

Before production deployment:

- [ ] JWT secret changed from default
- [ ] CORS origins configured for production domain only
- [ ] HTTPS certificate valid and renewed automatically
- [ ] Rate limiting enabled and tested
- [ ] Security headers deployed
- [ ] MFA policy configured (at least for admins)
- [ ] Password policy meets organizational standards
- [ ] Audit logs being captured and reviewed
- [ ] Admin accounts use MFA
- [ ] Regular security updates applied
- [ ] Backup strategy in place
- [ ] Incident response plan documented

---

## Security Contacts & Resources

**Reporting Security Issues:**
- Do NOT post publicly
- Email: [security contact for organization]
- Include: Issue description, reproduction steps, potential impact

**Security Documentation:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST SP 800-63B (Passwords)](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [RFC 6238 (TOTP)](https://tools.ietf.org/html/rfc6238)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Document Version:** 1.0  
**Last Updated:** May 10, 2026  
**Maintainer:** CMNetwork Development Team

**Classification:** Internal Use  
**Review Cadence:** Quarterly
