using System.Security.Claims;
using ShelfMate.Application;

namespace ShelfMate.Api;

public static class EmailVerificationEndpoints
{
    private static Guid User(ClaimsPrincipal principal) => Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static void MapEmailVerification(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1/me/email-verification").RequireAuthorization().RequireRateLimiting("accounts");
        api.MapGet("", (ClaimsPrincipal u, IEmailVerificationService s) => s.Status(User(u)));
        api.MapPost("", async (ClaimsPrincipal u, IEmailVerificationService s, CancellationToken cancellationToken) =>
        {
            await s.Request(User(u), cancellationToken);
            return Results.Accepted(value: new { status = "requested" });
        });
        api.MapPost("/confirm", (ConfirmEmailRequest r, ClaimsPrincipal u, IEmailVerificationService s) => s.Confirm(User(u), r.Token));
    }
}
