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
builder.Logging.AddJsonConsole();
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:8081").AllowAnyHeader().AllowAnyMethod()));
}

var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Correlation-ID"] = context.TraceIdentifier;
    await next(context);
});
if (app.Environment.IsDevelopment())
{
    app.UseCors();
}
else
{
    app.UseHttpsRedirection();
}
app.MapGet("/api/v1/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/v1/health/ready", async (IDatabaseAvailability database, CancellationToken cancellationToken) =>
    await database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "ready" })
        : Results.Problem(statusCode: 503, title: "Database unavailable", detail: "Please try again later."));
app.Run();

public partial class Program;
