using System.Collections.Concurrent;
using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace EntraRoleReaper.Api.Services;

public class ReviewCoordinator : IReviewCoordinator
{
    private readonly IMemoryCache _cache;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReviewCoordinator> _logger;
    private readonly SemaphoreSlim _semaphore;
    private readonly ConcurrentQueue<Guid> _queue = new();
    private readonly string CacheKeyPrefix = "ReviewJob:";

    public ReviewCoordinator(IMemoryCache cache, IServiceScopeFactory scopeFactory, IOptions<ReviewOptions> options, ILogger<ReviewCoordinator> logger)
    {
        _cache = cache;
        _scopeFactory = scopeFactory;
        _logger = logger;
        var max = Math.Max(1, options.Value.MaxConcurrent);
        _semaphore = new SemaphoreSlim(max, max);
    }

    public Guid Enqueue(Guid tenantId, string requestedBy, ReviewRequest request, string? userAccessToken = null)
    {
        var job = new ReviewJob(Guid.NewGuid(), requestedBy, request, tenantId, DateTimeOffset.UtcNow, userAccessToken);
        SetJob(job);
        _queue.Enqueue(job.Id);
        _logger.LogInformation("Enqueued review job {JobId} by {User} with {Count} subjects", job.Id, requestedBy, request.UsersOrGroups?.Count ?? 0);
        return job.Id;
    }

    public bool ExistsDuplicate(string requestedBy, ReviewRequest request)
    {
        var existing = List();
        var targets = new HashSet<string>(request.UsersOrGroups ?? [], StringComparer.OrdinalIgnoreCase);
        return existing.Any(j => j.RequestedBy.Equals(requestedBy, StringComparison.OrdinalIgnoreCase)
                                 && j.Status is ReviewJobStatus.Queued or ReviewJobStatus.Running
                                 && new HashSet<string>(j.Request.UsersOrGroups ?? [], StringComparer.OrdinalIgnoreCase).SetEquals(targets));
    }

    public ReviewJob? Get(Guid id) => _cache.TryGetValue(CacheKeyPrefix + id, out ReviewJob? job) ? job : null;

    public IReadOnlyCollection<ReviewJob> List(Guid? tenantId = null)
    {
        // IMemoryCache doesn't enumerate keys; keep a separate index
        var index = _cache.GetOrCreate("ReviewJobIndex", _ => new HashSet<Guid>())!;
        var list = new List<ReviewJob>();
        foreach (var id in index.ToArray())
        {
            if (_cache.TryGetValue(CacheKeyPrefix + id, out ReviewJob? job) && job is not null)
            {
                if (tenantId is null || job.TenantId == tenantId)
                    list.Add(job);
            }
        }
        return list.OrderByDescending(j => j.EnqueuedAt).ToList();
    }

    private void SetJob(ReviewJob job)
    {
        var index = _cache.GetOrCreate("ReviewJobIndex", _ => new HashSet<Guid>())!;
        index.Add(job.Id);
        _cache.Set(CacheKeyPrefix + job.Id, job, TimeSpan.FromHours(1));
    }

    public Task RunPendingAsync(CancellationToken ct = default)
    {
        // Spin through queue and dispatch jobs respecting concurrency
    while (_queue.TryDequeue(out var id))
        {
            if (ct.IsCancellationRequested) break;
            var job = Get(id);
            if (job is null) continue;
            _ = ProcessAsync(job, ct); // fire and forget
        }
        return Task.CompletedTask;
    }

    private async Task ProcessAsync(ReviewJob job, CancellationToken ct)
    {
        await _semaphore.WaitAsync(ct);
        try
        {
            job.Status = ReviewJobStatus.Running;
            job.StartedAt = DateTimeOffset.UtcNow;
            SetJob(job);

            _logger.LogInformation("Starting review job {JobId}", job.Id);
            using var scope = _scopeFactory.CreateScope();
            // Flow the user's access token into this scope for GraphServiceFactory
            var tokenCtx = scope.ServiceProvider.GetRequiredService<AccessTokenContext>();
            tokenCtx.UserAccessToken = job.UserAccessToken;
            var reviewService = scope.ServiceProvider.GetRequiredService<IReviewService>();
            var result = await reviewService.ReviewAsync(job.Request);
            job.Result = result;
            job.Status = ReviewJobStatus.Completed;
            job.CompletedAt = DateTimeOffset.UtcNow;
            SetJob(job);
            _logger.LogInformation("Completed review job {JobId}", job.Id);
        }
        catch (Exception ex)
        {
            job.Status = ReviewJobStatus.Failed;
            job.Error = ex.Message;
            job.CompletedAt = DateTimeOffset.UtcNow;
            SetJob(job);
            _logger.LogError(ex, "Review job {JobId} failed", job.Id);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public (bool success, string? error) Cancel(Guid id, string requestedBy)
    {
        var job = Get(id);
        if (job is null) return (false, "Not found");
        if (!string.Equals(job.RequestedBy, requestedBy, StringComparison.OrdinalIgnoreCase))
            return (false, "Forbidden");
        if (job.Status == ReviewJobStatus.Running || job.Status == ReviewJobStatus.Completed)
            return (false, "Cannot cancel running or completed job");

        // Filter queue by re-enqueueing others
        var remaining = new List<Guid>();
        while (_queue.TryDequeue(out var qid))
            if (qid != id) remaining.Add(qid);
        foreach (var qid in remaining) _queue.Enqueue(qid);

        job.Status = ReviewJobStatus.Cancelled;
        job.CompletedAt = DateTimeOffset.UtcNow;
        SetJob(job);
        _logger.LogInformation("Cancelled review job {JobId}", job.Id);
        return (true, null);
    }
}
