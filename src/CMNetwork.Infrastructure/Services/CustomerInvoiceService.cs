using CMNetwork.Application.Services;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerInvoiceService : ICustomerInvoiceService
{
    private readonly CMNetworkDbContext _db;

    public CustomerInvoiceService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<CustomerInvoicesResponseDto> GetMyInvoicesAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        var invoices = await _db.ARInvoices
            .Where(inv => inv.CustomerId == customerId && !inv.IsDeleted)
            .OrderByDescending(inv => inv.InvoiceDate)
            .Select(inv => new CustomerInvoiceDto
            {
                Id = inv.Id,
                InvoiceNumber = inv.InvoiceNumber,
                InvoiceDate = inv.InvoiceDate,
                DueDate = inv.DueDate,
                TotalAmount = inv.TotalAmount,
                Status = inv.Status.ToString()
            })
            .ToListAsync(cancellationToken);

        return new CustomerInvoicesResponseDto
        {
            CustomerName = customer.Name,
            CustomerCode = customer.CustomerCode,
            Invoices = invoices
        };
    }

    public async Task<CustomerInvoiceDetailDto> GetInvoiceDetailAsync(Guid customerId, Guid invoiceId, CancellationToken cancellationToken = default)
    {
        var invoice = await _db.ARInvoices
            .Where(inv => inv.Id == invoiceId && inv.CustomerId == customerId && !inv.IsDeleted)
            .Include(inv => inv.Lines)
            .FirstOrDefaultAsync(cancellationToken);

        if (invoice == null)
        {
            throw new InvalidOperationException($"Invoice with ID {invoiceId} not found for customer {customerId}.");
        }

        return new CustomerInvoiceDetailDto
        {
            Id = invoice.Id,
            InvoiceNumber = invoice.InvoiceNumber,
            InvoiceDate = invoice.InvoiceDate,
            DueDate = invoice.DueDate,
            TotalAmount = invoice.TotalAmount,
            Status = invoice.Status.ToString(),
            LineItems = invoice.Lines.Select(line => new InvoiceLineItemDto
            {
                Id = line.Id,
                Description = line.Description,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                Amount = line.Amount,
                TaxAmount = line.TaxAmount
            }).ToList()
        };
    }

    public async Task<List<CustomerPaymentRecordDto>> GetPaymentRecordsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var payments = await _db.CustomerPayments
            .Where(p => p.CustomerId == customerId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new CustomerPaymentRecordDto
            {
                Id = p.Id,
                Amount = p.Amount,
                Status = p.Status.ToString(),
                PayMongoCheckoutSessionId = p.PayMongoCheckoutSessionId,
                CreatedAt = p.CreatedAt,
                CompletedAt = p.CompletedAt,
                InvoiceIds = p.InvoiceIds
            })
            .ToListAsync(cancellationToken);

        return payments;
    }
}
