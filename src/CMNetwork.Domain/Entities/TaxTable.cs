namespace CMNetwork.Domain.Entities;

public enum TaxTableType
{
    Train = 1,
    Sss = 2,
    PhilHealth = 3,
    PagIbig = 4
}

public class TaxTable
{
    public Guid Id { get; set; }
    public TaxTableType Type { get; set; }
    public int Year { get; set; }
    public decimal MinIncome { get; set; }
    public decimal? MaxIncome { get; set; }
    public decimal Rate { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; }
}
