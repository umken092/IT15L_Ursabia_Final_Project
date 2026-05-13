# Payroll Module UI/UX Overhaul (Final Spec)

## Problem Statement
Accountants, CFOs, and Employees find the Payroll module confusing, with unclear next steps, no actionable feedback, and no way to recover from common errors. Both roles see the same UI, but their workflows and permissions differ. There is no onboarding, advanced navigation, or contextual help, leading to frequent support requests and mistakes.

## Recommended Direction
- Linear stepper as status indicator:
  - Shows current payroll status (Draft -> Submitted -> Rejected -> Approved -> Processed -> Paid).
  - Steps are clickable for read-only review; only the current actionable step shows Edit, Withdraw, Reject, or Re-open as appropriate.
  - Backward transitions (Withdraw, Reject, Re-open) are explicit, permission-controlled actions, not free navigation.
- Role-based UI:
  - Accountant: Full processing flow, Withdraw/Edit when status is Submitted, cannot Re-open after approval.
  - CFO: Approval/rejection, override adjustments, Reject button when status is Submitted, Re-open allowed within 24h of approval and before payment (must provide reason).
  - SuperAdmin: Re-open allowed at any time before Paid, always requires audit log.
  - Employee: Payslip self-service only.
- Contextual placeholders and helper text:
  - Inline guidance for every state (Select a pay period to begin, Click Calculate All to refresh, etc.).
  - Disabled buttons have tooltips explaining why.
- Actionable toasts and inline validation:
  - Success/error toasts after every action, with next steps.
- Advanced navigation/history:
  - Controlled backtracking via Withdraw/Reject/Re-open, not free step-jumping.
  - Stepper is a status indicator, not a locked wizard.
- Multi-currency:
  - MVP: PHP only. All calculations and postings in PHP.
  - Future: Display-only conversion for expat payslips (reference only, not for processing).
- External payroll integrations:
  - MVP: Stubs only (manual entry, PDF payslip).
  - Future priorities: (1) Bank file export (CSV/ABA), (2) BIR forms, (3) SSS/PhilHealth/Pag-IBIG exports.
- Automated onboarding/tutorial flows:
  - First-time user walkthrough, repeatable on demand via Need Help or Payroll Walkthrough button.
  - Non-blocking, can be dismissed and replayed at any time.
- Need Help contextual FAQ:
  - Slide-out panel with role- and page-specific FAQs, searchable and context-sensitive.
  - Inline helper text and tooltips for common stuck points.

## Permission Rules (Final)
- Re-open permission:
  - SuperAdmin: Allowed on any payroll not yet Paid. Full audit log entry required.
  - CFO: Allowed only within 24 hours of approval, and only if not yet Paid. Mandatory reason required.
  - Accountant: Not allowed.

## Onboarding
- Repeatable on demand from Need Help and Payroll Walkthrough trigger.
- Also shown on first visit.

## Multi-Currency Scope
- MVP: PHP only.
- Future: Display-only conversion support.

## External Integration Priority (Post-MVP)
1. Bank file export (BDO/BPI/Metrobank)
2. BIR data exports (2316, 1601C)
3. SSS/PhilHealth/Pag-IBIG export files
4. Full third-party payroll API integration

## Key Assumptions
- Users want a guided, but not rigid, workflow.
- Controlled backtracking is essential for real-world corrections.
- Role-based UI and permissions reduce confusion and errors.
- Contextual help and onboarding reduce support requests.

## MVP Scope
- Stepper/progress bar as a status indicator.
- Role-based UI with explicit Withdraw/Reject/Re-open actions.
- Contextual placeholders, helper text, and tooltips for all states and errors.
- Actionable toasts and inline validation.
- Need Help panel with context-sensitive FAQ.
- Repeatable onboarding/tutorial flow.
- Multi-currency and external integration stubs only.

## Not Doing in MVP
- Free-form jump-to-any-step navigation.
- Full external payroll/payment integrations.
- Multi-currency processing or FX accounting.
- Deep analytics/reporting expansion.
