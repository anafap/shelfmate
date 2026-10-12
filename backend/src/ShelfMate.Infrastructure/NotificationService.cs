using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed partial class NotificationService(ShelfMateDbContext db, IAccountService accounts, IInventoryService inventory, TimeProvider clock) : INotificationService
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
    public async Task<List<InventoryResult>> Alerts(Guid userId)
    {
        var household = await accounts.CurrentHousehold(userId); var preference = await Get(userId, household.Id);
        if (!preference.InAppEnabled || preference.DayOffsets.Length == 0) return [];
        var today = ExpiryRules.Assess(null, clock.GetUtcNow(), household.TimeZone).LocalDate;
        var through = today.AddDays(preference.DayOffsets.Max());
        var ids = await db.Inventory.AsNoTracking().Where(x => x.HouseholdId == household.Id && x.Status == "Active" && x.ReminderEnabled && x.ExpiryDate != null && x.ExpiryDate <= through && !preference.MutedCategoryIds.Contains(x.CategoryId)).OrderBy(x => x.ExpiryDate).ThenBy(x => x.Name).Take(100).Select(x => x.Id).ToListAsync();
        var result = new List<InventoryResult>();
        foreach (var id in ids) result.Add(await inventory.Get(userId, id));
        return result.Where(x => x.Status == "Active" && x.ReminderEnabled && x.ExpiryDate != null).ToList();
    }
    private static DeviceResult View(PushDevice d) => new(d.Id, d.Platform, d.LastSeenAt, d.InvalidatedAt is null);
    public async Task<List<DeviceResult>> Devices(Guid userId)
    {
        await accounts.CurrentHousehold(userId);
        return await db.PushDevices.Where(x => x.UserId == userId).OrderByDescending(x => x.LastSeenAt).Select(x => new DeviceResult(x.Id, x.Platform, x.LastSeenAt, x.InvalidatedAt == null)).ToListAsync();
    }
    public async Task<DeviceResult> RegisterDevice(Guid userId, Guid sessionId, DeviceRequest request)
    {
        await accounts.CurrentHousehold(userId);
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
        await accounts.CurrentHousehold(userId);
        var device = await db.PushDevices.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId) ?? throw new InventoryError(404, "Device not found.");
        device.InvalidatedAt = clock.GetUtcNow(); await db.SaveChangesAsync();
    }
    [GeneratedRegex(@"^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$")]
    private static partial Regex ExpoToken();
}
