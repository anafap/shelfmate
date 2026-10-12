namespace ShelfMate.Application;

public sealed record PreferenceRequest(bool PushEnabled, bool InAppEnabled, int[] DayOffsets, Guid[] MutedCategoryIds, string LocalDeliveryTime);
public sealed record DeviceRequest(string Token, string Platform);
public sealed record DeviceResult(Guid Id, string Platform, DateTimeOffset LastSeenAt, bool Active);
public interface INotificationService
{
    Task<PreferenceRequest> Preferences(Guid userId);
    Task<PreferenceRequest> SavePreferences(Guid userId, PreferenceRequest request);
    Task<List<InventoryResult>> Alerts(Guid userId);
    Task<List<DeviceResult>> Devices(Guid userId);
    Task<DeviceResult> RegisterDevice(Guid userId, Guid sessionId, DeviceRequest request);
    Task RemoveDevice(Guid userId, Guid id);
}
public sealed record PushTarget(Guid DeviceId, string Token);
public sealed record PushResult(Guid DeviceId, string Status, string? TicketId);
public interface IPushSender
{
    Task<List<PushResult>> Send(IReadOnlyList<PushTarget> devices, string title, string body, CancellationToken cancellationToken);
    Task<Dictionary<string, string>> Receipts(string[] ticketIds, CancellationToken cancellationToken);
}
public interface IReminderDispatcher
{
    Task Dispatch(CancellationToken cancellationToken);
    Task CheckReceipts(CancellationToken cancellationToken);
}
