namespace ShelfMate.Application;

public sealed class EmailVerificationOptions
{
    public bool Enabled { get; set; }
}

public sealed record EmailVerificationStatus(bool Verified, DateTimeOffset? ExpiresAt);
public sealed record ConfirmEmailRequest(string Token);
public interface IEmailVerificationService
{
    Task<EmailVerificationStatus> Status(Guid userId);
    Task Request(Guid userId, CancellationToken cancellationToken);
    Task<EmailVerificationStatus> Confirm(Guid userId, string token);
}

public interface IEmailVerificationDelivery
{
    Task Send(string recipient, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken);
}
