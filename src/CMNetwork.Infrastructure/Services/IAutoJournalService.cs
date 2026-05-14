namespace CMNetwork.Infrastructure.Services;

public interface IAutoJournalService
{
    Task PostCustomerCashReceiptAsync(
        decimal amount,
        string description,
        string referenceNo,
        string createdBy,
        CancellationToken cancellationToken = default);
}
