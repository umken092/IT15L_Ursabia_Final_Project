# CMNetwork ERP - Backend Integration Guide

## Backend Setup (C# .NET)

### Prerequisites
- .NET 10.0 SDK or later
- Visual Studio 2022 or Visual Studio Code

### Project Structure
```
c:\Users\kennu\CMNetwork\
├── Controllers/
│   ├── AuthController.cs       # Authentication endpoints
│   ├── DashboardController.cs  # Dashboard data endpoints
│   └── HomeController.cs       # Legacy MVC controller
├── Models/
│   ├── AuthModels.cs           # Login request/response DTOs
│   ├── DashboardModels.cs      # Dashboard metric DTOs
│   └── ErrorViewModel.cs       # Error model
├── Services/
│   ├── IAuthService.cs         # Auth service interface
│   ├── AuthService.cs          # JWT authentication implementation
│   ├── IDashboardService.cs    # Dashboard service interface
│   └── DashboardService.cs     # Mock dashboard data service
├── Properties/
│   └── launchSettings.json     # API port configuration
├── appsettings.json            # Production settings (JWT secret, etc.)
├── appsettings.Development.json # Development settings
├── Program.cs                  # App configuration (CORS, JWT, services)
└── CMNetwork.csproj           # Project file
```

### API Endpoints

#### Authentication Endpoints
- `POST /api/auth/login` - User login (returns JWT token)
  ```json
  Request: { "email": "user@cmnetwork.com", "password": "any-password" }
  Response: { "token": "jwt...", "user": { "id", "email", "fullName", "role", "roles" } }
  ```

- `POST /api/auth/logout` - User logout (requires Authorization header)
  ```
  Header: Authorization: Bearer <token>
  Response: { "message": "Logged out successfully" }
  ```

- `POST /api/auth/validate` - Validate JWT token
  ```json
  Request: { "token": "jwt..." }
  Response: { "isValid": true, "user": { ... } }
  ```

- `GET /api/auth/health` - Health check
  ```
  Response: { "status": "Auth service is healthy" }
  ```

#### Dashboard Endpoints (Require Authorization)
- `GET /api/dashboard/{role}/metrics` - Get role-specific KPIs
  ```
  Example: GET /api/dashboard/accountant/metrics
  Response: { "metrics": [ { "title", "value", "subtitle", "progressPercentage", "trendDirection", "trendValue" } ] }
  ```

- `GET /api/dashboard/charts` - Get chart data (6-month revenue/expenses)
  ```
  Response: { "data": [ { "label": "Jan", "series": [ { "name": "Revenue", "values": [...] } ] } ], "type": "line" }
  ```

- `GET /api/dashboard/approvals` - Get pending approvals list
  ```
  Response: { "approvals": [ { "id", "title", "status", "amount", "requestedBy", "requestedDate" } ] }
  ```

- `GET /api/dashboard/audit-activities` - Get recent audit log entries
  ```
  Response: { "activities": [ { "id", "action", "user", "status", "timestamp" } ] }
  ```

- `GET /api/dashboard/health` - Health check (no auth required)

### Running the Backend

#### Option 1: Visual Studio 2022
1. Open `c:\Users\kennu\CMNetwork\CMNetwork.sln` (if exists) or the folder in VS 2022
2. Press `Ctrl+F5` to run without debugging (or `F5` with debugging)
3. App will run on `https://localhost:7288` (default HTTPS port)

#### Option 2: Command Line (PowerShell)
```powershell
cd c:\Users\kennu\CMNetwork
dotnet run
```

The API will be available at:
- HTTPS: `https://localhost:7288/api`
- HTTP: `http://localhost:5244/api` (if HTTP is enabled)

### Testing the Backend

Use Postman or similar tool:

1. **Health Check:**
   ```
   GET https://localhost:7288/api/auth/health
   ```

2. **Login:**
   ```
   POST https://localhost:7288/api/auth/login
   Body: { "email": "accountant@cmnetwork.com", "password": "test" }
   ```
   Copy the returned `token` value.

