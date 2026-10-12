namespace ShelfMate.Domain;

public sealed class NotificationPreference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid HouseholdId { get; set; }
    public bool PushEnabled { get; set; }
    public bool InAppEnabled { get; set; } = true;
    public int[] DayOffsets { get; set; } = [7, 3, 1, 0];
    public Guid[] MutedCategoryIds { get; set; } = [];
    public TimeOnly LocalDeliveryTime { get; set; } = new(9, 0);
}
public sealed class PushDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Token { get; set; } = "";
    public string Platform { get; set; } = "";
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset? InvalidatedAt { get; set; }
}
public sealed class NotificationLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid UserId { get; set; }
    public Guid InventoryItemId { get; set; }
    public DateOnly ExpiryDate { get; set; }
    public int Offset { get; set; }
    public string Status { get; set; } = "Claimed";
    public DateTimeOffset AttemptedAt { get; set; }
    public string[] TicketIds { get; set; } = [];
    public Guid[] TicketDeviceIds { get; set; } = [];
    public DateTimeOffset? ReceiptsCheckedAt { get; set; }
}
