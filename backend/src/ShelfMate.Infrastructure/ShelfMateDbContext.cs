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

    public DbSet<NotificationPreference> Preferences => Set<NotificationPreference>();
    public DbSet<PushDevice> PushDevices => Set<PushDevice>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();
    public DbSet<ShoppingItem> Shopping => Set<ShoppingItem>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<NotificationPreference>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.HouseholdId }).IsUnique();
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable("Preferences", t => t.HasCheckConstraint("CK_Preference_Offsets", "cardinality(\"DayOffsets\") <= 16 AND 0 <= ALL(\"DayOffsets\") AND 365 >= ALL(\"DayOffsets\")"));
        });
        model.Entity<PushDevice>(e =>
        {
            e.HasIndex(x => x.Token).IsUnique();
            e.Property(x => x.Token).HasMaxLength(200);
            e.Property(x => x.Platform).HasMaxLength(20);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable("PushDevices", t => t.HasCheckConstraint("CK_Device_Platform", "\"Platform\" IN ('android', 'ios')"));
        });
        model.Entity<NotificationLog>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.InventoryItemId, x.ExpiryDate, x.Offset }).IsUnique();
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<InventoryItem>().WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Status).HasMaxLength(30);
            e.ToTable("NotificationLogs", t => t.HasCheckConstraint("CK_Log_Tickets", "cardinality(\"TicketIds\") = cardinality(\"TicketDeviceIds\")"));
        });
        model.Entity<ShoppingItem>(e =>
        {
            e.ToTable("Shopping", t =>
            {
                t.HasCheckConstraint("CK_Shopping_Name", "length(btrim(\"Name\")) > 0");
                t.HasCheckConstraint("CK_Shopping_Quantity", "\"Quantity\" IS NULL OR (\"Quantity\" > 0 AND \"Quantity\" <= 1000000)");
                t.HasCheckConstraint("CK_Shopping_Status", "(\"Status\" = 'ToBuy' AND \"PurchasedBy\" IS NULL AND \"PurchasedAt\" IS NULL AND \"LinkedInventoryItemId\" IS NULL) OR (\"Status\" = 'Purchased' AND \"PurchasedBy\" IS NOT NULL AND \"PurchasedAt\" IS NOT NULL)");
                t.HasCheckConstraint("CK_Shopping_Unit", "\"Unit\" IS NULL OR \"Unit\" IN ('piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box')");
            });
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Quantity).HasPrecision(12, 3);
            e.Property(x => x.Unit).HasMaxLength(20);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasIndex(x => new { x.HouseholdId, x.Status });
            e.HasIndex(x => x.LinkedInventoryItemId).IsUnique();
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Category>().WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.PurchasedBy).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<InventoryItem>().WithMany().HasForeignKey(x => x.LinkedInventoryItemId).OnDelete(DeleteBehavior.Restrict);
        });
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
            e.HasOne<PushDevice>().WithMany().HasForeignKey(x => x.PushDeviceId).OnDelete(DeleteBehavior.Restrict);
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
                t.HasCheckConstraint("CK_Member_Role", "\"Role\" IN ('Owner', 'Member')");
            });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Household>().WithMany().HasForeignKey(x => x.HouseholdId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => new { x.HouseholdId, x.UserId }).IsUnique();
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
