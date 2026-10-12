using Microsoft.EntityFrameworkCore;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed class ShoppingService(ShelfMateDbContext db, IAccountService accounts, IInventoryService inventory, TimeProvider clock) : IShoppingService
{
    private static InventoryError Error(int status, string text) => new(status, text);
    private async Task<Guid> Household(Guid userId) => (await accounts.CurrentHousehold(userId)).Id;
    private async Task<ShoppingItem> Find(Guid householdId, Guid id, bool locked = false)
    {
        var query = locked ? db.Shopping.FromSqlInterpolated($"SELECT * FROM \"Shopping\" WHERE \"HouseholdId\" = {householdId} AND \"Id\" = {id} FOR UPDATE") : db.Shopping.Where(x => x.HouseholdId == householdId && x.Id == id);
        return await query.SingleOrDefaultAsync() ?? throw Error(404, "Shopping item not found.");
    }
    private async Task<ShoppingResult> View(ShoppingItem x) => new(x.Id, x.HouseholdId, x.Name, x.CategoryId, x.Quantity, x.Unit, x.Notes, x.Status, x.CreatedBy, x.PurchasedBy,
        x.PurchasedBy is null ? null : await db.Users.Where(u => u.Id == x.PurchasedBy).Select(u => u.DisplayName).SingleAsync(), x.PurchasedAt, x.LinkedInventoryItemId, x.CreatedAt, x.UpdatedAt, x.Version);
    public async Task<List<ShoppingResult>> List(Guid userId)
    {
        var household = await Household(userId);
        var items = await db.Shopping.AsNoTracking().Where(x => x.HouseholdId == household).OrderBy(x => x.Status == "Purchased").ThenBy(x => x.CreatedAt).ThenBy(x => x.Id).ToListAsync();
        var result = new List<ShoppingResult>();
        foreach (var item in items) result.Add(await View(item));
        return result;
    }
    private async Task Apply(ShoppingItem item, SaveShoppingRequest r)
    {
        var name = r.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 120) throw Error(400, "Product name must contain 1–120 characters.");
        if (r.Quantity is not null && (r.Quantity <= 0 || r.Quantity > 1000000 || decimal.Round(r.Quantity.Value, 3) != r.Quantity)) throw Error(400, "Enter a positive quantity with up to three decimal places.");
        if (r.Unit is not null && !InventoryCatalog.Units.Contains(r.Unit)) throw Error(400, "Choose a supported unit.");
        if (r.CategoryId is not null && !await db.Categories.AnyAsync(x => x.Id == r.CategoryId)) throw Error(400, "Choose a valid category.");
        if (r.Notes?.Length > 2000) throw Error(400, "Notes must contain at most 2000 characters.");
        item.Name = name; item.Quantity = r.Quantity; item.Unit = r.Unit; item.CategoryId = r.CategoryId; item.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
    }
    private static void Version(ShoppingItem item, Guid version)
    {
        if (version == Guid.Empty) throw Error(400, "The current record version is required.");
        if (item.Version != version) throw Error(409, "This shopping item changed. Refresh and review before trying again.");
    }
    private async Task Save(ShoppingItem item)
    {
        item.Version = Guid.NewGuid(); item.UpdatedAt = clock.GetUtcNow();
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw Error(409, "This shopping item changed. Refresh and review before trying again."); }
    }
    public async Task<ShoppingResult> Create(Guid userId, SaveShoppingRequest request)
    {
        var item = new ShoppingItem { HouseholdId = await Household(userId), CreatedBy = userId, CreatedAt = clock.GetUtcNow(), UpdatedAt = clock.GetUtcNow() };
        await Apply(item, request); db.Shopping.Add(item); await db.SaveChangesAsync(); return await View(item);
    }
    public async Task<ShoppingResult> Update(Guid userId, Guid id, SaveShoppingRequest request)
    {
        var item = await Find(await Household(userId), id); Version(item, request.Version ?? Guid.Empty);
        if (item.LinkedInventoryItemId is not null) throw Error(409, "This purchase was transferred. Its inventory record can be edited in Inventory.");
        await Apply(item, request); await Save(item); return await View(item);
    }
    public async Task Delete(Guid userId, Guid id, Guid version)
    {
        var item = await Find(await Household(userId), id); Version(item, version); db.Shopping.Remove(item);
        try { await db.SaveChangesAsync(); } catch (DbUpdateConcurrencyException) { throw Error(409, "This shopping item changed. Refresh before removing it."); }
    }
    public async Task<ShoppingResult> Purchase(Guid userId, Guid id, PurchaseRequest request)
    {
        if (request.OperationId == Guid.Empty) throw Error(400, "A purchase operation ID is required.");
        var household = await Household(userId);
        await using var tx = await db.Database.BeginTransactionAsync();
        var item = await Find(household, id, true);
        if (item.PurchaseOperationId == request.OperationId)
        {
            if ((item.Status == "Purchased") != request.Purchased) throw Error(409, "This operation ID was already used for a different action.");
            await tx.CommitAsync(); return await View(item);
        }
        Version(item, request.Version);
        if (item.LinkedInventoryItemId is not null) throw Error(409, "A transferred purchase cannot be unchecked.");
        item.Status = request.Purchased ? "Purchased" : "ToBuy";
        item.PurchasedBy = request.Purchased ? userId : null;
        item.PurchasedAt = request.Purchased ? clock.GetUtcNow() : null;
        item.PurchaseOperationId = request.OperationId;
        await Save(item); await tx.CommitAsync(); return await View(item);
    }
    public async Task<InventoryResult> Transfer(Guid userId, Guid id, TransferRequest request)
    {
        var household = await Household(userId);
        await using var tx = await db.Database.BeginTransactionAsync();
        var item = await Find(household, id, true);
        if (item.LinkedInventoryItemId is Guid linked) { await tx.CommitAsync(); return await inventory.Get(userId, linked); }
        Version(item, request.Version);
        if (item.Status != "Purchased") throw Error(409, "Mark this item purchased before transferring it.");
        var name = request.Item.Name?.Trim().ToLowerInvariant() ?? "";
        // Serialize same-name checks across different shopping rows, so simultaneous transfers also require review.
        await db.Households.FromSqlInterpolated($"SELECT * FROM \"Households\" WHERE \"Id\" = {household} FOR UPDATE").SingleAsync();
        if (!request.ConfirmSeparateItem && await db.Inventory.AnyAsync(x => x.HouseholdId == household && x.Status == "Active" && x.Name.ToLower() == name))
            throw Error(409, "A product with this name is already in inventory. Review it or confirm adding a separate purchase.");
        var created = await inventory.Create(userId, request.Item);
        item.LinkedInventoryItemId = created.Id; await Save(item); await tx.CommitAsync(); return created;
    }
}
