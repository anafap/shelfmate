using System.Security.Claims;
using ShelfMate.Application;

namespace ShelfMate.Api;

public static class ShoppingEndpoints
{
    private static Guid User(ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static void MapShopping(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1/households/current/shopping-items").RequireAuthorization();
        api.MapGet("", (ClaimsPrincipal u, IShoppingService s) => s.List(User(u)));
        api.MapPost("", async (SaveShoppingRequest r, ClaimsPrincipal u, IShoppingService s) => Results.Json(await s.Create(User(u), r), statusCode: 201));
        api.MapPatch("/{id:guid}", (Guid id, SaveShoppingRequest r, ClaimsPrincipal u, IShoppingService s) => s.Update(User(u), id, r));
        api.MapDelete("/{id:guid}", async (Guid id, Guid version, ClaimsPrincipal u, IShoppingService s) => { await s.Delete(User(u), id, version); return Results.NoContent(); });
        api.MapPost("/{id:guid}/purchase", (Guid id, PurchaseRequest r, ClaimsPrincipal u, IShoppingService s) => s.Purchase(User(u), id, r));
        api.MapPost("/{id:guid}/transfer-to-inventory", (Guid id, TransferRequest r, ClaimsPrincipal u, IShoppingService s) => s.Transfer(User(u), id, r));
    }
}