3. **Get Metrics (with token):**
   ```
   GET https://localhost:7288/api/dashboard/accountant/metrics
   Header: Authorization: Bearer <token-from-login>
   ```

### Test Users

Pre-configured test accounts (accept any password):
- `super-admin@cmnetwork.com` - Super Admin role
- `accountant@cmnetwork.com` - Accountant role
- `faculty-admin@cmnetwork.com` - Faculty Admin role
- `employee@cmnetwork.com` - Employee role
- `viewer@cmnetwork.com` - Authorized Viewer role
- `auditor@cmnetwork.com` - Auditor role
- `cfo@cmnetwork.com` - CFO role
- `multi-cfo-accountant@cmnetwork.com` - Multi-role user (CFO + Accountant)

Or use email keywords to auto-infer roles:
- `john-accountant@test.com` → Accountant role
- `sarah-faculty-admin@test.com` → Faculty Admin role
- `multi-cfo-accountant@test.com` → CFO + Accountant roles

---

## Frontend Setup (React + Vite)

### Prerequisites
- Node.js 18+ and npm

### Project Structure
```
c:\Users\kennu\CMNetwork\cmnetwork-erp\
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RoleDashboardPage.tsx
│   │   ├── LazyDashboards.tsx      # Code-split lazy-loaded dashboards
│   │   ├── dashboards/             # Role-specific dashboards (lazy-loaded)
│   │   └── ModulePlaceholderPage.tsx
│   ├── components/
│   │   └── DashboardCard.tsx
│   ├── layout/
│   │   └── MainLayout.tsx          # Main authenticated layout with role switcher
│   ├── store/
│   │   ├── authStore.ts            # Auth state (user, token, selectedRole)
│   │   └── uiStore.ts              # UI state (theme, sidebar)
│   ├── services/
│   │   ├── apiClient.ts            # Axios HTTP client with auth interceptors
│   │   ├── authService.ts          # Real API fallback to mock
│   │   ├── dashboardService.ts     # Real API fallback to mock
│   │   └── mockAuthApi.ts          # Fallback mock auth
│   ├── router/
│   │   └── AppRouter.tsx
│   ├── routes/
│   │   └── PrivateRoute.tsx
│   ├── types/
│   │   └── auth.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                   # Theme system with CSS variables
├── public/
│   └── CMN.png                     # Logo
├── .env.local                      # Local API URL configuration (DO NOT COMMIT)
├── .env.example                    # Template for environment variables
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Running the Frontend

#### Step 1: Install Dependencies
```bash
cd c:\Users\kennu\CMNetwork\cmnetwork-erp
npm install
```

#### Step 2: Configure API URL
Frontend should already have `.env.local` configured:
```
VITE_API_URL=https://localhost:7288/api
```

If not, create/update `.env.local` with your backend URL.

#### Step 3: Run Development Server
```bash
npm run dev
```
Frontend will be available at `http://localhost:5173/`

#### Step 4: Build for Production
```bash
npm run build
```
Outputs to `dist/` directory.

### Frontend Features

**Implemented:**
- ✅ Hero landing page with CTA
- ✅ Login page with email/password form (React Hook Form validation)
- ✅ 7 role-specific dashboards with mock data
- ✅ JWT-based authentication with token persistence
- ✅ Role-based access control (PrivateRoute guard)
- ✅ Responsive mobile design (sidebar collapse, grid reflow)
- ✅ Light/Dark theme toggle with CSS variables
- ✅ Multi-role user support with role switcher dropdown (MainLayout)
- ✅ Lazy-loaded dashboards (code splitting) for reduced bundle size
- ✅ Axios service layer with real API integration + fallback to mock

**Environment:**
- Dev server: `http://localhost:5173/`
- Vite dev HMR: Built-in hot module replacement
- Build output: `dist/` (production-optimized bundles with code splitting)

---

## Running Both Backend & Frontend

### Terminal 1: Backend (.NET API)
```powershell
cd c:\Users\kennu\CMNetwork
dotnet run
# Output: info: Microsoft.Hosting.Lifetime[14]
#         Now listening on: https://localhost:7288
```

