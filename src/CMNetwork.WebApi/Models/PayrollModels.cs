using System.ComponentModel.DataAnnotations;
using CMNetwork.Domain.Entities;

namespace CMNetwork.Models;

public class CreatePayPeriodRequest
{
    [Range(2000, 2099)]
    public int Year { get; set; }

    [Range(1, 12)]
    public int Month { get; set; }

    [Required]
    public PayrollFrequency Frequency { get; set; }

    [Required]
    public DateOnly CutoffDate { get; set; }

    [Required]
    public DateOnly PayDate { get; set; }
}

public class CalculatePayrollRequest
{
    [Required]
    public List<CalculatePayrollLineRequest> LineItems { get; set; } = new();
}

public class CalculatePayrollLineRequest
{
    [Required]
    public Guid EmployeeId { get; set; }

    [Range(0, 240)]
    public decimal RegularHours { get; set; }

    [Range(0, 120)]
    public decimal OvertimeHours { get; set; }

    [Range(0, 120)]
    public decimal AbsenceHours { get; set; }

    [Range(0, double.MaxValue)]
    public decimal OtherDeductions { get; set; }

    [MaxLength(256)]
    public string? ManualAdjustmentNote { get; set; }
}

public class ApprovePayrollRequest
{
    [MaxLength(512)]
    public string? ApproverNotes { get; set; }
}

public class RejectPayrollRequest
{
    [Required]
    [MaxLength(512)]
    public string RejectionReason { get; set; } = string.Empty;
}

public class CreateTaxTableRequest
{
    [Required]
    public TaxTableType Type { get; set; }

    [Range(2000, 2099)]
    public int Year { get; set; }

    [Range(0, double.MaxValue)]
    public decimal MinIncome { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? MaxIncome { get; set; }

    [Range(0, 1)]
    public decimal Rate { get; set; }

    [Required]
    [MaxLength(256)]
    public string Description { get; set; } = string.Empty;

    [Required]
    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }
}

public class PayPeriodDto
{
    public Guid Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public PayrollFrequency Frequency { get; set; }
    public DateOnly CutoffDate { get; set; }
    public DateOnly PayDate { get; set; }
    public PayPeriodStatus Status { get; set; }
    public DateTime CreatedUtc { get; set; }
}

public class PayrollSetupDto
{
    public Guid PayPeriodId { get; set; }
    public List<EmployeePayrollDto> Employees { get; set; } = new();
}

public class EmployeePayrollDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public decimal HourlyRate { get; set; }
    public decimal OvertimeMultiplier { get; set; }
}

public class PayrollRunDto
{
    public Guid Id { get; set; }
    public Guid PayPeriodId { get; set; }
    public string PayPeriodLabel { get; set; } = string.Empty;
    public PayrollRunStatus Status { get; set; }
    public decimal TotalGrossPay { get; set; }
    public decimal TotalNetPay { get; set; }
    public decimal TotalDeductions { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
}

public class PayrollLineRegisterDto
{
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public decimal GrossPay { get; set; }
    public decimal TrainTax { get; set; }
    public decimal SssFee { get; set; }
    public decimal PhilHealthFee { get; set; }
    public decimal PagIbigFee { get; set; }
    public decimal OtherDeductions { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal NetPay { get; set; }
}

public class PayrollTotalsDto
{
    public decimal TotalGrossPay { get; set; }
    public decimal TotalTrainTax { get; set; }
    public decimal TotalSssFee { get; set; }
    public decimal TotalPhilHealthFee { get; set; }
    public decimal TotalPagIbigFee { get; set; }
    public decimal TotalOtherDeductions { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal TotalNetPay { get; set; }
}

public class PayrollRegisterDto
{
    public Guid PayrollRunId { get; set; }
    public string PayPeriod { get; set; } = string.Empty;
    public PayrollRunStatus Status { get; set; }
    public List<PayrollLineRegisterDto> LineItems { get; set; } = new();
    public PayrollTotalsDto Totals { get; set; } = new();
}

public class PayslipSummaryDto
{
    public Guid Id { get; set; }
    public string PayslipNumber { get; set; } = string.Empty;
    public string PayPeriod { get; set; } = string.Empty;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public decimal GrossPay { get; set; }
    public decimal NetPay { get; set; }
    public DateTime GeneratedAtUtc { get; set; }
}

public class TaxTableDto
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
}
