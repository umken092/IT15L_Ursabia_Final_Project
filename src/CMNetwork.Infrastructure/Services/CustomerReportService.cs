using CMNetwork.Application.Services;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerReportService : ICustomerReportService
{
    private readonly CMNetworkDbContext _db;

    public CustomerReportService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<List<FinancialReportDto>> GetFinancialReportsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        // For now, return a list of sample reports based on invoice data
        var reports = new List<FinancialReportDto>();

        // Generate summary reports
        var invoiceCount = await _db.ARInvoices
            .AsNoTracking()
            .Where(i => i.CustomerId == customerId && !i.IsDeleted)
            .CountAsync(cancellationToken);

        var totalAmount = await _db.ARInvoices
            .AsNoTracking()
            .Where(i => i.CustomerId == customerId && !i.IsDeleted)
            .SumAsync(i => (decimal?)i.TotalAmount, cancellationToken) ?? 0m;

        if (invoiceCount > 0)
        {
            reports.Add(new FinancialReportDto
            {
                Id = Guid.NewGuid(),
                ReportName = "Invoice Summary",
                ReportType = "Summary",
                GeneratedDate = DateTime.UtcNow,
                Description = $"Total of {invoiceCount} invoices amounting to ₱{totalAmount:N2}",
                FileUrl = "#"
            });
        }

        // Add payment summary
        var paymentCount = await _db.CustomerPayments
            .AsNoTracking()
            .Where(p => p.CustomerId == customerId)
            .CountAsync(cancellationToken);

        var completedPayments = await _db.CustomerPayments
            .AsNoTracking()
            .Where(p => p.CustomerId == customerId && p.Status == CustomerPaymentStatus.Completed)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        if (paymentCount > 0)
        {
            reports.Add(new FinancialReportDto
            {
                Id = Guid.NewGuid(),
                ReportName = "Payment History",
                ReportType = "Payment",
                GeneratedDate = DateTime.UtcNow,
                Description = $"Total of {paymentCount} payment transactions, {completedPayments:N2} completed",
                FileUrl = "#"
            });
        }

        return reports;
    }

    public async Task<(byte[] Content, string Filename)> GenerateStatementAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        // Create a simple PDF statement
        var pdf = GenerateStatementPdf();
        var filename = $"statement-{customer.CustomerCode}-{DateTime.UtcNow:yyyyMMdd}.pdf";

        return (pdf, filename);
    }

    private static byte[] GenerateStatementPdf()
    {
        // This is a placeholder. In a real implementation, use QuestPDF or similar
        // For now, return empty PDF bytes
        try
        {
            // Using QuestPDF would go here
            // For now, return a simple PDF as a placeholder
            return System.Text.Encoding.UTF8.GetBytes("%PDF-1.4\n%placeholder");
        }
        catch
        {
            return Array.Empty<byte>();
        }
    }
}
