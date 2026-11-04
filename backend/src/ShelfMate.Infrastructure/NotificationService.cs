using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed partial class NotificationService(ShelfMateDbContext db, IAccountService accounts, TimeProvider clock) : INotificationService
{
    private static PreferenceRequest View(NotificationPreference p) => new(p.PushEnabled, p.InAppEnabled, p.DayOffsets, p.MutedCategoryIds, p.LocalDeliveryTime.ToString("HH:mm", CultureInfo.InvariantCulture));
    private async Task<NotificationPreference> Get(Guid userId, Guid householdId) => await db.Preferences.SingleOrDefaultAsync(x => x.UserId == userId && x.HouseholdId == householdId) ?? new() { UserId = userId, HouseholdId = householdId };
    public async Task<PreferenceRequest> Preferences(Guid userId) => View(await Get(userId, (await accounts.CurrentHousehold(userId)).Id));
    public async Task<PreferenceRequest> SavePreferences(Guid userId, PreferenceRequest request)
    {
        if (request.DayOffsets is null || request.DayOffsets.Length > 16 || request.DayOffsets.Any(x => x is < 0 or > 365) || request.DayOffsets.Distinct().Count() != request.DayOffsets.Length) throw new InventoryError(400, "Choose up to 16 distinct day offsets between 0 and 365.");
        if (request.MutedCategoryIds is null || request.MutedCategoryIds.Length > 100 || await db.Categories.CountAsync(x => request.MutedCategoryIds.Contains(x.Id)) != request.MutedCategoryIds.Distinct().Count()) throw new InventoryError(400, "Choose valid categories to mute.");
        if (!TimeOnly.TryParseExact(request.LocalDeliveryTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var delivery)) throw new InventoryError(400, "Delivery time must use HH:mm.");
        var household = await accounts.CurrentHousehold(userId);
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Users.FromSqlInterpolated($"SELECT * FROM \"Users\" WHERE \"Id\" = {userId} FOR UPDATE").SingleAsync();
        var preference = await Get(userId, household.Id);
        if (db.Entry(preference).State == EntityState.Detached) db.Preferences.Add(preference);
        preference.PushEnabled = request.PushEnabled; preference.InAppEnabled = request.InAppEnabled;
        preference.DayOffsets = request.DayOffsets.OrderDescending().ToArray(); preference.MutedCategoryIds = request.MutedCategoryIds.Distinct().ToArray(); preference.LocalDeliveryTime = delivery;
        await db.SaveChangesAsync(); await tx.CommitAsync(); return View(preference);
    }
    private IQueryable<InventoryItem> AlertItems(Guid householdId, NotificationPreference preference, DateTimeOffset now, string timeZone)
    {
        var through = ExpiryRules.Assess(null, now, timeZone).LocalDate.AddDays(preference.DayOffsets.DefaultIfEmpty(0).Max());
        return db.Inventory.AsNoTracking().Where(x => x.HouseholdId == householdId && preference.InAppEnabled && preference.DayOffsets.Length > 0
            && x.Status == "Active" && x.ReminderEnabled && x.ExpiryDate != null && x.ExpiryDate <= through && !preference.MutedCategoryIds.Contains(x.CategoryId))
            .OrderBy(x => x.ExpiryDate).ThenBy(x => x.Name).ThenBy(x => x.Id);
    }

    public async Task<List<InventoryResult>> Alerts(Guid userId)
    {
        var household = await accounts.CurrentHousehold(userId); var preference = await Get(userId, household.Id);
        var now = clock.GetUtcNow();
        var items = await AlertItems(household.Id, preference, now, household.TimeZone).Take(1001).ToListAsync();
        if (items.Count > 1000) throw new InventoryError(400, "Use the paginated alerts endpoint for large lists.");
        return items.Select(item => InventoryResults.Create(item, now, household.TimeZone, preference.DayOffsets.DefaultIfEmpty(0).Max())).ToList();
    }

    public async Task<AlertPage> AlertsPage(Guid userId, int page, int pageSize)
    {
        if (page is < 1 or > 1000000 || pageSize is < 1 or > 100) throw new InventoryError(400, "Choose a valid page and page size from 1 to 100.");
        var household = await accounts.CurrentHousehold(userId); var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead);
        var preference = await Get(userId, household.Id);
        var query = AlertItems(household.Id, preference, now, household.TimeZone);
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        await transaction.CommitAsync();
        return new(items.Select(item => InventoryResults.Create(item, now, household.TimeZone, preference.DayOffsets.DefaultIfEmpty(0).Max())).ToList(), total, page, pageSize);
    }
    private static DeviceResult View(PushDevice d) => new(d.Id, d.Platform, d.LastSeenAt, d.InvalidatedAt is null);
    public async Task<List<DeviceResult>> Devices(Guid userId)
    {
        return await db.PushDevices.Where(x => x.UserId == userId).OrderByDescending(x => x.LastSeenAt).Select(x => new DeviceResult(x.Id, x.Platform, x.LastSeenAt, x.InvalidatedAt == null)).ToListAsync();
    }
    public async Task<DeviceResult> RegisterDevice(Guid userId, Guid sessionId, DeviceRequest request)
    {
        if (request.Token is null || request.Token.Length > 200 || !ExpoToken().IsMatch(request.Token) || request.Platform is not ("android" or "ios")) throw new InventoryError(400, "A valid Expo device token and platform are required.");
        await using var tx = await db.Database.BeginTransactionAsync();
        var session = await db.Sessions.FromSqlInterpolated($"SELECT * FROM \"Sessions\" WHERE \"Id\" = {sessionId} AND \"UserId\" = {userId} FOR UPDATE").SingleAsync();
        if (session.Revoked) throw new InventoryError(401, "Please sign in again.");
        var device = await db.PushDevices.FromSqlInterpolated($"SELECT * FROM \"PushDevices\" WHERE \"Token\" = {request.Token} FOR UPDATE").SingleOrDefaultAsync();
        if (device is null) { device = new() { UserId = userId, Token = request.Token }; db.PushDevices.Add(device); }
        device.UserId = userId; device.Platform = request.Platform; device.LastSeenAt = clock.GetUtcNow(); device.InvalidatedAt = null;
        session.PushDeviceId = device.Id;
        try { await db.SaveChangesAsync(); } catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" }) { throw new InventoryError(409, "Device registration changed. Please retry."); }
        await tx.CommitAsync(); return View(device);
    }
    public async Task RemoveDevice(Guid userId, Guid id)
    {
        var device = await db.PushDevices.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId) ?? throw new InventoryError(404, "Device not found.");
        device.InvalidatedAt = clock.GetUtcNow(); await db.SaveChangesAsync();
    }
    [GeneratedRegex(@"^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$")]
    private static partial Regex ExpoToken();
}
