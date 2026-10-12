using Microsoft.EntityFrameworkCore;
using ShelfMate.Application;

namespace ShelfMate.Infrastructure;

public sealed class DatabaseAvailability(ShelfMateDbContext database) : IDatabaseAvailability
{
    public Task<bool> CanConnectAsync(CancellationToken cancellationToken) =>
        database.Database.CanConnectAsync(cancellationToken);
}
