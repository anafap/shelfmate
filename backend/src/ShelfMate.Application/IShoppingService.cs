namespace ShelfMate.Application;

public sealed record SaveShoppingRequest(string Name, Guid? CategoryId = null, decimal? Quantity = null, string? Unit = null, string? Notes = null, Guid? Version = null);
public sealed record PurchaseRequest(Guid Version, bool Purchased, Guid OperationId);
public sealed record TransferRequest(Guid Version, SaveInventoryRequest Item, bool ConfirmSeparateItem = false);
public sealed record ShoppingResult(Guid Id, Guid HouseholdId, string Name, Guid? CategoryId, decimal? Quantity, string? Unit, string? Notes, string Status, Guid CreatedBy, Guid? PurchasedBy, string? PurchasedByName, DateTimeOffset? PurchasedAt, Guid? LinkedInventoryItemId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, Guid Version);
public interface IShoppingService
{
    Task<List<ShoppingResult>> List(Guid userId);
    Task<ShoppingResult> Create(Guid userId, SaveShoppingRequest request);
    Task<ShoppingResult> Update(Guid userId, Guid id, SaveShoppingRequest request);
    Task Delete(Guid userId, Guid id, Guid version);
    Task<ShoppingResult> Purchase(Guid userId, Guid id, PurchaseRequest request);
    Task<InventoryResult> Transfer(Guid userId, Guid id, TransferRequest request);
}
