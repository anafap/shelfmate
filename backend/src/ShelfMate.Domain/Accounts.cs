namespace ShelfMate.Domain;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Session
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string AccessHash { get; set; } = "";
    public string RefreshHash { get; set; } = "";
    public DateTimeOffset AccessExpiresAt { get; set; }
    public DateTimeOffset RefreshExpiresAt { get; set; }
    public bool Revoked { get; set; }
}

public sealed class Household
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string TimeZone { get; set; } = "";
    public Guid OwnerUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class HouseholdMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid UserId { get; set; }
    public int Slot { get; set; }
    public string Role { get; set; } = "Member";
    public DateTimeOffset JoinedAt { get; set; }
}

public sealed class HouseholdInvite
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HouseholdId { get; set; }
    public Guid CreatedBy { get; set; }
    public string TokenHash { get; set; } = "";
    public string? InvitedEmail { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RedeemedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
