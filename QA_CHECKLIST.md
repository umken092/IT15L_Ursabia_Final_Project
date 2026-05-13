# QA Checklist for Payroll Module

## Purpose
This checklist ensures repeatable and consistent testing of the Payroll Module.

## Pre-requisites
- Backend running on `http://localhost:5128`
- Frontend running on `http://localhost:5173`
- Database seeded with demo data

## Steps

### 1. Validate Login
- **Action:** Log in as `admin@example.com` with password `Admin123!`
- **Expected Output:** Dashboard loads with "Welcome, Admin" message.

### 2. Test Payroll Overview Page
- **Action:** Navigate to Payroll Overview.
- **Expected Output:** List of pay periods displayed with correct statuses.

### 3. Test Pay Period Creation
- **Action:** Create a new pay period for the current month.
- **Expected Output:** Success banner and toast appear. New pay period listed.

### 4. Test Payroll Processing
- **Action:** Process payroll for the latest pay period.
- **Expected Output:** Success banner and toast appear. Status changes to "Processed."

### 5. Test Payroll Approval
- **Action:** Approve the processed payroll.
- **Expected Output:** Success banner and toast appear. Status changes to "Approved."

### 6. Test Payslip Download
- **Action:** Download payslip for an employee.
- **Expected Output:** PDF downloads successfully with correct details.

### 7. Validate Error Handling
- **Action:** Attempt to process payroll for an already approved pay period.
- **Expected Output:** Error toast appears with "Cannot process approved payroll." message.

### 8. Validate Logout
- **Action:** Log out from the application.
- **Expected Output:** Redirected to login page with no errors.

## Notes
- Ensure all success banners and toasts are visible and correctly styled.
- Report any discrepancies or unexpected behavior to the development team.