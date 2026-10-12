using Microsoft.AspNetCore.SignalR.Client;
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

    private const string InventoryPath = "/api/v1/households/current/inventory";
    private static SaveInventoryRequest Product(string name = "Milk") => new(name, Guid.Parse("00000000-0000-4000-8000-000000000003"), 1, "bottle", ExpiryDate: new DateOnly(2026, 10, 13), ExpiryType: "Printed");
    private static async Task<InventoryResult> AddProduct(HttpClient client, SaveInventoryRequest? request = null)
    {
        var response = await client.PostAsJsonAsync(InventoryPath, request ?? Product());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        return (await response.Content.ReadFromJsonAsync<InventoryResult>())!;
    }

    [Fact]
    public async Task MembersShareInventoryAndOutsidersCannotReadWriteOrTransition()
    {
        var (owner, _) = await Register("owner"); var (member, _) = await Register("member"); var (outsider, _) = await Register("outsider");
        await Create(owner); await Create(outsider);
        var invite = await Invite(owner); await Redeem(member, invite.Token);
        var categories = await member.GetFromJsonAsync<List<CategoryResult>>("/api/v1/households/current/categories");
        Assert.Equal(12, categories!.Count);
        var item = await AddProduct(owner);
        Assert.Equal(item, await member.GetFromJsonAsync<InventoryResult>($"{InventoryPath}/{item.Id}"));
        var edit = Product("Shared milk") with { Version = item.Version, Quantity = 2 };
        Assert.Equal(HttpStatusCode.OK, (await member.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", edit)).StatusCode);
        var current = (await owner.GetFromJsonAsync<InventoryResult>($"{InventoryPath}/{item.Id}"))!;
        Assert.Equal("Shared milk", current.Name); Assert.Equal(2, current.Quantity);
        Assert.NotEqual(item.Version, current.Version); Assert.Equal(item.CreatedBy, current.CreatedBy);
        Assert.NotEqual(current.CreatedBy, current.UpdatedBy);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync($"{InventoryPath}/{item.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", edit)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PostAsJsonAsync($"{InventoryPath}/{item.Id}/consume", new TransitionRequest(current.Version))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PostAsJsonAsync($"{InventoryPath}/{item.Id}/discard", new TransitionRequest(current.Version))).StatusCode);
        Assert.Empty((await outsider.GetFromJsonAsync<InventoryPage>(InventoryPath))!.Items);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(InventoryPath)).StatusCode);
        var (noHome, _) = await Register("nohome");
        Assert.Equal(HttpStatusCode.Forbidden, (await noHome.GetAsync("/api/v1/households/current/categories")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await noHome.PostAsJsonAsync(InventoryPath, Product())).StatusCode);
    }

    [Theory]
    [InlineData("consume", "Consumed")]
    [InlineData("discard", "Discarded")]
    public async Task LifecycleTransitionsPreserveHistoryAndDisableReminders(string action, string status)
    {
        var (client, _) = await Register("owner"); await Create(client);
        var item = await AddProduct(client);
        var response = await client.PostAsJsonAsync($"{InventoryPath}/{item.Id}/{action}", new TransitionRequest(item.Version));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var archived = (await response.Content.ReadFromJsonAsync<InventoryResult>())!;
        Assert.Equal(status, archived.Status); Assert.False(archived.ReminderEnabled);
        Assert.Null(archived.ExpiryStatus); Assert.Null(archived.DaysRemaining);
        Assert.Equal(item.ExpiryDate, archived.ExpiryDate);
        Assert.Empty((await client.GetFromJsonAsync<InventoryPage>(InventoryPath))!.Items);
        Assert.Single((await client.GetFromJsonAsync<InventoryPage>($"{InventoryPath}?status={status}"))!.Items);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", Product() with { Version = archived.Version })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"{InventoryPath}/{item.Id}/{action}", new TransitionRequest(archived.Version))).StatusCode);
    }

    [Fact]
    public async Task ConcurrentInventoryEditsHaveOneWinnerAndOneConflict()
    {
        var (owner, _) = await Register("owner"); var (member, _) = await Register("member");
        await Create(owner); await Redeem(member, (await Invite(owner)).Token);
        var item = await AddProduct(owner);
        var replies = await Task.WhenAll(
            owner.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", Product("Owner edit") with { Version = item.Version }),
            member.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", Product("Member edit") with { Version = item.Version }));
        var winner = Assert.Single(replies, x => x.StatusCode == HttpStatusCode.OK);
        var loser = Assert.Single(replies, x => x.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal("application/problem+json", loser.Content.Headers.ContentType?.MediaType);
        var saved = (await winner.Content.ReadFromJsonAsync<InventoryResult>())!;
        Assert.Equal(saved, await owner.GetFromJsonAsync<InventoryResult>($"{InventoryPath}/{item.Id}"));
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync($"{InventoryPath}/{item.Id}/discard", new TransitionRequest(item.Version))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", Product())).StatusCode);
    }

    [Fact]
    public async Task SearchCategoryPaginationAndExpiryOrderingUseAuthoritativeRecords()
    {
        var (client, _) = await Register("owner"); await Create(client);
        var unknown = await AddProduct(client, Product("Unknown milk") with { ExpiryDate = null, ExpiryType = "Unknown" });
        var later = await AddProduct(client, Product("Later milk") with { ExpiryDate = new DateOnly(2026, 10, 20) });
        var soon = await AddProduct(client, Product("Soon milk"));
        var bread = await AddProduct(client, Product("Bread") with { CategoryId = Guid.Parse("00000000-0000-4000-8000-000000000008"), ExpiryDate = new DateOnly(2026, 10, 12) });
        var list = (await client.GetFromJsonAsync<InventoryPage>(InventoryPath))!;
        Assert.Equal(new[] { bread.Id, soon.Id, later.Id, unknown.Id }, list.Items.Select(x => x.Id));
        var search = (await client.GetFromJsonAsync<InventoryPage>($"{InventoryPath}?search=MILK&category={soon.CategoryId}&page=2&pageSize=2"))!;
        Assert.Equal(3, search.Total); Assert.Single(search.Items); Assert.Equal(unknown.Id, search.Items[0].Id);
        var byName = (await client.GetFromJsonAsync<InventoryPage>($"{InventoryPath}?sort=name"))!;
        Assert.Equal("Bread", byName.Items[0].Name);
        Assert.Equal("ExpiringSoon", list.Items[0].ExpiryStatus); Assert.Equal(0, list.Items[0].DaysRemaining);
        Assert.Equal("OK", list.Items[2].ExpiryStatus); Assert.Equal("Unknown", list.Items[3].ExpiryStatus);
        foreach (var query in new[] { "status=invalid", "sort=invalid", "page=0", "pageSize=101" })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"{InventoryPath}?{query}")).StatusCode);
    }

    [Theory]
    [InlineData("name")]
    [InlineData("quantity")]
    [InlineData("precision")]
    [InlineData("unit")]
    [InlineData("category")]
    [InlineData("missingDate")]
    [InlineData("unknownWithDate")]
    [InlineData("futurePurchase")]
    [InlineData("dateRange")]
    [InlineData("notes")]
    [InlineData("location")]
    public async Task InventoryRejectsInvalidFields(string field)
    {
        var (client, _) = await Register("owner"); await Create(client);
        var product = field switch
        {
            "name" => Product(" "),
            "quantity" => Product() with { Quantity = 0 },
            "precision" => Product() with { Quantity = 1.0001m },
            "unit" => Product() with { Unit = "invalid" },
            "category" => Product() with { CategoryId = Guid.NewGuid() },
            "missingDate" => Product() with { ExpiryDate = null },
            "unknownWithDate" => Product() with { ExpiryType = "Unknown" },
            "futurePurchase" => Product() with { PurchaseDate = new DateOnly(2026, 10, 13) },
            "dateRange" => Product() with { ExpiryDate = new DateOnly(2200, 1, 1) },
            "notes" => Product() with { Notes = new string('x', 2001) },
            _ => Product() with { StorageLocation = new string('x', 81) }
        };
        var response = await client.PostAsJsonAsync(InventoryPath, product);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Empty((await client.GetFromJsonAsync<InventoryPage>(InventoryPath))!.Items);
    }

    [Fact]
    public async Task DateEditsAndHouseholdCalendarChangesRecalculateUrgency()
    {
        var (client, _) = await Register("owner"); await Create(client);
        var item = await AddProduct(client, Product() with { ExpiryDate = new DateOnly(2026, 10, 12) });
        Assert.Equal(0, item.DaysRemaining);
        var updated = await client.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", Product() with { Version = item.Version, ExpiryDate = new DateOnly(2026, 10, 14), ExpiryType = "Estimated" });
        var estimated = (await updated.Content.ReadFromJsonAsync<InventoryResult>())!;
        Assert.Equal("Estimated", estimated.ExpiryType); Assert.Equal(2, estimated.DaysRemaining);
        clock.Advance(TimeSpan.FromHours(38));
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("owner@example.com", "LongEnoughPassword123!"));
        var session = (await login.Content.ReadFromJsonAsync<SessionResult>())!;
        client.DefaultRequestHeaders.Authorization = new("Bearer", session.AccessToken);
        var current = (await client.GetFromJsonAsync<InventoryResult>($"{InventoryPath}/{item.Id}"))!;
        Assert.Equal(new DateOnly(2026, 10, 14), current.HouseholdLocalDate);
        Assert.Equal(0, current.DaysRemaining);
        var unknown = await AddProduct(client, Product("Loose produce") with { ExpiryDate = null, ExpiryType = "Unknown", PurchaseDate = new DateOnly(2026, 10, 14) });
        Assert.Null(unknown.ExpiryDate); Assert.Null(unknown.DaysRemaining); Assert.Equal("Unknown", unknown.ExpiryStatus);
    }

    [Fact]
    public async Task DashboardCountsOnlyActiveItemsAndSortsNearestKnownDates()
    {
        var (owner, _) = await Register("owner"); var (member, _) = await Register("member"); var (outsider, _) = await Register("outsider");
        await Create(owner); await Create(outsider); await Redeem(member, (await Invite(owner)).Token);
        var tomorrow = await AddProduct(owner);
        var yesterday = await AddProduct(owner, Product("Yesterday") with { ExpiryDate = new DateOnly(2026, 10, 11) });
        var today = await AddProduct(owner, Product("Today estimated") with { ExpiryDate = new DateOnly(2026, 10, 12), ExpiryType = "Estimated" });
        var seven = await AddProduct(owner, Product("Seven") with { ExpiryDate = new DateOnly(2026, 10, 19) });
        var eight = await AddProduct(owner, Product("Eight") with { ExpiryDate = new DateOnly(2026, 10, 20) });
        await AddProduct(owner, Product("Unknown") with { ExpiryDate = null, ExpiryType = "Unknown" });
        var consumed = await AddProduct(owner, Product("Consumed") with { ExpiryDate = new DateOnly(2026, 10, 10) });
        await owner.PostAsJsonAsync($"{InventoryPath}/{consumed.Id}/consume", new TransitionRequest(consumed.Version));
        var discarded = await AddProduct(owner, Product("Discarded"));
        await owner.PostAsJsonAsync($"{InventoryPath}/{discarded.Id}/discard", new TransitionRequest(discarded.Version));
        var dashboard = (await owner.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(6, dashboard.ActiveCount); Assert.Equal(2, dashboard.ExpiringSoonCount); Assert.Equal(2, dashboard.ExpiryTodayOrPastCount);
        Assert.Equal(0, dashboard.ShoppingListCount);
        Assert.Equal(new[] { yesterday.Id, today.Id, tomorrow.Id, seven.Id, eight.Id }, dashboard.UseFirst.Select(x => x.Id));
        Assert.Equal("Estimated", dashboard.UseFirst[1].ExpiryType);
        var shared = (await member.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(dashboard.UseFirst, shared.UseFirst); Assert.Equal(dashboard.ActiveCount, shared.ActiveCount);
        Assert.Equal(0, (await outsider.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!.ActiveCount);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/v1/households/current/dashboard")).StatusCode);
        var (noHome, _) = await Register("nohome");
        Assert.Equal(HttpStatusCode.Forbidden, (await noHome.GetAsync("/api/v1/households/current/dashboard")).StatusCode);
    }

    [Fact]
    public async Task DashboardEmptyUnknownOnlyAndUseFirstLimitAreAccurate()
    {
        var (client, _) = await Register("owner"); await Create(client);
        var empty = (await client.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(0, empty.ActiveCount); Assert.Empty(empty.UseFirst);
        await AddProduct(client, Product("Unknown") with { ExpiryDate = null, ExpiryType = "Unknown" });
        var unknown = (await client.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(1, unknown.ActiveCount); Assert.Equal(0, unknown.ExpiringSoonCount); Assert.Equal(0, unknown.ExpiryTodayOrPastCount); Assert.Empty(unknown.UseFirst);
        for (var day = 24; day >= 13; day--) await AddProduct(client, Product($"Item {day}") with { ExpiryDate = new DateOnly(2026, 10, day) });
        var limited = (await client.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(13, limited.ActiveCount); Assert.Equal(10, limited.UseFirst.Count);
        Assert.Equal(new DateOnly(2026, 10, 13), limited.UseFirst.First().ExpiryDate);
        Assert.Equal(new DateOnly(2026, 10, 22), limited.UseFirst.Last().ExpiryDate);
    }

    [Fact]
    public async Task DashboardRecalculatesAfterDateEditsAndHouseholdMidnight()
    {
        var (client, _) = await Register("owner"); await Create(client);
        var item = await AddProduct(client);
        var response = await client.PatchAsJsonAsync($"{InventoryPath}/{item.Id}", Product() with { Version = item.Version, ExpiryDate = new DateOnly(2026, 10, 12) });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dashboard = (await client.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(0, dashboard.ExpiringSoonCount); Assert.Equal(1, dashboard.ExpiryTodayOrPastCount);
        clock.Advance(TimeSpan.FromHours(12));
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("owner@example.com", "LongEnoughPassword123!"));
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<SessionResult>())!.AccessToken);
        dashboard = (await client.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!;
        Assert.Equal(new DateOnly(2026, 10, 13), dashboard.HouseholdLocalDate);
        Assert.Equal(-1, dashboard.UseFirst.Single().DaysRemaining);
        Assert.Equal("Expired", dashboard.UseFirst.Single().ExpiryStatus);
    }

    private const string ShoppingPath = "/api/v1/households/current/shopping-items";
    private static async Task<ShoppingResult> AddShopping(HttpClient client, string name = "Milk")
    {
        var response = await client.PostAsJsonAsync(ShoppingPath, new SaveShoppingRequest(name));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ShoppingResult>())!;
    }
    [Fact]
    public async Task ShoppingPurchaseAndConcurrentTransferAreRetrySafe()
    {
        var (owner, _) = await Register("owner"); var (member, _) = await Register("member");
        await Create(owner); await Redeem(member, (await Invite(owner)).Token);
        var item = await AddShopping(owner);
        Assert.Single((await member.GetFromJsonAsync<List<ShoppingResult>>(ShoppingPath))!);
        Assert.Equal(1, (await owner.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!.ShoppingListCount);
        var request = new PurchaseRequest(item.Version, true, Guid.NewGuid());
        var first = await member.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/purchase", request);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var bought = (await first.Content.ReadFromJsonAsync<ShoppingResult>())!;
        Assert.Equal("member", bought.PurchasedByName); Assert.NotNull(bought.PurchasedAt);
        var retry = await member.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/purchase", request);
        Assert.Equal(bought, await retry.Content.ReadFromJsonAsync<ShoppingResult>());
        Assert.Equal(0, (await owner.GetFromJsonAsync<DashboardResult>("/api/v1/households/current/dashboard"))!.ShoppingListCount);
        var transfer = new TransferRequest(bought.Version, Product());
        var replies = await Task.WhenAll(owner.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/transfer-to-inventory", transfer), member.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/transfer-to-inventory", transfer));
        Assert.All(replies, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal((await replies[0].Content.ReadFromJsonAsync<InventoryResult>())!.Id, (await replies[1].Content.ReadFromJsonAsync<InventoryResult>())!.Id);
        Assert.Single((await owner.GetFromJsonAsync<InventoryPage>(InventoryPath))!.Items);
        var linked = (await owner.GetFromJsonAsync<List<ShoppingResult>>(ShoppingPath))!.Single();
        Assert.NotNull(linked.LinkedInventoryItemId);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/purchase", new PurchaseRequest(linked.Version, false, Guid.NewGuid()))).StatusCode);
    }
    [Fact]
    public async Task ShoppingRequiresDuplicateReviewAndProtectsOtherHouseholds()
    {
        var (owner, _) = await Register("owner"); var (outsider, _) = await Register("outsider");
        await Create(owner); await Create(outsider); await AddProduct(owner);
        var item = await AddShopping(owner);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/transfer-to-inventory", new TransferRequest(item.Version, Product()))).StatusCode);
        var purchase = await owner.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/purchase", new PurchaseRequest(item.Version, true, Guid.NewGuid()));
        var bought = (await purchase.Content.ReadFromJsonAsync<ShoppingResult>())!;
        var body = new TransferRequest(bought.Version, Product());
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/transfer-to-inventory", body)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/transfer-to-inventory", body with { ConfirmSeparateItem = true })).StatusCode);
        Assert.Equal(2, (await owner.GetFromJsonAsync<InventoryPage>(InventoryPath))!.Items.Count);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/transfer-to-inventory", body)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.PatchAsJsonAsync($"{ShoppingPath}/{item.Id}", new SaveShoppingRequest("Hacked", Version: bought.Version))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.DeleteAsync($"{ShoppingPath}/{item.Id}?version={bought.Version}")).StatusCode);
    }
    [Fact]
    public async Task ShoppingEditsUncheckRemovalAndValidationAreVersionChecked()
    {
        var (client, _) = await Register("owner"); await Create(client);
        var item = await AddShopping(client);
        var edited = await client.PatchAsJsonAsync($"{ShoppingPath}/{item.Id}", new SaveShoppingRequest("Bread", Quantity: 2, Unit: "pack", Notes: "Wholemeal", Version: item.Version));
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var current = (await edited.Content.ReadFromJsonAsync<ShoppingResult>())!;
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"{ShoppingPath}/{item.Id}?version={item.Version}")).StatusCode);
        var bought = await client.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/purchase", new PurchaseRequest(current.Version, true, Guid.NewGuid()));
        current = (await bought.Content.ReadFromJsonAsync<ShoppingResult>())!;
        var uncheckedReply = await client.PostAsJsonAsync($"{ShoppingPath}/{item.Id}/purchase", new PurchaseRequest(current.Version, false, Guid.NewGuid()));
        current = (await uncheckedReply.Content.ReadFromJsonAsync<ShoppingResult>())!;
        Assert.Equal("ToBuy", current.Status); Assert.Null(current.PurchasedBy); Assert.Null(current.PurchasedAt);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{ShoppingPath}/{item.Id}?version={current.Version}")).StatusCode);
        foreach (var invalid in new[] { new SaveShoppingRequest(" "), new SaveShoppingRequest("Bad", Quantity: -1), new SaveShoppingRequest("Bad", Unit: "invalid"), new SaveShoppingRequest("Bad", CategoryId: Guid.NewGuid()) })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(ShoppingPath, invalid)).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<List<ShoppingResult>>(ShoppingPath))!);
    }

    [Fact]
    public async Task LiveChangesReachHouseholdMembersButNeverAnotherHousehold()
    {
        var (owner, _) = await Register("owner"); var (member, memberSession) = await Register("member"); var (outsider, outsiderSession) = await Register("outsider");
        var household = await Create(owner); await Create(outsider); await Redeem(member, (await Invite(owner)).Token);
        Microsoft.AspNetCore.SignalR.Client.HubConnection Connection(string token) => new Microsoft.AspNetCore.SignalR.Client.HubConnectionBuilder()
            .WithUrl("http://localhost/hubs/household", options =>
            {
                options.AccessTokenProvider = () => Task.FromResult<string?>(token);
                options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
            }).Build();
        await using var shared = Connection(memberSession.AccessToken);
        await using var other = Connection(outsiderSession.AccessToken);
        var received = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var outsiderEvents = 0;
        shared.On<System.Text.Json.JsonElement>("ResourceChanged", value => received.TrySetResult(value.GetProperty("resource").GetString()!));
        other.On<System.Text.Json.JsonElement>("ResourceChanged", value => { if (value.GetProperty("resource").GetString() == "inventory") Interlocked.Increment(ref outsiderEvents); });
        await shared.StartAsync(); await other.StartAsync();
        await Assert.ThrowsAsync<Microsoft.AspNetCore.SignalR.HubException>(() => other.InvokeAsync("JoinHousehold", household.Id));
        await AddProduct(owner);
        Assert.Equal("inventory", await received.Task.WaitAsync(TimeSpan.FromSeconds(10)));
        await Task.Delay(200);
        Assert.Equal(0, outsiderEvents);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsync("/hubs/household/negotiate?negotiateVersion=1", null)).StatusCode);
    }

    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset now = new(2026, 10, 12, 10, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan amount) => now += amount;
    }
}
