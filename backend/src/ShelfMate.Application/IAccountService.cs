namespace ShelfMate.Application;

public sealed record RegisterRequest(string DisplayName, string Email, string Password);
public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string RefreshToken);
public sealed record CreateHouseholdRequest(string Name, string TimeZone);
public sealed record InviteRequest(string? InvitedEmail);
public sealed record RedeemRequest(string Token);
public sealed record UserProfile(Guid Id, string DisplayName, string Email);
public sealed record SessionResult(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, UserProfile User);
public sealed record HouseholdResult(Guid Id, string Name, string TimeZone, Guid OwnerUserId);
public sealed record MemberResult(Guid UserId, string DisplayName, string Role, DateTimeOffset JoinedAt);
public sealed record InviteResult(Guid Id, string Token, DateTimeOffset ExpiresAt);
public sealed record InviteSummary(Guid Id, string? InvitedEmail, DateTimeOffset ExpiresAt, DateTimeOffset? RedeemedAt, DateTimeOffset? RevokedAt);
public sealed record AuthenticatedSession(Guid UserId, Guid SessionId);
public sealed class AccountError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public interface IAccountService
{
    Task<SessionResult> Register(RegisterRequest request);
    Task<SessionResult> Login(LoginRequest request);
    Task<SessionResult> Refresh(string token);
    Task<AuthenticatedSession?> Authenticate(string token);
    Task Logout(Guid sessionId);
    Task<UserProfile> Profile(Guid userId);
    Task<HouseholdResult> CreateHousehold(Guid userId, CreateHouseholdRequest request);
    Task<HouseholdResult> CurrentHousehold(Guid userId);
    Task<List<MemberResult>> Members(Guid userId);
    Task<List<InviteSummary>> Invites(Guid userId);
    Task<InviteResult> CreateInvite(Guid userId, InviteRequest request);
    Task RevokeInvite(Guid userId, Guid inviteId);
    Task<HouseholdResult> Redeem(Guid userId, string token);
}
