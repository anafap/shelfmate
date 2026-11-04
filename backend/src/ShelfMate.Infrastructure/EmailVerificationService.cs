using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed class UnconfiguredEmailVerificationDelivery : IEmailVerificationDelivery
{
    public Task Send(string recipient, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) =>
        throw new AccountError(503, "Email verification delivery is not configured.");
}

public sealed class EmailVerificationService(ShelfMateDbContext db, IEmailVerificationDelivery delivery, TimeProvider clock) : IEmailVerificationService
{
    private static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
    private static EmailVerificationStatus View(User user) => new(user.EmailVerifiedAt is not null, user.EmailVerificationExpiresAt);
    private Task<User> LockUser(Guid id) => db.Users.FromSqlInterpolated($"SELECT * FROM \"Users\" WHERE \"Id\" = {id} FOR UPDATE").SingleAsync();

    public async Task<EmailVerificationStatus> Status(Guid userId) => View(await db.Users.AsNoTracking().SingleAsync(x => x.Id == userId));

    public async Task Request(Guid userId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var user = await LockUser(userId);
        if (user.EmailVerifiedAt is not null) return;
        var now = clock.GetUtcNow();
        if (user.EmailVerificationRequestedAt > now.AddMinutes(-1)) throw new AccountError(429, "Wait a minute before requesting another verification code.");
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        user.EmailVerificationTokenHash = Convert.ToHexString(Hash(token));
        user.EmailVerificationRequestedAt = now;
        user.EmailVerificationExpiresAt = now.AddMinutes(20);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await delivery.Send(user.Email, token, user.EmailVerificationExpiresAt.Value, cancellationToken);
    }

    public async Task<EmailVerificationStatus> Confirm(Guid userId, string token)
    {
        if (token is null || token.Length != 64 || !token.All(Uri.IsHexDigit)) throw new AccountError(400, "Verification code is invalid or expired.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await LockUser(userId);
        if (user.EmailVerificationTokenHash is null || user.EmailVerificationExpiresAt is null || user.EmailVerificationExpiresAt <= clock.GetUtcNow()
            || !CryptographicOperations.FixedTimeEquals(Hash(token), Convert.FromHexString(user.EmailVerificationTokenHash)))
            throw new AccountError(400, "Verification code is invalid or expired.");
        user.EmailVerifiedAt = clock.GetUtcNow();
        user.EmailVerificationTokenHash = null;
        user.EmailVerificationExpiresAt = null;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return View(user);
    }
}
