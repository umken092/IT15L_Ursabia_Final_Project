using System.Security.Claims;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/bank-reconciliation")]
[Authorize(Roles = "accountant,cfo,super-admin")]
public class BankReconciliationController : ControllerBase
{
    private readonly CMNetworkDbContext _db;

    public BankReconciliationController(CMNetworkDbContext db)
    {
        _db = db;
    }

    // ── Statements ───────────────────────────────────────────────────────────

    [HttpGet("statements")]
    public async Task<IActionResult> GetStatements()
    {
        var items = await _db.BankStatements
            .Include(x => x.Reconciliation)
            .OrderByDescending(x => x.StatementDate)
            .Select(x => new
            {
                x.Id,
                x.BankAccountName,
                x.BankAccountNumber,
                x.StatementDate,
                x.OpeningBalance,
                x.ClosingBalance,
                x.FiscalPeriodId,
                x.ImportedBy,
                x.ImportedAtUtc,
                reconciliationStatus = x.Reconciliation == null ? "None" : x.Reconciliation.Status.ToString(),
                reconciliationId = x.Reconciliation == null ? (Guid?)null : x.Reconciliation.Id,
                transactionCount = x.Transactions.Count,
                matchedCount = x.Transactions.Count(t => t.IsMatched)
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("statements")]
    public async Task<IActionResult> ImportStatement([FromBody] ImportStatementRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var statement = new BankStatement
        {
            Id = Guid.NewGuid(),
            BankAccountName = request.BankAccountName.Trim(),
            BankAccountNumber = request.BankAccountNumber?.Trim(),
            StatementDate = request.StatementDate,
            OpeningBalance = request.OpeningBalance,
            ClosingBalance = request.ClosingBalance,
            FiscalPeriodId = request.FiscalPeriodId,
            ImportedBy = GetCurrentUser(),
            ImportedAtUtc = DateTime.UtcNow
        };

        statement.Transactions = request.Transactions.Select(t => new BankTransaction
        {
            Id = Guid.NewGuid(),
            BankStatementId = statement.Id,
            TransactionDate = t.TransactionDate,
            Description = t.Description.Trim(),
            Reference = t.Reference?.Trim(),
            Amount = Math.Abs(t.Amount),
            IsDebit = t.Amount < 0 || t.IsDebit,
            IsMatched = false
        }).ToList();

        // Create an open reconciliation for this statement
        var reconciliation = new BankReconciliation
        {
            Id = Guid.NewGuid(),
            BankStatementId = statement.Id,
            BankAccountName = statement.BankAccountName,
            Status = BankReconciliationStatus.Open,
            CreatedBy = GetCurrentUser(),
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.BankStatements.Add(statement);
        _db.BankReconciliations.Add(reconciliation);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetStatement), new { id = statement.Id }, new { statementId = statement.Id, reconciliationId = reconciliation.Id });
    }

    [HttpGet("statements/{id:guid}")]
    public async Task<IActionResult> GetStatement(Guid id)
    {
        var statement = await _db.BankStatements
            .Include(x => x.Transactions)
            .Include(x => x.Reconciliation)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (statement is null)
            return NotFound(new { message = "Bank statement not found." });

        return Ok(statement);
    }

    // ── Unmatched Transactions ────────────────────────────────────────────────

    [HttpGet("statements/{id:guid}/unmatched-transactions")]
    public async Task<IActionResult> GetUnmatchedTransactions(Guid id)
    {
        var exists = await _db.BankStatements.AnyAsync(x => x.Id == id);
        if (!exists)
            return NotFound(new { message = "Bank statement not found." });

        var transactions = await _db.BankTransactions
            .Where(x => x.BankStatementId == id && !x.IsMatched)
            .OrderBy(x => x.TransactionDate)
            .Select(x => new
            {
                x.Id,
                x.TransactionDate,
                x.Description,
                x.Reference,
                x.Amount,
                x.IsDebit,
                x.IsMatched
            })
            .ToListAsync();

        return Ok(transactions);
    }

    // ── Unmatched GL Lines ────────────────────────────────────────────────────

    [HttpGet("unmatched-gl-lines")]
    public async Task<IActionResult> GetUnmatchedGlLines([FromQuery] Guid? periodId = null)
    {
        var query = _db.JournalEntryLines
            .Include(x => x.JournalEntry)
            .Include(x => x.Account)
            .Where(x =>
                x.JournalEntry != null &&
                x.JournalEntry.Status == JournalEntryStatus.Posted &&
                !_db.BankTransactions.Any(bt => bt.MatchedJournalEntryLineId == x.Id));

        if (periodId.HasValue)
        {
            var period = await _db.FiscalPeriods.FirstOrDefaultAsync(x => x.Id == periodId.Value);
            if (period is not null)
                query = query.Where(x => x.JournalEntry!.EntryDate >= period.StartDate && x.JournalEntry.EntryDate <= period.EndDate);
        }

        var lines = await query
            .OrderByDescending(x => x.JournalEntry!.EntryDate)
            .Select(x => new
            {
                x.Id,
                journalEntryId = x.JournalEntryId,
                entryNumber = x.JournalEntry!.EntryNumber,
                entryDate = x.JournalEntry.EntryDate,
                accountCode = x.Account!.AccountCode,
                accountName = x.Account.Name,
                x.Description,
                x.Debit,
                x.Credit
            })
            .ToListAsync();

        return Ok(lines);
    }

    // ── Match / Unmatch ───────────────────────────────────────────────────────

    [HttpPost("match")]
    public async Task<IActionResult> Match([FromBody] MatchRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var transaction = await _db.BankTransactions.FirstOrDefaultAsync(x => x.Id == request.BankTransactionId);
        if (transaction is null)
            return NotFound(new { message = "Bank transaction not found." });

        if (transaction.IsMatched)
            return BadRequest(new { message = "Bank transaction is already matched." });

        var glLine = await _db.JournalEntryLines
            .Include(x => x.JournalEntry)
            .FirstOrDefaultAsync(x => x.Id == request.JournalEntryLineId);

        if (glLine is null)
            return NotFound(new { message = "GL journal entry line not found." });

        if (glLine.JournalEntry?.Status != JournalEntryStatus.Posted)
            return BadRequest(new { message = "Only lines from posted journal entries can be matched." });

        var alreadyMatched = await _db.BankTransactions.AnyAsync(x => x.MatchedJournalEntryLineId == request.JournalEntryLineId);
        if (alreadyMatched)
            return Conflict(new { message = "This GL line is already matched to another transaction." });

        transaction.IsMatched = true;
        transaction.MatchedJournalEntryLineId = request.JournalEntryLineId;
        transaction.MatchedBy = GetCurrentUser();
        transaction.MatchedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await UpdateReconciliationDifference(transaction.BankStatementId);

        return Ok(new { message = "Matched successfully." });
    }

    [HttpPost("unmatch")]
    public async Task<IActionResult> Unmatch([FromBody] UnmatchRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var transaction = await _db.BankTransactions.FirstOrDefaultAsync(x => x.Id == request.BankTransactionId);
        if (transaction is null)
            return NotFound(new { message = "Bank transaction not found." });

        if (!transaction.IsMatched)
            return BadRequest(new { message = "Bank transaction is not matched." });

        // Ensure statement is not finalized
        var statement = await _db.BankStatements
            .Include(x => x.Reconciliation)
            .FirstOrDefaultAsync(x => x.Id == transaction.BankStatementId);

        if (statement?.Reconciliation?.Status == BankReconciliationStatus.Finalized)
            return BadRequest(new { message = "Cannot unmatch transactions in a finalized reconciliation." });

        transaction.IsMatched = false;
        transaction.MatchedJournalEntryLineId = null;
        transaction.MatchedBy = null;
        transaction.MatchedAtUtc = null;

        await _db.SaveChangesAsync();
        await UpdateReconciliationDifference(transaction.BankStatementId);

        return Ok(new { message = "Unmatched successfully." });
    }

    // ── Difference ────────────────────────────────────────────────────────────

    [HttpGet("statements/{id:guid}/difference")]
    public async Task<IActionResult> GetDifference(Guid id)
    {
        var statement = await _db.BankStatements
            .Include(x => x.Transactions)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (statement is null)
            return NotFound(new { message = "Bank statement not found." });

        var matchedTotal = statement.Transactions
            .Where(x => x.IsMatched)
            .Sum(x => x.IsDebit ? -x.Amount : x.Amount);

        var difference = statement.ClosingBalance - statement.OpeningBalance - matchedTotal;

        return Ok(new
        {
            statementId = id,
            openingBalance = statement.OpeningBalance,
            closingBalance = statement.ClosingBalance,
            matchedTransactions = statement.Transactions.Count(x => x.IsMatched),
            unmatchedTransactions = statement.Transactions.Count(x => !x.IsMatched),
            matchedTotal = decimal.Round(matchedTotal, 2),
            difference = decimal.Round(difference, 2),
            isBalanced = difference == 0
        });
    }

    // ── Finalize ──────────────────────────────────────────────────────────────

    [HttpPost("finalize")]
    public async Task<IActionResult> Finalize([FromBody] FinalizeReconciliationRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var reconciliation = await _db.BankReconciliations
            .Include(x => x.BankStatement)
            .ThenInclude(bs => bs!.Transactions)
            .FirstOrDefaultAsync(x => x.Id == request.ReconciliationId);

        if (reconciliation is null)
            return NotFound(new { message = "Reconciliation not found." });

        if (reconciliation.Status == BankReconciliationStatus.Finalized)
            return BadRequest(new { message = "Reconciliation is already finalized." });

        var statement = reconciliation.BankStatement;
        if (statement is null)
            return BadRequest(new { message = "Bank statement not found." });

        var unmatchedCount = statement.Transactions.Count(x => !x.IsMatched);
        if (unmatchedCount > 0 && !request.ForceFinalize)
            return BadRequest(new { message = $"There are {unmatchedCount} unmatched transactions. Set forceFinalize=true to finalize anyway." });

        reconciliation.Status = BankReconciliationStatus.Finalized;
        reconciliation.FinalizedBy = GetCurrentUser();
        reconciliation.FinalizedAtUtc = DateTime.UtcNow;
        reconciliation.Notes = request.Notes?.Trim();

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Reconciliation finalized.",
            reconciliationId = reconciliation.Id,
            finalizedAtUtc = reconciliation.FinalizedAtUtc
        });
    }

    // ── History ───────────────────────────────────────────────────────────────

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var items = await _db.BankReconciliations
            .Include(x => x.BankStatement)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.BankAccountName,
                x.Status,
                x.Difference,
                x.CreatedBy,
                x.CreatedAtUtc,
                x.FinalizedBy,
                x.FinalizedAtUtc,
                x.Notes,
                statementDate = x.BankStatement != null ? x.BankStatement.StatementDate : (DateOnly?)null
            })
            .ToListAsync();

        return Ok(items);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private string GetCurrentUser()
    {
        return User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? "system";
    }

    private async Task UpdateReconciliationDifference(Guid statementId)
    {
        var statement = await _db.BankStatements
            .Include(x => x.Transactions)
            .Include(x => x.Reconciliation)
            .FirstOrDefaultAsync(x => x.Id == statementId);

        if (statement?.Reconciliation is null) return;

        var matchedTotal = statement.Transactions
            .Where(x => x.IsMatched)
            .Sum(x => x.IsDebit ? -x.Amount : x.Amount);

        statement.Reconciliation.Difference = decimal.Round(
            statement.ClosingBalance - statement.OpeningBalance - matchedTotal, 2);

        await _db.SaveChangesAsync();
    }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public record ImportStatementTransactionItem
{
    public DateOnly TransactionDate { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? Reference { get; init; }
    public decimal Amount { get; init; }
    public bool IsDebit { get; init; }
}

public record ImportStatementRequest
{
    public string BankAccountName { get; init; } = string.Empty;
    public string? BankAccountNumber { get; init; }
    public DateOnly StatementDate { get; init; }
    public decimal OpeningBalance { get; init; }
    public decimal ClosingBalance { get; init; }
    public Guid? FiscalPeriodId { get; init; }
    public List<ImportStatementTransactionItem> Transactions { get; init; } = new();
}

public record MatchRequest
{
    public Guid BankTransactionId { get; init; }
    public Guid JournalEntryLineId { get; init; }
}

public record UnmatchRequest
{
    public Guid BankTransactionId { get; init; }
}

public record FinalizeReconciliationRequest
{
    public Guid ReconciliationId { get; init; }
    public string? Notes { get; init; }
    public bool ForceFinalize { get; init; }
}
