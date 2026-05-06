using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

/// <summary>
/// Service for automatically posting invoices to the General Ledger.
/// </summary>
public interface IInvoicePostingService
{
    Task PostAPInvoiceAsync(Guid invoiceId);
    Task PostARInvoiceAsync(Guid invoiceId);
}

public class InvoicePostingService : IInvoicePostingService
{
    private readonly CMNetworkDbContext _dbContext;
    private readonly ILogger<InvoicePostingService> _logger;

    // Standard GL account codes (from seeding)
    private const string ACCOUNTS_PAYABLE_CODE = "2000";
    private const string ACCOUNTS_RECEIVABLE_CODE = "1100";

    public InvoicePostingService(
        CMNetworkDbContext dbContext,
        ILogger<InvoicePostingService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Post an AP Invoice to GL when approved.
    /// Creates a balanced journal entry:
    /// - Debit: Expense accounts (from invoice lines)
    /// - Credit: Accounts Payable control account
    /// </summary>
    public async Task PostAPInvoiceAsync(Guid invoiceId)
    {
        try
        {
            var invoice = await _dbContext.APInvoices
                .Include(x => x.Lines)
                .Include(x => x.Vendor)
                .FirstOrDefaultAsync(x => x.Id == invoiceId && !x.IsDeleted);

            if (invoice == null)
                throw new InvalidOperationException($"AP Invoice {invoiceId} not found");

            if (invoice.Status != APInvoiceStatus.Approved)
                throw new InvalidOperationException($"Invoice must be in Approved status to post (current: {invoice.Status})");

            if (!invoice.Lines.Any())
                throw new InvalidOperationException("Invoice has no lines");

            // Get or create AP control account
            var apAccount = await _dbContext.ChartOfAccounts
                .FirstOrDefaultAsync(x => x.AccountCode == ACCOUNTS_PAYABLE_CODE && x.IsActive);

            if (apAccount == null)
                throw new InvalidOperationException($"Accounts Payable control account ({ACCOUNTS_PAYABLE_CODE}) not found");

            // Create journal entry
            var entry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                EntryNumber = $"AP-{invoice.InvoiceNumber}-{DateTime.UtcNow:yyyyMMdd}",
                EntryDate = DateOnly.FromDateTime(invoice.InvoiceDate),
                Description = $"AP Invoice posting: {invoice.Vendor.Name} - Invoice #{invoice.InvoiceNumber}",
                ReferenceNo = invoice.InvoiceNumber,
                Status = JournalEntryStatus.Posted,
                CreatedBy = invoice.CreatedByUserId,
                CreatedUtc = DateTime.UtcNow,
                PostedBy = invoice.CreatedByUserId,
                PostedUtc = DateTime.UtcNow
            };

            decimal totalDebit = 0;

            // Add debit lines for each expense line
            foreach (var line in invoice.Lines)
            {
                var account = await _dbContext.ChartOfAccounts
                    .FirstOrDefaultAsync(x => x.Id == line.ChartOfAccountId && x.IsActive);

                if (account == null)
                    throw new InvalidOperationException($"Account {line.ChartOfAccountId} not found");

                var debitAmount = line.Amount + (line.TaxAmount ?? 0);
                totalDebit += debitAmount;

                entry.Lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = entry.Id,
                    AccountId = line.ChartOfAccountId,
                    Description = $"{line.Description} (Q: {line.Quantity} x {line.UnitPrice})",
                    Debit = debitAmount,
                    Credit = 0
                });
            }

            // Add credit line to AP control account
            entry.Lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = entry.Id,
                AccountId = apAccount.Id,
                Description = $"Accounts Payable - {invoice.Vendor.Name}",
                Debit = 0,
                Credit = totalDebit
            });

            _dbContext.JournalEntries.Add(entry);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation(
                $"AP Invoice {invoiceId} ({invoice.InvoiceNumber}) posted to GL. " +
                $"Journal Entry: {entry.EntryNumber}, Amount: {totalDebit:C}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to post AP Invoice {invoiceId} to GL");
            throw;
        }
    }

    /// <summary>
    /// Post an AR Invoice to GL when sent/generated.
    /// Creates a balanced journal entry:
    /// - Debit: Accounts Receivable control account
    /// - Credit: Revenue accounts (from invoice lines)
    /// </summary>
    public async Task PostARInvoiceAsync(Guid invoiceId)
    {
        try
        {
            var invoice = await _dbContext.ARInvoices
                .Include(x => x.Lines)
                .Include(x => x.Customer)
                .FirstOrDefaultAsync(x => x.Id == invoiceId && !x.IsDeleted);

            if (invoice == null)
                throw new InvalidOperationException($"AR Invoice {invoiceId} not found");

            if (invoice.Status != ARInvoiceStatus.Sent)
                throw new InvalidOperationException($"Invoice must be in Sent status to post (current: {invoice.Status})");

            if (!invoice.Lines.Any())
                throw new InvalidOperationException("Invoice has no lines");

            // Get or create AR control account
            var arAccount = await _dbContext.ChartOfAccounts
                .FirstOrDefaultAsync(x => x.AccountCode == ACCOUNTS_RECEIVABLE_CODE && x.IsActive);

            if (arAccount == null)
                throw new InvalidOperationException($"Accounts Receivable control account ({ACCOUNTS_RECEIVABLE_CODE}) not found");

            // Create journal entry
            var entry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                EntryNumber = $"AR-{invoice.InvoiceNumber}-{DateTime.UtcNow:yyyyMMdd}",
                EntryDate = DateOnly.FromDateTime(invoice.InvoiceDate),
                Description = $"AR Invoice posting: {invoice.Customer.Name} - Invoice #{invoice.InvoiceNumber}",
                ReferenceNo = invoice.InvoiceNumber,
                Status = JournalEntryStatus.Posted,
                CreatedBy = invoice.CreatedByUserId,
                CreatedUtc = DateTime.UtcNow,
                PostedBy = invoice.CreatedByUserId,
                PostedUtc = DateTime.UtcNow
            };

            decimal totalCredit = 0;

            // Add credit lines for each revenue line
            foreach (var line in invoice.Lines)
            {
                var account = await _dbContext.ChartOfAccounts
                    .FirstOrDefaultAsync(x => x.Id == line.ChartOfAccountId && x.IsActive);

                if (account == null)
                    throw new InvalidOperationException($"Account {line.ChartOfAccountId} not found");

                var creditAmount = line.Amount + (line.TaxAmount ?? 0);
                totalCredit += creditAmount;

                entry.Lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = entry.Id,
                    AccountId = line.ChartOfAccountId,
                    Description = $"{line.Description} (Q: {line.Quantity} x {line.UnitPrice})",
                    Debit = 0,
                    Credit = creditAmount
                });
            }

            // Add debit line to AR control account
            entry.Lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = entry.Id,
                AccountId = arAccount.Id,
                Description = $"Accounts Receivable - {invoice.Customer.Name}",
                Debit = totalCredit,
                Credit = 0
            });

            _dbContext.JournalEntries.Add(entry);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation(
                $"AR Invoice {invoiceId} ({invoice.InvoiceNumber}) posted to GL. " +
                $"Journal Entry: {entry.EntryNumber}, Amount: {totalCredit:C}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to post AR Invoice {invoiceId} to GL");
            throw;
        }
    }
}
