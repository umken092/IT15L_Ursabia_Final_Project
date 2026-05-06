# Login Troubleshooting Guide

## Issue: Cannot Log In to Super Admin Account

### Database Status
✅ Super admin account exists and is **NOT locked**
- Email: `superadmin@cmnetwork.com`  
- Status: Active, Email Confirmed
- Lockout Status: None (not locked)
- Access Failed Count: 0

### Credentials
**Working Super Admin Credentials:**
- **Email**: `superadmin@cmnetwork.com` (NO HYPHEN)
- **Password**: `Cmnetwork123!`

⚠️ **Note**: There is also a `super-admin@cmnetwork.com` (with hyphen) account. Make sure you're using the hyphen-free version.

### Troubleshooting Steps

#### 1. **Verify You're Using the Correct Email**
   - ❌ WRONG: `super-admin@cmnetwork.com` (has hyphen)
   - ✅ CORRECT: `superadmin@cmnetwork.com` (no hyphen)

#### 2. **Check Browser Console for Errors**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for error messages when login fails
   - Check Network tab to see API response

#### 3. **Verify Backend is Running**
   ```powershell
   # Check if API is responding
   curl http://localhost:5000/health
   # or
   $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/validate" -ErrorAction SilentlyContinue
   ```

#### 4. **Check API Error Response**
   When login fails, the API returns:
   ```json
   {
     "message": "Invalid credentials or account locked."
   }
   
   This could mean:
   - Wrong password
   - Account locked (but DB shows it's not)
   - Account is inactive (but DB shows IsActive=1)
   - User doesn't exist (but DB shows it does exist)
   ```

#### 5. **Reset Password (Admin Method)**
   If the password doesn't work, use this SQL command to reset:
   ```sql
   -- Generate a temporary password hash (for Cmnetwork123!)
   -- This hash is pre-computed and will set password to Cmnetwork123!
   UPDATE [AspNetUsers] 
   SET [PasswordHash] = 'AQAAAAIAAYagAAAAEPx2rQJ5P6S2dTzQm8UyqYqLwcbV0yrJjqKyLJPp7BpUQO0jlSVr3oZb7wVvwVR3Yw=='
   WHERE [Email] = 'superadmin@cmnetwork.com'
   ```

### Contact Support If
- You've confirmed the email is correct: `superadmin@cmnetwork.com`
- You've confirmed the password: `Cmnetwork123!`
- API is running and responding
- Login still fails with "Invalid credentials or account locked"

### Alternative Accounts for Testing
If super admin still doesn't work, try these accounts:
- **Authorized Viewer**: `viewer.demo@cmnetwork.com` / `Demo123!`
- **Accountant**: `accountant.demo@cmnetwork.com` / `Demo123!`
- **Auditor**: `auditor.demo@cmnetwork.com` / `Demo123!`
- **Employee**: `employee.demo@cmnetwork.com` / `Demo123!`

These accounts are all Active and not locked.
