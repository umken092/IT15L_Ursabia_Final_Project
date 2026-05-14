using CMNetwork.Models;
using CMNetwork.Domain.Entities;

namespace CMNetwork.Services;

public interface IPayrollService
{
    Task<PayPeriodDto> CreatePayPeriodAsync(CreatePayPeriodRequest request, string createdByUserId);
    Task<IReadOnlyList<PayPeriodDto>> GetPayPeriodsAsync();
    Task<IReadOnlyList<PayrollRunDto>> GetPayrollRunsAsync(PayrollRunStatus? status = null, Guid? payPeriodId = null);
    Task<PayrollSetupDto> GetPayrollSetupAsync(Guid payPeriodId);
    Task<PayrollRunDto> CalculatePayrollAsync(Guid payPeriodId, CalculatePayrollRequest request, string createdByUserId);
    Task<PayrollRunDto> SubmitPayrollAsync(Guid payrollRunId, string submittedByUserId);
    Task<PayrollRunDto> WithdrawPayrollAsync(Guid payrollRunId, string requestedByUserId, bool isSuperAdmin, string? withdrawalReason);
    Task<PayrollRegisterDto> GetPayrollRegisterAsync(Guid payrollRunId);
    Task<PayrollRunDto> ApprovePayrollAsync(Guid payrollRunId, ApprovePayrollRequest request, string approvedByUserId);
    Task<PayrollRunDto> RejectPayrollAsync(Guid payrollRunId, RejectPayrollRequest request, string rejectedByUserId);
    Task<PayrollRunDto> ReopenPayrollAsync(Guid payrollRunId, ReopenPayrollRequest request, string requestedByUserId, bool isSuperAdmin, bool isCfo);
    Task<PayrollRunDto> PostToGeneralLedgerAsync(Guid payrollRunId, string postedByUserId);
    Task<byte[]> GetPayslipPdfAsync(Guid payslipId, string requestingUserId, bool canViewAny);
    Task<IReadOnlyList<PayslipSummaryDto>> GetMyPayslipsAsync(string userId);
    Task<TaxTableDto> CreateTaxTableAsync(CreateTaxTableRequest request);
    Task<TaxTableDto> UpdateTaxTableAsync(Guid id, CreateTaxTableRequest request);
    Task DeleteTaxTableAsync(Guid id);
    Task<IReadOnlyList<TaxTableDto>> GetTaxTablesAsync(int? year = null, CMNetwork.Domain.Entities.TaxTableType? type = null);
    Task<PayrollIntegrationCapabilitiesDto> GetIntegrationCapabilitiesAsync();
}
