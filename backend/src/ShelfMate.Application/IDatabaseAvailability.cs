namespace ShelfMate.Application;

public interface IDatabaseAvailability
{
    Task<bool> CanConnectAsync(CancellationToken cancellationToken);
}
