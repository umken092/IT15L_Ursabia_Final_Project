using System.ComponentModel.DataAnnotations;
using CMNetwork.Domain.Entities;

namespace CMNetwork.Models;

public class CreateAccountRequest
{
    [Required]
    [MaxLength(32)]
    public string AccountCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public AccountType Type { get; set; }

    public Guid? ParentAccountId { get; set; }
}

public class UpdateAccountRequest
{
    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public AccountType Type { get; set; }

    public Guid? ParentAccountId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CreateFiscalPeriodRequest
{
    [Required]
    [MaxLength(64)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public DateOnly StartDate { get; set; }

    [Required]
    public DateOnly EndDate { get; set; }
}

public class JournalLineRequest
{
    [Required]
    public Guid AccountId { get; set; }

    [MaxLength(512)]
    public string? Description { get; set; }

    [Range(0, 9999999999999999.99)]
    public decimal Debit { get; set; }

    [Range(0, 9999999999999999.99)]
    public decimal Credit { get; set; }
}

public class CreateJournalEntryRequest
{
    [Required]
    public DateOnly EntryDate { get; set; }

    [Required]
    [MaxLength(512)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? ReferenceNo { get; set; }

    [Required]
    [MinLength(2)]
    public List<JournalLineRequest> Lines { get; set; } = new();
}

public class MonthEndChecklistItemRequest
{
    [Required]
    [MaxLength(64)]
    public string TaskId { get; set; } = string.Empty;

    public bool Completed { get; set; }
}

public class MonthEndCloseRequest
{
    [Range(1, 9999)]
    public int FiscalYear { get; set; }

    [Range(1, 12)]
    public int Month { get; set; }

    [Required]
    [MinLength(1)]
    public List<MonthEndChecklistItemRequest> ChecklistItems { get; set; } = new();
}
