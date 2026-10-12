using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using ShelfMate.Api;
using Microsoft.EntityFrameworkCore;
using ShelfMate.Application;
using ShelfMate.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddDbContext<ShelfMateDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("ShelfMate") ?? ""));
builder.Services.AddScoped<IDatabaseAvailability, DatabaseAvailability>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IShoppingService, ShoppingService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IReminderDispatcher, ReminderDispatcher>();
builder.Services.AddHttpClient<IPushSender, ExpoPushSender>(http =>
{
    http.Timeout = TimeSpan.FromSeconds(15);
    var token = builder.Configuration["ExpoPush:AccessToken"];
    if (!string.IsNullOrWhiteSpace(token)) http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
});
if (builder.Configuration.GetValue("Reminders:Enabled", true)) builder.Services.AddHostedService<ReminderWorker>();
builder.Services.AddAuthentication("Session").AddScheme<AuthenticationSchemeOptions, SessionAuthentication>("Session", null);
builder.Services.AddAuthorization();
builder.Services.AddSignalR();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("accounts", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Logging.AddJsonConsole();
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0) policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (AccountError error) { await Results.Problem(statusCode: error.Status, title: error.Message).ExecuteAsync(context); }
    catch (InventoryError error) { await Results.Problem(statusCode: error.Status, title: error.Message).ExecuteAsync(context); }
});
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Correlation-ID"] = context.TraceIdentifier;
    await next(context);
});
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    await next(context);
    if (context.Response.StatusCode is >= 200 and < 300 && context.Request.Method is "POST" or "PATCH" or "PUT" or "DELETE")
    {
        var path = context.Request.Path.Value ?? "";
        var resource = path.Contains("/notification-preferences") ? "preferences" : path.Contains("/inventory") ? "inventory" : path.Contains("/shopping-items") ? "shopping" : path.Contains("/household") ? "household" : null;
        if (resource is not null && Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            try
            {
                var accounts = context.RequestServices.GetRequiredService<IAccountService>();
                var household = await accounts.CurrentHousehold(userId);
                await context.RequestServices.GetRequiredService<IHubContext<HouseholdHub>>().Clients.Group(HouseholdHub.Group(household.Id)).SendAsync("ResourceChanged", new { resource });
            }
            catch { app.Logger.LogWarning("Household refetch event unavailable for request {TraceId}", context.TraceIdentifier); }
        }
    }
});
app.MapHub<HouseholdHub>("/hubs/household", options => options.CloseOnAuthenticationExpiration = true);
app.MapAccounts();
app.MapInventory();
app.MapShopping();
app.MapNotifications();
app.MapGet("/api/v1/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/v1/health/ready", async (IDatabaseAvailability database, CancellationToken cancellationToken) =>
    await database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "ready" })
        : Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Please try again later."));
app.Run();

public partial class Program;
