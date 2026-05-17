using CMNetwork.Application.Services;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Infrastructure.Services;

public sealed class CustomerSupportService : ICustomerSupportService
{
    private readonly CMNetworkDbContext _db;

    public CustomerSupportService(CMNetworkDbContext db)
    {
        _db = db;
    }

    public async Task<List<CustomerSupportTicketDto>> GetMyTicketsAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        var tickets = await _db.SupportTickets
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new CustomerSupportTicketDto
            {
                Id = t.Id,
                TicketNumber = t.TicketNumber,
                Subject = t.Subject,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                CreatedDate = t.CreatedAtUtc,
                ResolvedDate = t.ResolvedAtUtc
            })
            .ToListAsync(cancellationToken);

        return tickets;
    }

    public async Task<Guid> CreateTicketAsync(Guid customerId, CreateSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var customer = await _db.Customers
            .Where(c => c.Id == customerId && c.IsActive)
            .FirstOrDefaultAsync(cancellationToken);

        if (customer == null)
        {
            throw new InvalidOperationException($"Customer with ID {customerId} not found or is inactive.");
        }

        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Description))
        {
            throw new ArgumentException("Subject and description are required.");
        }

        // Parse priority
        var priority = request.Priority switch
        {
            "Low" => SupportTicketPriority.Low,
            "Medium" => SupportTicketPriority.Medium,
            "High" => SupportTicketPriority.High,
            "Urgent" => SupportTicketPriority.Urgent,
            _ => SupportTicketPriority.Medium
        };

        // Generate ticket number
        var ticketNumber = $"TKT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 8)}";

        var ticket = new SupportTicket
        {
            Id = Guid.NewGuid(),
            TicketNumber = ticketNumber,
            CustomerId = customerId,
            Subject = request.Subject,
            Description = request.Description,
            Status = SupportTicketStatus.Open,
            Priority = priority,
            CreatedAtUtc = DateTime.UtcNow
        };

        _db.SupportTickets.Add(ticket);
        await _db.SaveChangesAsync(cancellationToken);

        return ticket.Id;
    }

    public async Task<CustomerSupportTicketDetailDto> GetTicketDetailAsync(Guid customerId, Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _db.SupportTickets
            .Where(t => t.Id == ticketId && t.CustomerId == customerId)
            .FirstOrDefaultAsync(cancellationToken);

        if (ticket == null)
        {
            throw new InvalidOperationException($"Support ticket with ID {ticketId} not found for customer {customerId}.");
        }

        return new CustomerSupportTicketDetailDto
        {
            Id = ticket.Id,
            TicketNumber = ticket.TicketNumber,
            Subject = ticket.Subject,
            Description = ticket.Description,
            Status = ticket.Status.ToString(),
            Priority = ticket.Priority.ToString(),
            CreatedDate = ticket.CreatedAtUtc,
            ResolvedDate = ticket.ResolvedAtUtc,
            ClosedDate = ticket.ClosedAtUtc,
            AssignedToName = ticket.AssignedToName,
            ResolutionNotes = ticket.ResolutionNotes
        };
    }

    public async Task<List<FaqDto>> GetFAQsAsync(CancellationToken cancellationToken = default)
    {
        var faqs = await _db.FAQs
            .Where(f => f.IsActive)
            .OrderBy(f => f.Category)
            .ThenBy(f => f.DisplayOrder)
            .Select(f => new FaqDto
            {
                Id = f.Id,
                Question = f.Question,
                Answer = f.Answer,
                Category = f.Category,
                DisplayOrder = f.DisplayOrder
            })
            .ToListAsync(cancellationToken);

        return faqs;
    }
}
