using Microsoft.EntityFrameworkCore;

namespace ShelfMate.Infrastructure;

public sealed class ShelfMateDbContext(DbContextOptions<ShelfMateDbContext> options) : DbContext(options);
