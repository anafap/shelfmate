using System.Security.Claims;
using ShelfMate.Application;

namespace ShelfMate.Api;

public static class NotificationEndpoints
{
    private static Guid User(ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static void MapNotifications(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1").RequireAuthorization();
        api.MapGet("/households/current/alerts", (ClaimsPrincipal u, INotificationService s) => s.Alerts(User(u)));
        api.MapGet("/me/notification-preferences", (ClaimsPrincipal u, INotificationService s) => s.Preferences(User(u)));
        api.MapPut("/me/notification-preferences", (PreferenceRequest r, ClaimsPrincipal u, INotificationService s) => s.SavePreferences(User(u), r));
        api.MapGet("/me/push-devices", (ClaimsPrincipal u, INotificationService s) => s.Devices(User(u)));
        api.MapPost("/me/push-devices", (DeviceRequest r, ClaimsPrincipal u, INotificationService s) => s.RegisterDevice(User(u), Guid.Parse(u.FindFirstValue("session")!), r)).RequireRateLimiting("accounts");
        api.MapDelete("/me/push-devices/{id:guid}", async (Guid id, ClaimsPrincipal u, INotificationService s) => { await s.RemoveDevice(User(u), id); return Results.NoContent(); });
    }
}
