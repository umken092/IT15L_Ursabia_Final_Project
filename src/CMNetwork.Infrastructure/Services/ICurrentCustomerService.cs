namespace CMNetwork.Infrastructure.Services;

public interface ICurrentCustomerService
{
    Guid? CustomerId { get; }
    bool HasCustomerScope { get; }
}
