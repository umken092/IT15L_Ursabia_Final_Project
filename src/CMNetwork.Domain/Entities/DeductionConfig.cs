namespace CMNetwork.Domain.Entities;

public enum DeductionConfigType
{
    FixedAmount = 1,
    Percentage = 2,
    Variable = 3
}

public class DeductionConfig
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DeductionConfigType Type { get; set; }
    public decimal DefaultAmount { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastModifiedUtc { get; set; }
    public bool IsDeleted { get; set; }
}
