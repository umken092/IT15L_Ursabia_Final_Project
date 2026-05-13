namespace CMNetwork.Domain.Entities;

public class PayrollLineItem
{
    public Guid Id { get; set; }
    public Guid PayrollRunId { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public decimal RegularHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal AbsenceHours { get; set; }
    public decimal RegularRate { get; set; }
    public decimal OvertimeRate { get; set; }
    public decimal GrossPay { get; set; }
    public decimal TrainTax { get; set; }
    public decimal SssFee { get; set; }
    public decimal PhilHealthFee { get; set; }
    public decimal PagIbigFee { get; set; }
    public decimal OtherDeductions { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal NetPay { get; set; }
    public string? ManualAdjustmentNote { get; set; }
    public bool IsExceptionFlag { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastModifiedUtc { get; set; }
    public bool IsDeleted { get; set; }

    public PayrollRun PayrollRun { get; set; } = null!;
}
