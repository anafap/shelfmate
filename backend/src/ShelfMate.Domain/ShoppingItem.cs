namespace ShelfMate.Domain;

public sealed class ShoppingItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public string Name { get; set; } = "";
    public Guid? CategoryId { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "ToBuy";
    public Guid CreatedBy { get; set; }
    public Guid? PurchasedBy { get; set; }
    public DateTimeOffset? PurchasedAt { get; set; }
    public Guid? PurchaseOperationId { get; set; }
    public Guid? LinkedInventoryItemId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}
