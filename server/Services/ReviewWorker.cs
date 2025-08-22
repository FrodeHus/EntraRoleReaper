using EntraRoleReaper.Api.Services.Interfaces;

namespace EntraRoleReaper.Api.Services;

public class ReviewWorker(IReviewCoordinator coordinator, ILogger<ReviewWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Review worker started");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await coordinator.RunPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error running review worker loop");
            }
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
        logger.LogInformation("Review worker stopping");
    }
}
