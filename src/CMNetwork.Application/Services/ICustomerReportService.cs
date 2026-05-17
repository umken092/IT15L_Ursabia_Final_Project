namespace CMNetwork.Application.Services;

public interface ICustomerReportService
{
    /// <summary>
    /// Get financial reports for the customer
    /// </summary>
    Task<List<FinancialReportDto>> GetFinancialReportsAsync(Guid customerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Download statement for the customer
    /// </summary>
    Task<(byte[] Content, string Filename)> GenerateStatementAsync(Guid customerId, CancellationToken cancellationToken = default);
}

public class FinancialReportDto
{
    public Guid Id { get; set; }
    public string ReportName { get; set; } = string.Empty;
    public string ReportType { get; set; } = string.Empty;
    public DateTime GeneratedDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
}
