using Microsoft.EntityFrameworkCore;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed class InventoryService(ShelfMateDbContext db, TimeProvider clock) : IInventoryService
{
    private static InventoryError Error(int status, string message) => new(status, message);
    private async Task<Household> Household(Guid userId)
    {
        var household = await (from m in db.Members join h in db.Households on m.HouseholdId equals h.Id where m.UserId == userId select h).SingleOrDefaultAsync();
        return household ?? throw Error(403, "Create or join a household to manage inventory.");
    }
    private InventoryResult View(InventoryItem item, Household household)
    {
        var expiry = ExpiryRules.Assess(item.ExpiryDate, clock.GetUtcNow(), household.TimeZone);
        return new(item.Id, item.HouseholdId, item.Name, item.CategoryId, item.Quantity, item.Unit,
            item.PurchaseDate, item.ExpiryDate, item.ExpiryType, item.StorageLocation, item.Notes,
            item.Status, item.ReminderEnabled, item.Version, item.Status == "Active" ? expiry.Status : null,
            item.Status == "Active" ? expiry.DaysRemaining : null, expiry.LocalDate,
            item.CreatedBy, item.UpdatedBy, item.CreatedAt, item.UpdatedAt);
    }
    public async Task<List<CategoryResult>> Categories(Guid userId)
    {
        await Household(userId);
        return await db.Categories.OrderBy(x => x.Id).Select(x => new CategoryResult(x.Id, x.Name, x.Key, x.IsSystemDefined)).ToListAsync();
    }
    public async Task<InventoryPage> List(Guid userId, Guid? category, string status, string? search, string sort, int page, int pageSize)
    {
        var household = await Household(userId);
        if (status is not ("Active" or "Consumed" or "Discarded" or "All")) throw Error(400, "Choose a valid inventory status.");
        if (sort is not ("expiry" or "name" or "updated")) throw Error(400, "Choose a valid inventory sort.");
        if (page < 1 || page > 100000 || pageSize is < 1 or > 100) throw Error(400, "Choose a valid page and a page size from 1 to 100.");
        if (search?.Length > 120) throw Error(400, "Search must contain at most 120 characters.");
        var query = db.Inventory.AsNoTracking().Where(x => x.HouseholdId == household.Id);
        if (status != "All") query = query.Where(x => x.Status == status);
        if (category is not null) query = query.Where(x => x.CategoryId == category);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.Name.ToLower().Contains(term));
        }
        var total = await query.CountAsync();
        var ordered = sort switch
        {
            "name" => query.OrderBy(x => x.Name).ThenBy(x => x.Id),
            "updated" => query.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id),
            _ => query.OrderBy(x => x.ExpiryDate == null).ThenBy(x => x.ExpiryDate).ThenBy(x => x.Name).ThenBy(x => x.Id)
        };
        var items = await ordered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new(items.Select(x => View(x, household)).ToList(), total, page, pageSize);
    }
    private async Task<InventoryItem> Find(Guid householdId, Guid id) => await db.Inventory.SingleOrDefaultAsync(x => x.Id == id && x.HouseholdId == householdId) ?? throw Error(404, "Inventory item not found.");
    public async Task<InventoryResult> Get(Guid userId, Guid id)
    {
        var household = await Household(userId);
        return View(await Find(household.Id, id), household);
    }
    private async Task Apply(InventoryItem item, SaveInventoryRequest r, Household household)
    {
        var name = r.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 120) throw Error(400, "Product name must contain 1–120 characters.");
        if (r.Quantity <= 0 || r.Quantity > 1000000 || decimal.Round(r.Quantity, 3) != r.Quantity) throw Error(400, "Quantity must be positive, at most 1,000,000, with up to three decimal places.");
        if (!InventoryCatalog.Units.Contains(r.Unit)) throw Error(400, "Choose a supported unit.");
        if (!await db.Categories.AnyAsync(x => x.Id == r.CategoryId)) throw Error(400, "Choose a valid category.");
        if (r.ExpiryType is not ("Printed" or "Estimated" or "Unknown") || (r.ExpiryDate is null) != (r.ExpiryType == "Unknown")) throw Error(400, "A provided expiry date must be Printed or Estimated; without a date choose Unknown.");
        var first = new DateOnly(1900, 1, 1); var last = new DateOnly(2100, 12, 31);
        if (r.ExpiryDate < first || r.ExpiryDate > last || r.PurchaseDate < first || r.PurchaseDate > last) throw Error(400, "Dates must be between 1900 and 2100.");
        var today = ExpiryRules.Assess(null, clock.GetUtcNow(), household.TimeZone).LocalDate;
        if (r.PurchaseDate > today) throw Error(400, "Purchase date cannot be after today in your household time zone.");
        var location = string.IsNullOrWhiteSpace(r.StorageLocation) ? "Home" : r.StorageLocation.Trim();
        if (location.Length > 80) throw Error(400, "Storage location must contain at most 80 characters.");
        var notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        if (notes?.Length > 2000) throw Error(400, "Notes must contain at most 2000 characters.");
        item.Name = name; item.CategoryId = r.CategoryId; item.Quantity = r.Quantity; item.Unit = r.Unit;
        item.PurchaseDate = r.PurchaseDate; item.ExpiryDate = r.ExpiryDate; item.ExpiryType = r.ExpiryType;
        item.StorageLocation = location; item.Notes = notes; item.ReminderEnabled = r.ReminderEnabled;
    }
    public async Task<InventoryResult> Create(Guid userId, SaveInventoryRequest request)
    {
        var household = await Household(userId);
        var item = new InventoryItem { HouseholdId = household.Id, CreatedBy = userId, UpdatedBy = userId, CreatedAt = clock.GetUtcNow(), UpdatedAt = clock.GetUtcNow() };
        await Apply(item, request, household);
        db.Inventory.Add(item);
        await db.SaveChangesAsync();
        return View(item, household);
    }
    private static void CheckVersion(InventoryItem item, Guid version)
    {
        if (version == Guid.Empty) throw Error(400, "The current item version is required.");
        if (item.Version != version) throw Error(409, "This item changed. Reload it and review the latest details before saving.");
        if (item.Status != "Active") throw Error(409, "This item is archived and cannot be changed.");
    }
    private async Task Save(InventoryItem item, Guid userId)
    {
        item.Version = Guid.NewGuid(); item.UpdatedBy = userId; item.UpdatedAt = clock.GetUtcNow();
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw Error(409, "This item changed. Reload it and review the latest details before saving."); }
    }
    public async Task<InventoryResult> Update(Guid userId, Guid id, SaveInventoryRequest request)
    {
        var household = await Household(userId); var item = await Find(household.Id, id);
        CheckVersion(item, request.Version ?? Guid.Empty);
        await Apply(item, request, household); await Save(item, userId);
        return View(item, household);
    }
    public async Task<InventoryResult> Transition(Guid userId, Guid id, Guid version, string status)
    {
        if (status is not ("Consumed" or "Discarded")) throw Error(400, "Choose a valid lifecycle transition.");
        var household = await Household(userId); var item = await Find(household.Id, id);
        CheckVersion(item, version);
        item.Status = status; item.ReminderEnabled = false;
        await Save(item, userId);
        return View(item, household);
    }
}
