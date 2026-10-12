using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ShelfMate.Application;

namespace ShelfMate.IntegrationTests;

public sealed class HealthTests
{
    [Theory]
    [InlineData("http://localhost:8081", true)]
    [InlineData("http://127.0.0.1:8081", true)]
    [InlineData("https://untrusted.example", false)]
    public async Task BrowserSignInPreflightAllowsOnlyConfiguredOrigins(string origin, bool allowed)
    {
        await using var factory = CreateFactory(true);
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var response = await factory.CreateClient().SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed) Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task ProductionBrowserSignInAllowsConfiguredHttpsOrigin()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Cors:AllowedOrigins:0", "https://shelfmate.example");
        });
        using var request = new HttpRequestMessage(HttpMethod.Options, "https://localhost/api/v1/auth/login");
        request.Headers.Add("Origin", "https://shelfmate.example");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var response = await factory.CreateClient().SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("https://shelfmate.example", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task LivenessDoesNotRequireDatabase()
    {
        await using var factory = CreateFactory(false);
        using var response = await factory.CreateClient().GetAsync("/api/v1/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("ok", await response.Content.ReadAsStringAsync());
        Assert.True(response.Headers.Contains("X-Correlation-ID"));
    }

    [Theory]
    [InlineData(true, HttpStatusCode.OK)]
    [InlineData(false, HttpStatusCode.ServiceUnavailable)]
    public async Task ReadinessReflectsDatabaseAvailability(bool available, HttpStatusCode expected)
    {
        await using var factory = CreateFactory(available);
        using var response = await factory.CreateClient().GetAsync("/api/v1/health/ready");
        Assert.Equal(expected, response.StatusCode);
        if (!available)
        {
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            var body = await response.Content.ReadAsStringAsync();
            Assert.Contains("traceId", body);
            Assert.DoesNotContain("Password", body);
        }
    }

    [Fact]
    public async Task UnconfiguredDatabaseReturnsUnavailable()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("ConnectionStrings:ShelfMate", "");
        });
        using var response = await factory.CreateClient().GetAsync("/api/v1/health/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateFactory(bool available) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IDatabaseAvailability>();
                services.AddSingleton<IDatabaseAvailability>(new DatabaseStub(available));
            });
        });

    private sealed class DatabaseStub(bool available) : IDatabaseAvailability
    {
        public Task<bool> CanConnectAsync(CancellationToken cancellationToken) => Task.FromResult(available);
    }
}
