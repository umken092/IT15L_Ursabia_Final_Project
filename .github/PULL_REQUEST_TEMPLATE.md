## Summary
<!-- One sentence: what does this PR do and why? -->

## Type of Change
- [ ] Bug fix
- [ ] New feature / endpoint
- [ ] Refactor (no behaviour change)
- [ ] Database migration
- [ ] Deployment / infra change
- [ ] Documentation only

## Accounting & Financial Risk Checklist
> Required for any change touching GL, AP, AR, Payroll, Budgets, or Expense Claims.

- [ ] No monetary values computed in the UI — all totals come from the API
- [ ] New entity fields with financial meaning are audited by `[AuditDbContext]` (verify in `CMNetworkDbContext`)
- [ ] Any status transition (Approved → Paid, etc.) is guarded server-side; client cannot skip states
- [ ] Double-entry: every debit has a matching credit; no orphaned GL lines possible
- [ ] Soft-delete only — no `DELETE` statements on financial records

## Database Changes
- [ ] EF Core migration added (`dotnet ef migrations add <Name>`)
- [ ] Migration is non-destructive (additive only — no column drops/renames without data guard)
- [ ] Tested against LocalDB (`dotnet run` with Development settings)

## API Changes
- [ ] All error responses use `ApiError` shape `{ status, message, errors?, traceId? }`
- [ ] New endpoints are `[Authorize]` with correct role policy
- [ ] Swagger / OpenAPI spec still generates without errors

## Security
- [ ] No raw SQL or string-interpolated queries (use EF LINQ or parameterized)
- [ ] User-supplied file paths/names are sanitised before use
- [ ] No secrets or credentials in source (use User Secrets / env vars)
- [ ] CORS policy unchanged, or change is intentional and documented

## Frontend
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build` passes (tsc strict + Vite)
- [ ] New UI actions go through `apiClient.ts` (no raw `fetch`/`axios` calls)
- [ ] Error responses from `ApiError` are surfaced to the user (not silently swallowed)

## Testing
- [ ] Smoke-tested locally: `GET /api/auth/health` → 200
- [ ] Tested the happy path end-to-end for affected workflows
- [ ] Tested at least one error/rejection path

## Secrets & Artifacts
- [ ] `git diff --staged` checked — no passwords, secrets, or DSNs in the diff
- [ ] `artifacts/` changes (if any) are intentional and explained below
- [ ] No `appsettings.Development.json` with real credentials committed

## Definition of Done
All boxes below must be checked before requesting review.

- [ ] `dotnet build CMNetwork.sln` → 0 errors
- [ ] `npm run lint` → 0 errors
- [ ] `npm run build` → 0 errors
- [ ] PR template fully filled in (no unchecked boxes left unchecked by accident)
- [ ] CODEOWNERS path touched → owner assigned as reviewer

## Deployment Notes
<!-- Anything the deployer needs to know: env vars to set, feature flags, manual DB steps, migration impact -->
