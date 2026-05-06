namespace CMNetwork.Domain.Entities;

/// <summary>
/// Immutable audit log entry. Entries are insert-only; the EF SaveChanges
/// override on <c>CMNetworkDbContext</c> blocks any update or delete.
/// Audit.NET ignores this entity (configured in <c>Program.cs</c>) to
/// avoid recursive auditing of the audit table itself.
/// </summary>
public class AuditLogEntry
{
    public Guid Id { get; set; }

    /// <summary>Audited entity name or, for non-EF events, the logical event name.</summary>
    public string EntityName { get; set; } = string.Empty;

    /// <summary>Action performed (Insert/Update/Delete/Login/Logout/Approve/...).</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>High-level grouping for filtering (DataChange, Login, Logout, Approval, Export, Security, ApiRequest...).</summary>
    public string ActionCategory { get; set; } = "DataChange";

    /// <summary>Primary key of the affected entity (for data changes), or correlation id.</summary>
    public string? RecordId { get; set; }

    /// <summary>User identifier (typically the IdentityUser GUID) or "system".</summary>
    public string PerformedBy { get; set; } = string.Empty;

    /// <summary>Denormalised user email for fast querying.</summary>
    public string? UserEmail { get; set; }

    /// <summary>Client IP address at the time of the action.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Client user agent at the time of the action.</summary>
    public string? UserAgent { get; set; }

    /// <summary>Free-form JSON payload (Audit.NET event, before/after values, request body, etc.).</summary>
    public string? DetailsJson { get; set; }

    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    // ── Review tracking ─────────────────────────────────────────────────────
    public bool IsReviewed { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedDate { get; set; }
}
