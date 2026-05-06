using Audit.EntityFramework;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Persistence;

[AuditDbContext(Mode = AuditOptionMode.OptOut)]
public class CMNetworkDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public CMNetworkDbContext(DbContextOptions<CMNetworkDbContext> options) : base(options)
    {
    }

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<SecurityPolicy> SecurityPolicies => Set<SecurityPolicy>();
    public DbSet<IntegrationSetting> IntegrationSettings => Set<IntegrationSetting>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
    public DbSet<EvidenceArchive> EvidenceArchives => Set<EvidenceArchive>();
    public DbSet<BackupRecord> BackupRecords => Set<BackupRecord>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<ChartOfAccount> ChartOfAccounts => Set<ChartOfAccount>();
    public DbSet<FiscalPeriod> FiscalPeriods => Set<FiscalPeriod>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<APInvoice> APInvoices => Set<APInvoice>();
    public DbSet<APInvoiceLine> APInvoiceLines => Set<APInvoiceLine>();
    public DbSet<ARInvoice> ARInvoices => Set<ARInvoice>();
    public DbSet<ARInvoiceLine> ARInvoiceLines => Set<ARInvoiceLine>();
    public DbSet<BankStatement> BankStatements => Set<BankStatement>();
    public DbSet<BankTransaction> BankTransactions => Set<BankTransaction>();
    public DbSet<BankReconciliation> BankReconciliations => Set<BankReconciliation>();
    public DbSet<ExpenseClaim> ExpenseClaims => Set<ExpenseClaim>();
    public DbSet<ApprovalQueue> ApprovalQueue => Set<ApprovalQueue>();
    public DbSet<Payslip> Payslips => Set<Payslip>();
    public DbSet<BudgetReallocationRequest> BudgetReallocationRequests => Set<BudgetReallocationRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Departments ──────────────────────────────────────────────────────────
        var financeId = Guid.Parse("10000000-0000-0000-0000-000000000001");
        var hrId = Guid.Parse("10000000-0000-0000-0000-000000000002");
        var operationsId = Guid.Parse("10000000-0000-0000-0000-000000000003");

        modelBuilder.Entity<Department>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(128).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(512);
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasData(
                new Department { Id = financeId, Code = "FIN", Name = "Finance", Description = "Finance & Accounting" },
                new Department { Id = hrId, Code = "HR", Name = "Human Resources", Description = "Human Resources" },
                new Department { Id = operationsId, Code = "OPS", Name = "Operations", Description = "Operations" }
            );
        });

        // ── ApplicationUser ──────────────────────────────────────────────────────
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(x => x.FirstName).HasMaxLength(64).IsRequired();
            entity.Property(x => x.LastName).HasMaxLength(64).IsRequired();
            entity.Property(x => x.MiddleName).HasMaxLength(64);
            entity.Property(x => x.Gender).HasMaxLength(16);
            entity.Property(x => x.Address).HasMaxLength(512);
            entity.Property(x => x.TIN).HasMaxLength(32);
            entity.Property(x => x.SSS).HasMaxLength(32);
            entity.Property(x => x.AuthenticatorKey).HasMaxLength(256);
        });

        // ── RefreshToken ─────────────────────────────────────────────────────────
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Token).HasMaxLength(512).IsRequired();
            entity.Property(x => x.ReplacedByToken).HasMaxLength(512);
            entity.Property(x => x.RevokedReason).HasMaxLength(256);
            entity.Property(x => x.CreatedByIp).HasMaxLength(45);
            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ── SecurityPolicy ───────────────────────────────────────────────────────
        modelBuilder.Entity<SecurityPolicy>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(128).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Value).HasMaxLength(4000).IsRequired();
            entity.HasData(
                new SecurityPolicy
                {
                    Id = Guid.Parse("30000000-0000-0000-0000-000000000001"),
                    Name = "Password Policy",
                    Description = "Enforce strong passwords and rotation",
                    IsEnabled = true,
                    Value = "Minimum 12 characters, uppercase + numbers + symbols. Rotate every 90 days."
                },
                new SecurityPolicy
                {
                    Id = Guid.Parse("30000000-0000-0000-0000-000000000002"),
                    Name = "Session Timeout",
                    Description = "Automatic logout after inactivity",
                    IsEnabled = true,
                    Value = "30 minutes inactivity timeout"
                }
            );
        });

        modelBuilder.Entity<IntegrationSetting>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(128).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Endpoint).HasMaxLength(512).IsRequired();
        });

        modelBuilder.Entity<AuditLogEntry>(entity =>
        {
            entity.Property(x => x.EntityName).HasMaxLength(128).IsRequired();
            entity.Property(x => x.Action).HasMaxLength(64).IsRequired();
            entity.Property(x => x.ActionCategory).HasMaxLength(32).IsRequired().HasDefaultValue("DataChange");
            entity.Property(x => x.RecordId).HasMaxLength(128);
            entity.Property(x => x.PerformedBy).HasMaxLength(256).IsRequired();
            entity.Property(x => x.UserEmail).HasMaxLength(256);
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasMaxLength(512);
            entity.Property(x => x.ReviewedBy).HasMaxLength(256);
            entity.HasIndex(x => x.CreatedUtc);
            entity.HasIndex(x => x.ActionCategory);
            entity.HasIndex(x => x.UserEmail);
            entity.HasIndex(x => x.EntityName);
        });

        modelBuilder.Entity<EvidenceArchive>(entity =>
        {
            entity.Property(x => x.ArchiveNumber).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2048);
            entity.Property(x => x.FilePath).HasMaxLength(512).IsRequired();
            entity.Property(x => x.FileName).HasMaxLength(256).IsRequired();
            entity.Property(x => x.ContentType).HasMaxLength(128).IsRequired();
            entity.Property(x => x.Checksum).HasMaxLength(128).IsRequired();
            entity.Property(x => x.GeneratedBy).HasMaxLength(256).IsRequired();
            entity.Property(x => x.GeneratedByEmail).HasMaxLength(256);
            entity.HasIndex(x => x.ArchiveNumber).IsUnique();
            entity.HasIndex(x => x.GeneratedUtc);
        });

        modelBuilder.Entity<BackupRecord>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(64).IsRequired();
        });

        modelBuilder.Entity<ChartOfAccount>(entity =>
        {
            entity.Property(x => x.AccountCode).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(256).IsRequired();
            entity.HasIndex(x => x.AccountCode).IsUnique();
            entity.HasOne<ChartOfAccount>()
                .WithMany()
                .HasForeignKey(x => x.ParentAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FiscalPeriod>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<JournalEntry>(entity =>
        {
            entity.Property(x => x.EntryNumber).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(512).IsRequired();
            entity.Property(x => x.ReferenceNo).HasMaxLength(128);
            entity.Property(x => x.CreatedBy).HasMaxLength(256).IsRequired();
            entity.Property(x => x.PostedBy).HasMaxLength(256);
            entity.HasIndex(x => x.EntryNumber).IsUnique();
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.JournalEntry)
                .HasForeignKey(x => x.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JournalEntryLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(512);
            entity.Property(x => x.Debit).HasPrecision(18, 2);
            entity.Property(x => x.Credit).HasPrecision(18, 2);
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Vendor ───────────────────────────────────────────────────────────────
        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.Property(x => x.VendorCode).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(256).IsRequired();
            entity.Property(x => x.ContactPerson).HasMaxLength(128);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.PhoneNumber).HasMaxLength(32);
            entity.Property(x => x.Address).HasMaxLength(512);
            entity.Property(x => x.City).HasMaxLength(128);
            entity.Property(x => x.State).HasMaxLength(64);
            entity.Property(x => x.PostalCode).HasMaxLength(16);
            entity.Property(x => x.Country).HasMaxLength(128);
            entity.Property(x => x.TaxId).HasMaxLength(64);
            entity.Property(x => x.PaymentTerms).HasMaxLength(64);
            entity.Property(x => x.CreditLimit).HasPrecision(18, 2);
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.HasIndex(x => x.VendorCode).IsUnique();
        });

        // ── Customer ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.Property(x => x.CustomerCode).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(256).IsRequired();
            entity.Property(x => x.ContactPerson).HasMaxLength(128);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.PhoneNumber).HasMaxLength(32);
            entity.Property(x => x.Address).HasMaxLength(512);
            entity.Property(x => x.City).HasMaxLength(128);
            entity.Property(x => x.State).HasMaxLength(64);
            entity.Property(x => x.PostalCode).HasMaxLength(16);
            entity.Property(x => x.Country).HasMaxLength(128);
            entity.Property(x => x.TaxId).HasMaxLength(64);
            entity.Property(x => x.PaymentTerms).HasMaxLength(64);
            entity.Property(x => x.CreditLimit).HasPrecision(18, 2);
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.HasIndex(x => x.CustomerCode).IsUnique();
        });

        // ── APInvoice ────────────────────────────────────────────────────────────
        modelBuilder.Entity<APInvoice>(entity =>
        {
            entity.Property(x => x.InvoiceNumber).HasMaxLength(64).IsRequired();
            entity.Property(x => x.InvoiceDate).HasColumnType("datetime2");
            entity.Property(x => x.DueDate).HasColumnType("datetime2");
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.CreatedByUserId).HasMaxLength(256).IsRequired();
            entity.Property(x => x.LastModifiedByUserId).HasMaxLength(256);
            entity.Property(x => x.Status).HasDefaultValue(APInvoiceStatus.Draft);
            entity.Property(x => x.IsDeleted).HasDefaultValue(false);
            entity.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => x.InvoiceNumber).IsUnique();
            entity.HasIndex(x => new { x.VendorId, x.Status });
            entity.HasIndex(x => x.IsDeleted);
        });

        // ── APInvoiceLine ───────────────────────────────────────────────────────
        modelBuilder.Entity<APInvoiceLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(512);
            entity.Property(x => x.Quantity).HasPrecision(18, 4);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.HasOne(x => x.APInvoice)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.APInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.ChartOfAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── ARInvoice ────────────────────────────────────────────────────────────
        modelBuilder.Entity<ARInvoice>(entity =>
        {
            entity.Property(x => x.InvoiceNumber).HasMaxLength(64).IsRequired();
            entity.Property(x => x.InvoiceDate).HasColumnType("datetime2");
            entity.Property(x => x.DueDate).HasColumnType("datetime2");
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.CreatedByUserId).HasMaxLength(256).IsRequired();
            entity.Property(x => x.LastModifiedByUserId).HasMaxLength(256);
            entity.Property(x => x.Status).HasDefaultValue(ARInvoiceStatus.Draft);
            entity.Property(x => x.IsDeleted).HasDefaultValue(false);
            entity.HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => x.InvoiceNumber).IsUnique();
            entity.HasIndex(x => new { x.CustomerId, x.Status });
            entity.HasIndex(x => x.IsDeleted);
        });

        // ── ARInvoiceLine ───────────────────────────────────────────────────────
        modelBuilder.Entity<ARInvoiceLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(512);
            entity.Property(x => x.Quantity).HasPrecision(18, 4);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.HasOne(x => x.ARInvoice)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.ARInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.ChartOfAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ── BankStatement ─────────────────────────────────────────────────────
        modelBuilder.Entity<BankStatement>(entity =>
        {
            entity.Property(x => x.BankAccountName).HasMaxLength(128).IsRequired();
            entity.Property(x => x.BankAccountNumber).HasMaxLength(64);
            entity.Property(x => x.ImportedBy).HasMaxLength(256).IsRequired();
            entity.Property(x => x.OpeningBalance).HasPrecision(18, 2);
            entity.Property(x => x.ClosingBalance).HasPrecision(18, 2);
            entity.HasOne(x => x.FiscalPeriod)
                .WithMany()
                .HasForeignKey(x => x.FiscalPeriodId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(x => x.Transactions)
                .WithOne(x => x.BankStatement)
                .HasForeignKey(x => x.BankStatementId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Reconciliation)
                .WithOne(x => x.BankStatement)
                .HasForeignKey<BankReconciliation>(x => x.BankStatementId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ── BankTransaction ───────────────────────────────────────────────────
        modelBuilder.Entity<BankTransaction>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(512).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(128);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.MatchedBy).HasMaxLength(256);
            entity.HasOne(x => x.MatchedJournalEntryLine)
                .WithMany()
                .HasForeignKey(x => x.MatchedJournalEntryLineId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── BankReconciliation ────────────────────────────────────────────────
        modelBuilder.Entity<BankReconciliation>(entity =>
        {
            entity.Property(x => x.BankAccountName).HasMaxLength(128).IsRequired();
            entity.Property(x => x.CreatedBy).HasMaxLength(256).IsRequired();
            entity.Property(x => x.FinalizedBy).HasMaxLength(256);
            entity.Property(x => x.Notes).HasMaxLength(1024);
            entity.Property(x => x.Difference).HasPrecision(18, 2);
        });

        // ── ExpenseClaim ──────────────────────────────────────────────────────
        modelBuilder.Entity<ExpenseClaim>(entity =>
        {
            entity.Property(x => x.ClaimNumber).HasMaxLength(32).IsRequired();
            entity.Property(x => x.EmployeeName).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(512).IsRequired();
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.MerchantName).HasMaxLength(256);
            entity.Property(x => x.ProjectCode).HasMaxLength(64);
            entity.Property(x => x.ReceiptUrl).HasMaxLength(1024);
            entity.Property(x => x.ReviewedBy).HasMaxLength(256);
            entity.Property(x => x.ReviewNotes).HasMaxLength(512);
            entity.HasIndex(x => x.ClaimNumber).IsUnique();
            entity.HasIndex(x => x.EmployeeId);
        });

        // ── ApprovalQueue ─────────────────────────────────────────────────────
        modelBuilder.Entity<ApprovalQueue>(entity =>
        {
            entity.Property(x => x.EntityType).HasMaxLength(64).IsRequired();
            entity.Property(x => x.EntityDescription).HasMaxLength(512).IsRequired();
            entity.Property(x => x.RequestedByUserId).HasMaxLength(256).IsRequired();
            entity.Property(x => x.RequestedByName).HasMaxLength(256).IsRequired();
            entity.Property(x => x.RequiredApproverRole).HasMaxLength(64).IsRequired();
            entity.Property(x => x.ProcessedByUserId).HasMaxLength(256);
            entity.Property(x => x.ProcessedByName).HasMaxLength(256);
            entity.Property(x => x.Notes).HasMaxLength(512);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
        });

        // ── Payslip ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Payslip>(entity =>
        {
            entity.Property(x => x.PayslipNumber).HasMaxLength(32).IsRequired();
            entity.Property(x => x.EmployeeName).HasMaxLength(256).IsRequired();
            entity.Property(x => x.GrossPay).HasPrecision(18, 2);
            entity.Property(x => x.TaxDeduction).HasPrecision(18, 2);
            entity.Property(x => x.SssDeduction).HasPrecision(18, 2);
            entity.Property(x => x.PhilHealthDeduction).HasPrecision(18, 2);
            entity.Property(x => x.PagIbigDeduction).HasPrecision(18, 2);
            entity.Property(x => x.OtherDeductions).HasPrecision(18, 2);
            entity.Property(x => x.NetPay).HasPrecision(18, 2);
            entity.Property(x => x.GeneratedBy).HasMaxLength(256).IsRequired();
            entity.HasIndex(x => x.PayslipNumber).IsUnique();
        });

        // ── BudgetReallocationRequest ─────────────────────────────────────────
        modelBuilder.Entity<BudgetReallocationRequest>(entity =>
        {
            entity.Property(x => x.RequestNumber).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Currency).HasMaxLength(8).IsRequired();
            entity.Property(x => x.Justification).HasMaxLength(1024).IsRequired();
            entity.Property(x => x.RequestedByUserId).HasMaxLength(256).IsRequired();
            entity.Property(x => x.RequestedByName).HasMaxLength(256).IsRequired();
            entity.Property(x => x.ProcessedByName).HasMaxLength(256);
            entity.Property(x => x.DecisionNotes).HasMaxLength(1024);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.HasIndex(x => x.RequestNumber).IsUnique();
            entity.HasOne<Department>()
                .WithMany()
                .HasForeignKey(x => x.SourceDepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Department>()
                .WithMany()
                .HasForeignKey(x => x.TargetDepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    // ── Audit log immutability ──────────────────────────────────────────────
    // AuditLogs are insert-only. Deletes are always blocked. Updates are
    // blocked except when ONLY the review-tracking fields change (so
    // administrators can mark entries as reviewed without tampering with
    // the original record).
    public override int SaveChanges()
    {
        EnforceAuditLogImmutability();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        EnforceAuditLogImmutability();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void EnforceAuditLogImmutability()
    {
        var allowedReviewProps = new HashSet<string>(StringComparer.Ordinal)
        {
            nameof(AuditLogEntry.IsReviewed),
            nameof(AuditLogEntry.ReviewedBy),
            nameof(AuditLogEntry.ReviewedDate)
        };

        foreach (var entry in ChangeTracker.Entries<AuditLogEntry>())
        {
            if (entry.State == EntityState.Deleted)
            {
                throw new InvalidOperationException("Audit log entries are immutable and cannot be deleted.");
            }

            if (entry.State == EntityState.Modified)
            {
                var modifiedProps = entry.Properties
                    .Where(p => p.IsModified)
                    .Select(p => p.Metadata.Name)
                    .ToList();

                if (modifiedProps.Any(p => !allowedReviewProps.Contains(p)))
                {
                    throw new InvalidOperationException(
                        "Audit log entries are immutable. Only review-tracking fields may be updated.");
                }
            }
        }
    }
}
