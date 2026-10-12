using ShelfMate.Application;

namespace ShelfMate.Api;

public sealed class ReminderWorker(IServiceScopeFactory scopes, ILogger<ReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                using var scope = scopes.CreateScope();
                var dispatcher = scope.ServiceProvider.GetRequiredService<IReminderDispatcher>();
                await dispatcher.Dispatch(stoppingToken); await dispatcher.CheckReceipts(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch { logger.LogWarning("Reminder pass unavailable; in-app alerts remain the fallback."); }
        }
    }
}
