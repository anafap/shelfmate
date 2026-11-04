using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

internal static class InventoryResults
{
    public static InventoryResult Create(InventoryItem item, DateTimeOffset now, string timeZone, int threshold)
    {
        var expiry = ExpiryRules.Assess(item.ExpiryDate, now, timeZone, threshold);
        return new(item.Id, item.HouseholdId, item.Name, item.CategoryId, item.Quantity, item.Unit,
            item.PurchaseDate, item.ExpiryDate, item.ExpiryType, item.StorageLocation, item.Notes,
            item.Status, item.ReminderEnabled, item.Version, item.Status == "Active" ? expiry.Status : null,
            item.Status == "Active" ? expiry.DaysRemaining : null, expiry.LocalDate,
            item.CreatedBy, item.UpdatedBy, item.CreatedAt, item.UpdatedAt);
    }
}
