using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace EntraRoleReaper.Api.Data;

public class Repository<TEntity>(ReaperDbContext dbContext) where TEntity : Entity
{
    protected DbSet<TEntity> dbSet => dbContext.Set<TEntity>();
    public void Add(TEntity entity)
    {
        dbSet.Add(entity);
        dbContext.SaveChanges();
    }

    public virtual async Task<IEnumerable<TEntity>> Get(Expression<Func<TEntity, bool>>? filter = null, Func<IQueryable<TEntity>, IOrderedQueryable<TEntity>>? orderBy = null, string includeProperties = "")
    {
        IQueryable<TEntity> query = dbSet;
        if (filter != null)
        {
            query = query.Where(filter);
        }
        foreach (var includeProperty in includeProperties.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries))
        {
            query = query.Include(includeProperty);
        }
        if (orderBy != null)
        {
            return await orderBy(query).ToListAsync();
        }
        return await query.ToListAsync();
    }

    public virtual async Task<TEntity?> GetById(Guid id)
    {
        return await dbSet.FindAsync(id);
    }

    public void Delete(Guid id)
    {
        var entityToDelete = dbSet.Find(id);
        if (entityToDelete is null) return;
        Delete(entityToDelete);
    }

    public virtual void Delete(TEntity entity)
    {
        if (dbContext.Entry(entity).State == EntityState.Detached)
        {
            dbSet.Attach(entity);
        }
        else
        {
            dbSet.Remove(entity);
        }
    }

    public void Update(TEntity entity)
    {
        dbSet.Attach(entity);
        dbContext.Entry(entity).State = EntityState.Modified;
    }

    public Task SaveAsync()
    {
        return dbContext.SaveChangesAsync();
    }
}