### Terminal 2: Frontend (React + Vite)
```bash
cd c:\Users\kennu\CMNetwork\cmnetwork-erp
npm run dev
# Output: VITE v8.0.10 ready in 279 ms
#         Local: http://localhost:5173/
```

### Testing the Full Stack

1. Open browser to `http://localhost:5173/`
2. Click "Get Started" on landing page → redirects to login
3. Login with `accountant@cmnetwork.com` / (any password)
4. Frontend sends `POST /api/auth/login` to backend
5. Backend returns JWT token + user data
6. Frontend stores token in localStorage
7. Redirected to dashboard with real data from `GET /api/dashboard/accountant/metrics`
8. Sidebar shows role-specific menu and role switcher (if multi-role user)
9. Dashboards lazy-load on navigation (check Network tab in DevTools)

### Multi-Role Testing

1. Login with `multi-cfo-accountant@cmnetwork.com` (CFO + Accountant roles)
2. Sidebar footer shows role switcher dropdown
3. Switch to "Accountant" → sidebar menu updates, dashboard reloads with accountant metrics
4. Switch back to "CFO" → sidebar updates, dashboard shows CFO metrics
5. Token and selectedRole persist in localStorage

---

## API Integration Flow (with Fallback)

When user logs in or navigates to a dashboard:

```
Frontend → Call authService.login() / dashboardService.getMetrics()
           ↓
           Try: POST/GET to https://localhost:7288/api/...
           ↓
           ✅ Success: Use real API response data
           OR
           ❌ Error (network/401/500): Fallback to mock data + console warning
           ↓
           Render dashboard with data (real or mock)
```

This enables development/testing even if backend is down.

---

## Troubleshooting

### Frontend can't reach backend
- **Symptom:** Login fails, dashboard shows mock data
- **Cause:** Backend not running, wrong URL, CORS issue
- **Fix:**
  1. Check backend is running: `netstat -ano | findstr :7288` (PowerShell)
  2. Verify frontend `.env.local` has correct URL: `VITE_API_URL=https://localhost:7288/api`
  3. Check browser DevTools → Network tab for CORS errors
  4. If CORS error, verify `Program.cs` has CORS policy for `http://localhost:5173`

### Login returns "Invalid email or password"
- **Cause:** Email not in pre-configured list
- **Fix:** Use one of the test user emails listed above, OR ensure email contains role keyword (e.g., `test-accountant@company.com`)

### JWT token validation fails
- **Cause:** Secret mismatch between backend and frontend
- **Fix:**
  1. Backend uses `appsettings.json` secret
  2. Frontend doesn't validate (just passes token to backend)
  3. Ensure backend secret matches between appsettings.json and appsettings.Development.json

### Lazy loading not working (all dashboards in main bundle)
- **Fix:** Check browser DevTools → Network tab when switching dashboards
- Expected: Dashboard chunks (AuditorDashboard-*.js, etc.) load on demand
- If all chunks in main bundle: Vite config may need code splitting adjustment

---

## Next Steps for Production

1. **Database Integration:** Replace in-memory `_users` dict in `AuthService` with database queries
2. **Password Hashing:** Implement proper password hashing (BCrypt/Argon2) instead of accepting all passwords
3. **JWT Secret Management:** Move secret to environment variable / secure vault (Azure Key Vault, etc.)
4. **CORS:** Restrict to production frontend URL instead of `localhost:5173`
5. **HTTPS:** Ensure valid SSL certificates (not self-signed dev certs)
6. **Logging:** Integrate centralized logging (Application Insights, Serilog, etc.)
7. **Rate Limiting:** Add API rate limiting to prevent brute-force attacks
8. **Input Validation:** Add comprehensive input validation for all endpoints
9. **API Documentation:** Generate OpenAPI (Swagger) docs with `Swashbuckle.AspNetCore`
10. **Testing:** Add unit tests for services, integration tests for API endpoints
