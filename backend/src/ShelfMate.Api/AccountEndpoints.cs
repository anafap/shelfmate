using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using ShelfMate.Application;

namespace ShelfMate.Api;

public sealed class SessionAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder, IAccountService accounts)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return AuthenticateResult.NoResult();
        var session = await accounts.Authenticate(header[7..]);
        if (session is null) return AuthenticateResult.Fail("Session expired.");
        var identity = new ClaimsIdentity([new(ClaimTypes.NameIdentifier, session.UserId.ToString()), new("session", session.SessionId.ToString())], Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }
}

public static class AccountEndpoints
{
    private static Guid User(ClaimsPrincipal principal) => Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static void MapAccounts(this WebApplication app)
    {
        var auth = app.MapGroup("/api/v1/auth").RequireRateLimiting("accounts");
        auth.MapPost("/register", async (RegisterRequest r, IAccountService s) => Results.Json(await s.Register(r), statusCode: 201));
        auth.MapPost("/login", (LoginRequest r, IAccountService s) => s.Login(r));
        auth.MapPost("/refresh", (RefreshRequest r, IAccountService s) => s.Refresh(r.RefreshToken));
        auth.MapPost("/logout", async (ClaimsPrincipal u, IAccountService s) => { await s.Logout(Guid.Parse(u.FindFirstValue("session")!)); return Results.NoContent(); }).RequireAuthorization();
        var api = app.MapGroup("/api/v1").RequireAuthorization();
        api.MapGet("/me", (ClaimsPrincipal u, IAccountService s) => s.Profile(User(u)));
        api.MapPost("/households", async (CreateHouseholdRequest r, ClaimsPrincipal u, IAccountService s) => Results.Json(await s.CreateHousehold(User(u), r), statusCode: 201));
        api.MapGet("/households/current", (ClaimsPrincipal u, IAccountService s) => s.CurrentHousehold(User(u)));
        api.MapGet("/households/current/members", (ClaimsPrincipal u, IAccountService s) => s.Members(User(u)));
        api.MapGet("/households/current/invites", (ClaimsPrincipal u, IAccountService s) => s.Invites(User(u)));
        api.MapPost("/households/current/invites", async (InviteRequest r, ClaimsPrincipal u, IAccountService s) => Results.Json(await s.CreateInvite(User(u), r), statusCode: 201));
        api.MapDelete("/households/current/invites/{id:guid}", async (Guid id, ClaimsPrincipal u, IAccountService s) => { await s.RevokeInvite(User(u), id); return Results.NoContent(); });
        api.MapPost("/household-invites/redeem", (RedeemRequest r, ClaimsPrincipal u, IAccountService s) => s.Redeem(User(u), r.Token)).RequireRateLimiting("accounts");
    }
}
