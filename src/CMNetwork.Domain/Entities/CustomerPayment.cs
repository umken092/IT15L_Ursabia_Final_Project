namespace CMNetwork.Domain.Entities;

public enum CustomerPaymentStatus
{
    AwaitingPayment = 1,
    Completed = 2,
    Failed = 3,
    Refunded = 4
}

public class CustomerPayment
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public decimal Amount { get; set; }
    public CustomerPaymentStatus Status { get; set; } = CustomerPaymentStatus.AwaitingPayment;
    public string? PayMongoCheckoutSessionId { get; set; }
    public string? IdempotencyKey { get; set; }
    public string? CheckoutUrl { get; set; }
    public string InvoiceIds { get; set; } = string.Empty;
    public string CreatedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public Customer Customer { get; set; } = null!;
}
