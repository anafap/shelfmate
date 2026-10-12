namespace ShelfMate.Application;

public sealed record CategoryResult(Guid Id, string Name, string Key, bool IsSystemDefined);
public sealed record SaveInventoryRequest(string Name, Guid CategoryId, decimal Quantity, string Unit,
    DateOnly? PurchaseDate = null, DateOnly? ExpiryDate = null, string ExpiryType = "Unknown",
    string? StorageLocation = null, string? Notes = null, bool ReminderEnabled = true, Guid? Version = null);
public sealed record TransitionRequest(Guid Version);
public sealed record InventoryResult(Guid Id, Guid HouseholdId, string Name, Guid CategoryId, decimal Quantity, string Unit,
    DateOnly? PurchaseDate, DateOnly? ExpiryDate, string ExpiryType, string StorageLocation, string? Notes,
    string Status, bool ReminderEnabled, Guid Version, string? ExpiryStatus, int? DaysRemaining, DateOnly HouseholdLocalDate,
    Guid CreatedBy, Guid UpdatedBy, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record InventoryPage(List<InventoryResult> Items, int Total, int Page, int PageSize);
public sealed record DashboardResult(Guid HouseholdId, string HouseholdName, DateOnly HouseholdLocalDate, int ActiveCount, int ExpiringSoonCount, int ExpiryTodayOrPastCount, int? ShoppingListCount, List<InventoryResult> UseFirst);
public sealed class InventoryError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
public interface IInventoryService
{
    Task<DashboardResult> Dashboard(Guid userId);
    Task<List<CategoryResult>> Categories(Guid userId);
    Task<InventoryPage> List(Guid userId, Guid? category, string status, string? search, string sort, int page, int pageSize);
    Task<InventoryResult> Get(Guid userId, Guid id);
    Task<InventoryResult> Create(Guid userId, SaveInventoryRequest request);
    Task<InventoryResult> Update(Guid userId, Guid id, SaveInventoryRequest request);
    Task<InventoryResult> Transition(Guid userId, Guid id, Guid version, string status);
}
