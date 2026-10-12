namespace ShelfMate.Domain;

public sealed class Category
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Key { get; set; } = "";
    public bool IsSystemDefined { get; set; }
}

public sealed class InventoryItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = "";
    public Guid CategoryId { get; set; }
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "piece";
    public DateOnly? PurchaseDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string ExpiryType { get; set; } = "Unknown";
    public string StorageLocation { get; set; } = "Home";
    public string? Notes { get; set; }
    public string Status { get; set; } = "Active";
    public bool ReminderEnabled { get; set; } = true;
    public Guid CreatedBy { get; set; }
    public Guid UpdatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}

public static class InventoryCatalog
{
    public static readonly string[] Units = ["piece", "g", "kg", "ml", "l", "pack", "bottle", "box"];
    public static readonly Category[] Categories = [
        Create(1, "Fruits", "fruits"), Create(2, "Vegetables", "vegetables"), Create(3, "Dairy", "dairy"),
        Create(4, "Meat & Poultry", "meat"), Create(5, "Seafood", "seafood"), Create(6, "Frozen Food", "frozen"),
        Create(7, "Pantry & Canned", "pantry"), Create(8, "Bakery", "bakery"), Create(9, "Beverages", "beverages"),
        Create(10, "Medicines", "medicines"), Create(11, "Household Essentials", "household"), Create(12, "Other", "other")
    ];
    private static Category Create(int id, string name, string key) => new() { Id = Guid.Parse($"00000000-0000-4000-8000-{id:D12}"), Name = name, Key = key, IsSystemDefined = true };
}
