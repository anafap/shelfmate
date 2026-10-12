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

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Category>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Key).HasMaxLength(40);
            e.HasIndex(x => x.Key).IsUnique();
            e.HasData(InventoryCatalog.Categories);
        });
        model.Entity<InventoryItem>(e =>
        {
            e.ToTable("Inventory", t =>
            {
                t.HasCheckConstraint("CK_Inventory_Quantity", "\"Quantity\" > 0 AND \"Quantity\" <= 1000000");
                t.HasCheckConstraint("CK_Inventory_Name", "length(btrim(\"Name\")) > 0");
                t.HasCheckConstraint("CK_Inventory_Status", "\"Status\" IN ('Active', 'Consumed', 'Discarded')");
                t.HasCheckConstraint("CK_Inventory_Unit", "\"Unit\" IN ('piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box')");
                t.HasCheckConstraint("CK_Inventory_Expiry", "(\"ExpiryDate\" IS NULL AND \"ExpiryType\" = 'Unknown') OR (\"ExpiryDate\" IS NOT NULL AND \"ExpiryType\" IN ('Printed', 'Estimated'))");
                t.HasCheckConstraint("CK_Inventory_Reminders", "\"Status\" = 'Active' OR NOT \"ReminderEnabled\"");
                t.HasCheckConstraint("CK_Inventory_Dates", "(\"ExpiryDate\" IS NULL OR \"ExpiryDate\" BETWEEN DATE '1900-01-01' AND DATE '2100-12-31') AND (\"PurchaseDate\" IS NULL OR \"PurchaseDate\" BETWEEN DATE '1900-01-01' AND DATE '2100-12-31')");
            });
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Quantity).HasPrecision(12, 3);
            e.Property(x => x.Unit).HasMaxLength(20);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.ExpiryType).HasMaxLength(20);
            e.Property(x => x.StorageLocation).HasMaxLength(80);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasIndex(x => new { x.HouseholdId, x.Status, x.ExpiryDate });
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Category>().WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UpdatedBy).OnDelete(DeleteBehavior.Restrict);
        });
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
