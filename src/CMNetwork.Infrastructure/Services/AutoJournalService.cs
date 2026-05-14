using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CMNetwork.Infrastructure.Services;

public sealed class AutoJournalService : IAutoJournalService
{
    private readonly CMNetworkDbContext _db;
    private readonly ILogger<AutoJournalService> _logger;

    private const string CashAccountCode = "1000";
    private const string AccountsReceivableCode = "1100";

    public AutoJournalService(CMNetworkDbContext db, ILogger<AutoJournalService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task PostCustomerCashReceiptAsync(
        decimal amount,
        string description,
        string referenceNo,
        string createdBy,
        CancellationToken cancellationToken = default)
    {
        var cashAccount = await _db.ChartOfAccounts
            .FirstOrDefaultAsync(x => x.AccountCode == CashAccountCode && x.IsActive, cancellationToken);
        var arAccount = await _db.ChartOfAccounts
            .FirstOrDefaultAsync(x => x.AccountCode == AccountsReceivableCode && x.IsActive, cancellationToken);

        if (cashAccount is null || arAccount is null)
        {
            _logger.LogWarning("Unable to post automatic cash receipt journal. Missing COA accounts {CashCode}/{ArCode}.", CashAccountCode, AccountsReceivableCode);
            return;
        }

        var entryId = Guid.NewGuid();
        var suffix = DateTime.UtcNow.ToString("yyyyMMddHHmmss");

        var entry = new JournalEntry
        {
            Id = entryId,
            EntryNumber = $"CR-{suffix}",
            EntryDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Description = description,
            ReferenceNo = referenceNo,
            Status = JournalEntryStatus.Posted,
            CreatedBy = createdBy,
            CreatedUtc = DateTime.UtcNow,
            PostedBy = createdBy,
            PostedUtc = DateTime.UtcNow,
            Lines =
            [
                new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = entryId,
                    AccountId = cashAccount.Id,
                    Description = "Customer portal receipt - debit cash",
                    Debit = amount,
                    Credit = 0m,
                },
                new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = entryId,
                    AccountId = arAccount.Id,
                    Description = "Customer portal receipt - credit accounts receivable",
                    Debit = 0m,
                    Credit = amount,
                }
            ]
        };

        _db.JournalEntries.Add(entry);
    }
}
