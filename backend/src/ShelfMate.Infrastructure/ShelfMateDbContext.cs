using Microsoft.EntityFrameworkCore;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed class ShelfMateDbContext(DbContextOptions<ShelfMateDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Household> Households => Set<Household>();
    public DbSet<HouseholdMember> Members => Set<HouseholdMember>();
    public DbSet<HouseholdInvite> Invites => Set<HouseholdInvite>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.DisplayName).HasMaxLength(80);
        });
        model.Entity<Session>(e =>
        {
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.AccessHash).IsUnique();
            e.HasIndex(x => x.RefreshHash).IsUnique();
            e.Property(x => x.AccessHash).HasMaxLength(64);
            e.Property(x => x.RefreshHash).HasMaxLength(64);
        });
        model.Entity<Household>(e =>
        {
            e.HasOne<User>().WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.TimeZone).HasMaxLength(100);
        });
        model.Entity<HouseholdMember>(e =>
        {
            e.ToTable("Members", t =>
            {
                t.HasCheckConstraint("CK_Member_Slot", "\"Slot\" IN (1, 2)");
                t.HasCheckConstraint("CK_Member_Role", "\"Role\" IN ('Owner', 'Member')");
            });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => new { x.HouseholdId, x.UserId }).IsUnique();
            e.HasIndex(x => new { x.HouseholdId, x.Slot }).IsUnique();
        });
        model.Entity<HouseholdInvite>(e =>
        {
            e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.Property(x => x.InvitedEmail).HasMaxLength(254);
        });
    }
}
