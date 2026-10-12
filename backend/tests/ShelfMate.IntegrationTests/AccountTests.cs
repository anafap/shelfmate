using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using ShelfMate.Application;
using ShelfMate.Infrastructure;

namespace ShelfMate.IntegrationTests;

public sealed class AccountTests : IAsyncLifetime
{
    private WebApplicationFactory<Program> factory = null!;
    private string connection = "";
    private string adminConnection = "";
    private readonly string database = "shelfmate_test_" + Guid.NewGuid().ToString("N");
    private readonly TestClock clock = new();

    public async Task InitializeAsync()
    {
        adminConnection = Environment.GetEnvironmentVariable("SHELFMATE_TEST_CONNECTION")
            ?? throw new InvalidOperationException("Set SHELFMATE_TEST_CONNECTION to a local PostgreSQL connection with CREATE DATABASE permission.");
        await using var admin = new NpgsqlConnection(adminConnection);
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand($"CREATE DATABASE {database}", admin);
        await create.ExecuteNonQueryAsync();
        var builder = new NpgsqlConnectionStringBuilder(adminConnection) { Database = database };
        connection = builder.ConnectionString;
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Development");
            host.UseSetting("ConnectionStrings:ShelfMate", connection);
            host.ConfigureServices(services =>
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(clock);
            });
        });
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ShelfMateDbContext>().Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (factory is not null) await factory.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        if (string.IsNullOrEmpty(adminConnection)) return;
        await using var admin = new NpgsqlConnection(adminConnection);
        await admin.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS {database} WITH (FORCE)", admin);
        await drop.ExecuteNonQueryAsync();
    }

    private async Task<(HttpClient Client, SessionResult Session)> Register(string name)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(name, $"{name}@example.com", "LongEnoughPassword123!"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<SessionResult>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return (client, session);
    }
    private static async Task<HouseholdResult> Create(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/v1/households", new CreateHouseholdRequest("Our home", "Asia/Bahrain"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HouseholdResult>())!;
    }
    private static async Task<InviteResult> Invite(HttpClient client, string? email = null)
    {
        var response = await client.PostAsJsonAsync("/api/v1/households/current/invites", new InviteRequest(email));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<InviteResult>())!;
    }
    private static Task<HttpResponseMessage> Redeem(HttpClient client, string token) => client.PostAsJsonAsync("/api/v1/household-invites/redeem", new RedeemRequest(token));

    [Fact]
    public async Task TwoAccountsJoinSameHouseholdAndThirdIsRejected()
    {
        var (owner, _) = await Register("owner"); var (member, _) = await Register("member"); var (outsider, _) = await Register("outsider");
        var household = await Create(owner);
        var first = await Invite(owner); var second = await Invite(owner);
        Assert.Equal(HttpStatusCode.OK, (await Redeem(member, first.Token)).StatusCode);
        Assert.Equal(household, await member.GetFromJsonAsync<HouseholdResult>("/api/v1/households/current"));
        Assert.Equal(2, (await member.GetFromJsonAsync<List<MemberResult>>("/api/v1/households/current/members"))!.Count);
        Assert.Equal(HttpStatusCode.Conflict, (await Redeem(outsider, second.Token)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Redeem(outsider, first.Token)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync("/api/v1/households/current/members")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/v1/households/current/invites", new InviteRequest(null))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.DeleteAsync($"/api/v1/households/current/invites/{second.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync("/api/v1/households/current/invites")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/v1/me")).StatusCode);
    }

    [Fact]
    public async Task InvitesRespectEmailExpiryRevocationAndHouseholdIsolation()
    {
        var (owner, _) = await Register("owner"); var (other, _) = await Register("other");
        await Create(owner); await Create(other);
        var targeted = await Invite(owner, "someone@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await Redeem(other, targeted.Token)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"/api/v1/households/current/invites/{targeted.Id}")).StatusCode);
        var (joiner, _) = await Register("joiner");
        var revoked = await Invite(owner);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/api/v1/households/current/invites/{revoked.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Redeem(joiner, revoked.Token)).StatusCode);
        var expired = await Invite(owner);
        clock.Advance(TimeSpan.FromDays(7));
        var login = await joiner.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("joiner@example.com", "LongEnoughPassword123!"));
        var session = (await login.Content.ReadFromJsonAsync<SessionResult>())!;
        joiner.DefaultRequestHeaders.Authorization = new("Bearer", session.AccessToken);
        Assert.Equal(HttpStatusCode.BadRequest, (await Redeem(joiner, expired.Token)).StatusCode);
    }

    [Fact]
    public async Task ConcurrentRedemptionsNeverExceedCapacity()
    {
        var (owner, _) = await Register("owner"); var (a, _) = await Register("a"); var (b, _) = await Register("b");
        await Create(owner);
        var first = await Invite(owner); var second = await Invite(owner);
        var results = await Task.WhenAll(Redeem(a, first.Token), Redeem(b, second.Token));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(2, (await owner.GetFromJsonAsync<List<MemberResult>>("/api/v1/households/current/members"))!.Count);
    }

    [Fact]
    public async Task ConcurrentReplayOfSameInviteHasOneWinner()
    {
        var (owner, _) = await Register("owner"); var (a, _) = await Register("a"); var (b, _) = await Register("b");
        await Create(owner); var invite = await Invite(owner);
        var results = await Task.WhenAll(Redeem(a, invite.Token), Redeem(b, invite.Token));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SessionsRotateRejectReplayExpireAndLogoutRevokes()
    {
        var (client, session) = await Register("owner");
        var bad = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("owner@example.com", "wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        var responses = await Task.WhenAll(client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(session.RefreshToken)), client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(session.RefreshToken)));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Unauthorized);
        var rotated = (await responses.Single(r => r.IsSuccessStatusCode).Content.ReadFromJsonAsync<SessionResult>())!;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/me")).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", rotated.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/me")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/v1/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(rotated.RefreshToken))).StatusCode);
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("owner@example.com", "LongEnoughPassword123!"));
        var active = (await login.Content.ReadFromJsonAsync<SessionResult>())!;
        clock.Advance(TimeSpan.FromMinutes(15));
        client.DefaultRequestHeaders.Authorization = new("Bearer", active.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/me")).StatusCode);
        clock.Advance(TimeSpan.FromDays(30));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(active.RefreshToken))).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShelfMateDbContext>();
        Assert.DoesNotContain(await db.Sessions.ToListAsync(), s => s.AccessHash == session.AccessToken || s.RefreshHash == session.RefreshToken);
        Assert.NotEqual("LongEnoughPassword123!", (await db.Users.SingleAsync()).PasswordHash);
    }

    [Fact]
    public async Task ValidationAndUniqueMembershipAreEnforced()
    {
        var (client, _) = await Register("owner");
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Other", "OWNER@example.com", "LongEnoughPassword123!"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(" ", "invalid", "short"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/households", new CreateHouseholdRequest("Home", "invalid"))).StatusCode);
        await Create(client);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/households", new CreateHouseholdRequest("Second", "Asia/Bahrain"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Redeem(client, "invalid")).StatusCode);
    }

    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset now = new(2026, 10, 12, 10, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan amount) => now += amount;
    }
}
