using System.Security.Claims;
using ShelfMate.Application;

namespace ShelfMate.Api;

public static class InventoryEndpoints
{
    private static Guid User(ClaimsPrincipal principal) => Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static void MapInventory(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1/households/current").RequireAuthorization();
        api.MapGet("/dashboard", (ClaimsPrincipal u, IInventoryService s) => s.Dashboard(User(u)));
        api.MapGet("/categories", (ClaimsPrincipal u, IInventoryService s) => s.Categories(User(u)));
        api.MapGet("/inventory", (ClaimsPrincipal u, IInventoryService s, Guid? category, string? status, string? search, string? sort, int? page, int? pageSize) =>
            s.List(User(u), category, status ?? "Active", search, sort ?? "expiry", page ?? 1, pageSize ?? 20));
        api.MapGet("/inventory/{id:guid}", (Guid id, ClaimsPrincipal u, IInventoryService s) => s.Get(User(u), id));
        api.MapPost("/inventory", async (SaveInventoryRequest r, ClaimsPrincipal u, IInventoryService s) =>
        {
            var item = await s.Create(User(u), r);
            return Results.Created($"/api/v1/households/current/inventory/{item.Id}", item);
        });
        api.MapPatch("/inventory/{id:guid}", (Guid id, SaveInventoryRequest r, ClaimsPrincipal u, IInventoryService s) => s.Update(User(u), id, r));
        api.MapPost("/inventory/{id:guid}/consume", (Guid id, TransitionRequest r, ClaimsPrincipal u, IInventoryService s) => s.Transition(User(u), id, r.Version, "Consumed"));
        api.MapPost("/inventory/{id:guid}/discard", (Guid id, TransitionRequest r, ClaimsPrincipal u, IInventoryService s) => s.Transition(User(u), id, r.Version, "Discarded"));
    }
}
