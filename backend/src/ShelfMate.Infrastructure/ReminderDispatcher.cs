using Microsoft.EntityFrameworkCore;
using Npgsql;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed class ReminderDispatcher(ShelfMateDbContext db, IPushSender sender, TimeProvider clock) : IReminderDispatcher
{
    public async Task Dispatch(CancellationToken cancellationToken)
    {
        var preferences = await db.Preferences.AsNoTracking().Where(x => x.PushEnabled).ToListAsync(cancellationToken);
        foreach (var preference in preferences)
        {
            var household = await db.Households.AsNoTracking().SingleAsync(x => x.Id == preference.HouseholdId, cancellationToken);
            var local = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById(household.TimeZone));
            var today = DateOnly.FromDateTime(local.DateTime);
            if (TimeOnly.FromDateTime(local.DateTime) < preference.LocalDeliveryTime) continue;
            foreach (var offset in preference.DayOffsets)
            {
                var date = today.AddDays(offset);
                var ids = await db.Inventory.AsNoTracking().Where(x => x.HouseholdId == household.Id && x.Status == "Active" && x.ReminderEnabled && x.ExpiryDate == date && !preference.MutedCategoryIds.Contains(x.CategoryId)
                    && !db.NotificationLogs.Any(log => log.UserId == preference.UserId && log.InventoryItemId == x.Id && log.ExpiryDate == date && log.Offset == offset)).OrderBy(x => x.Id).Take(100).Select(x => x.Id).ToListAsync(cancellationToken);
                foreach (var id in ids) await DispatchItem(preference.UserId, household.Id, id, date, offset, cancellationToken);
            }
        }
    }
    private async Task DispatchItem(Guid userId, Guid householdId, Guid itemId, DateOnly date, int offset, CancellationToken cancellationToken)
    {
        db.ChangeTracker.Clear();
        if (!await db.PushDevices.AnyAsync(x => x.UserId == userId && x.InvalidatedAt == null, cancellationToken)) return;
        var log = new NotificationLog { HouseholdId = householdId, UserId = userId, InventoryItemId = itemId, ExpiryDate = date, Offset = offset, AttemptedAt = clock.GetUtcNow() };
        db.NotificationLogs.Add(log);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" }) { db.ChangeTracker.Clear(); return; }
        // The durable claim survives a crash during HTTP delivery. Never blindly replay an uncertain send.
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var item = await db.Inventory.FromSqlInterpolated($"SELECT * FROM \"Inventory\" WHERE \"Id\" = {itemId} AND \"HouseholdId\" = {householdId} FOR UPDATE").SingleAsync(cancellationToken);
        var preference = await db.Preferences.FromSqlInterpolated($"SELECT * FROM \"Preferences\" WHERE \"UserId\" = {userId} AND \"HouseholdId\" = {householdId} FOR UPDATE").SingleOrDefaultAsync(cancellationToken);
        var household = await db.Households.AsNoTracking().SingleAsync(x => x.Id == householdId, cancellationToken);
        var local = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById(household.TimeZone));
        var remaining = ExpiryRules.Assess(item.ExpiryDate, clock.GetUtcNow(), household.TimeZone).DaysRemaining;
        if (preference is null || !preference.PushEnabled || !preference.DayOffsets.Contains(offset) || preference.MutedCategoryIds.Contains(item.CategoryId) || item.Status != "Active" || !item.ReminderEnabled || item.ExpiryDate != date || remaining != offset
            || TimeOnly.FromDateTime(local.DateTime) < preference.LocalDeliveryTime || !await db.Members.AnyAsync(x => x.UserId == userId && x.HouseholdId == householdId, cancellationToken))
            log.Status = "Skipped";
        else
        {
            var devices = await db.PushDevices.FromSqlInterpolated($"SELECT * FROM \"PushDevices\" WHERE \"UserId\" = {userId} AND \"InvalidatedAt\" IS NULL ORDER BY \"Id\" FOR UPDATE").ToListAsync(cancellationToken);
            if (devices.Count == 0) log.Status = "Skipped";
            else
            {
                var label = item.ExpiryType == "Estimated" ? "Estimated date" : "Entered expiry date";
                var body = $"Review {item.Name}. {label}: {date:yyyy-MM-dd}. Review the item and its packaging instructions.";
                var results = await sender.Send(devices.Select(x => new PushTarget(x.Id, x.Token)).ToArray(), "ShelfMate · review an item", body, cancellationToken);
                var tickets = results.Where(x => x.TicketId != null).ToArray();
                log.TicketIds = tickets.Select(x => x.TicketId!).ToArray(); log.TicketDeviceIds = tickets.Select(x => x.DeviceId).ToArray();
                log.Status = tickets.Length > 0 ? "Accepted" : results.Any(x => x.Status == "UnknownDelivery") ? "UnknownDelivery" : "Rejected";
                foreach (var result in results.Where(x => x.Status == "InvalidDevice"))
                {
                    var device = devices.SingleOrDefault(x => x.Id == result.DeviceId);
                    if (device is not null) device.InvalidatedAt = clock.GetUtcNow();
                }
            }
        }
        await db.SaveChangesAsync(cancellationToken); await tx.CommitAsync(cancellationToken);
    }
    public async Task CheckReceipts(CancellationToken cancellationToken)
    {
        var cutoff = clock.GetUtcNow().AddMinutes(-15);
        var logs = await db.NotificationLogs.Where(x => x.ReceiptsCheckedAt == null && x.TicketIds.Length > 0 && x.AttemptedAt <= cutoff).OrderBy(x => x.AttemptedAt).Take(50).ToListAsync(cancellationToken);
        foreach (var log in logs)
        {
            var receipts = await sender.Receipts(log.TicketIds, cancellationToken);
            for (var i = 0; i < log.TicketIds.Length; i++)
                if (receipts.GetValueOrDefault(log.TicketIds[i]) == "InvalidDevice")
                    await db.PushDevices.Where(x => x.Id == log.TicketDeviceIds[i] && x.UserId == log.UserId).ExecuteUpdateAsync(s => s.SetProperty(x => x.InvalidatedAt, clock.GetUtcNow()), cancellationToken);
            if (log.TicketIds.All(receipts.ContainsKey))
            {
                log.Status = log.TicketIds.All(id => receipts[id] == "ReceiptAccepted") ? "ReceiptAccepted" : "Rejected";
                log.ReceiptsCheckedAt = clock.GetUtcNow();
            }
            else if (log.AttemptedAt < clock.GetUtcNow().AddHours(-24)) { log.Status = "UnknownReceipt"; log.ReceiptsCheckedAt = clock.GetUtcNow(); }
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}
