using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using ShelfMate.Application;
using ShelfMate.Domain;

namespace ShelfMate.Infrastructure;

public sealed class AccountService(ShelfMateDbContext db, TimeProvider clock) : IAccountService
{
    private readonly PasswordHasher<User> hasher = new();
    private DateTimeOffset Now => clock.GetUtcNow();
    private static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    private static AccountError Error(int status, string message) => new(status, message);
    private static string Text(string? value, string label, int max)
    {
        var text = value?.Trim() ?? "";
        if (text.Length < 1 || text.Length > max) throw Error(400, $"{label} must contain 1–{max} characters.");
        return text;
    }
    private static string Email(string? value)
    {
        var email = Text(value, "Email", 254).ToUpperInvariant();
        if (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email) throw Error(400, "Enter a valid email address.");
        return email;
    }
    private static UserProfile View(User user) => new(user.Id, user.DisplayName, user.Email);
    private static HouseholdResult View(Household household) => new(household.Id, household.Name, household.TimeZone, household.OwnerUserId);

    public async Task<SessionResult> Register(RegisterRequest request)
    {
        var email = Email(request.Email);
        var name = Text(request.DisplayName, "Display name", 80);
        if (request.Password is null || request.Password.Length is < 12 or > 128) throw Error(400, "Password must contain 12–128 characters.");
        if (await db.Users.AnyAsync(x => x.Email == email)) throw Error(409, "An account with this email already exists.");
        var user = new User { Email = email, DisplayName = name, CreatedAt = Now, UpdatedAt = Now };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        var result = NewSession(user);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
        { throw Error(409, "An account with this email already exists."); }
        return result;
    }

    public async Task<SessionResult> Login(LoginRequest request)
    {
        var email = Email(request.Email);
        if (request.Password is null || request.Password.Length > 128) throw Error(401, "Email or password is incorrect.");
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        // Perform password hashing even for unknown accounts to reduce account timing differences.
        if (user is null)
        {
            hasher.HashPassword(new User(), request.Password);
            throw Error(401, "Email or password is incorrect.");
        }
        var verification = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed) throw Error(401, "Email or password is incorrect.");
        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, request.Password);
            user.UpdatedAt = Now;
        }
        var result = NewSession(user);
        await db.SaveChangesAsync();
        return result;
    }

    private SessionResult NewSession(User user)
    {
        var access = Token(); var refresh = Token();
        var session = new Session { UserId = user.Id, AccessHash = Hash(access), RefreshHash = Hash(refresh), AccessExpiresAt = Now.AddMinutes(15), RefreshExpiresAt = Now.AddDays(30) };
        db.Sessions.Add(session);
        return new(access, refresh, session.AccessExpiresAt, View(user));
    }

    public async Task<SessionResult> Refresh(string token)
    {
        ValidateToken(token, 401);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var hash = Hash(token);
        var session = await db.Sessions.FromSqlInterpolated($"SELECT * FROM \"Sessions\" WHERE \"RefreshHash\" = {hash} FOR UPDATE").SingleOrDefaultAsync();
        if (session is null || session.Revoked || session.RefreshExpiresAt <= Now) throw Error(401, "Session expired. Please sign in again.");
        var user = await db.Users.SingleAsync(x => x.Id == session.UserId);
        var access = Token(); var refresh = Token();
        session.AccessHash = Hash(access);
        session.RefreshHash = Hash(refresh);
        session.AccessExpiresAt = Now.AddMinutes(15);
        session.RefreshExpiresAt = Now.AddDays(30);
        var result = new SessionResult(access, refresh, session.AccessExpiresAt, View(user));
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return result;
    }

    private static void ValidateToken(string? token, int status)
    {
        if (token is null || token.Length != 64 || !token.All(Uri.IsHexDigit)) throw Error(status, "Invalid or expired token.");
    }

    public async Task<AuthenticatedSession?> Authenticate(string token)
    {
        if (token.Length != 64) return null;
        var hash = Hash(token);
        var session = await db.Sessions.AsNoTracking().SingleOrDefaultAsync(x => x.AccessHash == hash && !x.Revoked && x.AccessExpiresAt > Now);
        return session is null ? null : new(session.UserId, session.Id);
    }

    public async Task Logout(Guid sessionId)
    {
        // Serialize against refresh so logout cannot miss a concurrently rotated session.
        await using var transaction = await db.Database.BeginTransactionAsync();
        var session = await db.Sessions.FromSqlInterpolated($"SELECT * FROM \"Sessions\" WHERE \"Id\" = {sessionId} FOR UPDATE").SingleOrDefaultAsync();
        if (session is not null) session.Revoked = true;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<UserProfile> Profile(Guid userId) => View(await db.Users.SingleAsync(x => x.Id == userId));
    private async Task LockUser(Guid userId) => await db.Users.FromSqlInterpolated($"SELECT * FROM \"Users\" WHERE \"Id\" = {userId} FOR UPDATE").SingleAsync();
    private async Task<Household> LockHousehold(Guid id) => await db.Households.FromSqlInterpolated($"SELECT * FROM \"Households\" WHERE \"Id\" = {id} FOR UPDATE").SingleAsync();
    private async Task<HouseholdMember> Membership(Guid userId) => await db.Members.SingleOrDefaultAsync(x => x.UserId == userId) ?? throw Error(404, "Create or join a household first.");
    private async Task<HouseholdMember> Owner(Guid userId)
    {
        var member = await Membership(userId);
        if (member.Role != "Owner") throw Error(403, "Only the household owner can manage invitations.");
        return member;
    }

    public async Task<HouseholdResult> CreateHousehold(Guid userId, CreateHouseholdRequest request)
    {
        var name = Text(request.Name, "Household name", 80);
        var zone = Text(request.TimeZone, "Time zone", 100);
        if (!TimeZoneInfo.TryFindSystemTimeZoneById(zone, out var timeZone) || !timeZone.HasIanaId) throw Error(400, "Choose a valid IANA time zone, such as Asia/Bahrain.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockUser(userId);
        if (await db.Members.AnyAsync(x => x.UserId == userId)) throw Error(409, "You already belong to a household.");
        var household = new Household { Name = name, TimeZone = zone, OwnerUserId = userId, CreatedAt = Now };
        db.Households.Add(household);
        db.Members.Add(new HouseholdMember { HouseholdId = household.Id, UserId = userId, Slot = 1, Role = "Owner", JoinedAt = Now });
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return View(household);
    }

    public async Task<HouseholdResult> CurrentHousehold(Guid userId)
    {
        var member = await Membership(userId);
        return View(await db.Households.SingleAsync(x => x.Id == member.HouseholdId));
    }
    public async Task<List<MemberResult>> Members(Guid userId)
    {
        var member = await Membership(userId);
        return await (from m in db.Members join u in db.Users on m.UserId equals u.Id where m.HouseholdId == member.HouseholdId orderby m.Slot select new MemberResult(u.Id, u.DisplayName, m.Role, m.JoinedAt)).ToListAsync();
    }
    public async Task<List<InviteSummary>> Invites(Guid userId)
    {
        var owner = await Owner(userId);
        return await db.Invites.Where(x => x.HouseholdId == owner.HouseholdId).OrderByDescending(x => x.CreatedAt).Take(50).Select(x => new InviteSummary(x.Id, x.InvitedEmail, x.ExpiresAt, x.RedeemedAt, x.RevokedAt)).ToListAsync();
    }
    public async Task<InviteResult> CreateInvite(Guid userId, InviteRequest request)
    {
        var email = string.IsNullOrWhiteSpace(request.InvitedEmail) ? null : Email(request.InvitedEmail);
        var owner = await Owner(userId);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockHousehold(owner.HouseholdId);
        if (await db.Members.CountAsync(x => x.HouseholdId == owner.HouseholdId) >= 2) throw Error(409, "This household already has two members.");
        var token = Token();
        var invite = new HouseholdInvite { HouseholdId = owner.HouseholdId, CreatedBy = userId, TokenHash = Hash(token), InvitedEmail = email, CreatedAt = Now, ExpiresAt = Now.AddDays(7) };
        db.Invites.Add(invite);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return new(invite.Id, token, invite.ExpiresAt);
    }
    public async Task RevokeInvite(Guid userId, Guid inviteId)
    {
        var owner = await Owner(userId);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockHousehold(owner.HouseholdId);
        var invite = await db.Invites.SingleOrDefaultAsync(x => x.Id == inviteId && x.HouseholdId == owner.HouseholdId) ?? throw Error(404, "Invitation not found.");
        invite.RevokedAt ??= Now;
        await db.SaveChangesAsync(); await transaction.CommitAsync();
    }
    public async Task<HouseholdResult> Redeem(Guid userId, string token)
    {
        ValidateToken(token, 400);
        var hash = Hash(token);
        var householdId = await db.Invites.Where(x => x.TokenHash == hash).Select(x => (Guid?)x.HouseholdId).SingleOrDefaultAsync() ?? throw Error(400, "Invitation is invalid or no longer available.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockUser(userId);
        var household = await LockHousehold(householdId);
        var invite = await db.Invites.SingleAsync(x => x.TokenHash == hash);
        if (invite.RevokedAt is not null || invite.RedeemedAt is not null || invite.ExpiresAt <= Now) throw Error(400, "Invitation is invalid or no longer available.");
        if (invite.InvitedEmail is not null && invite.InvitedEmail != (await db.Users.SingleAsync(x => x.Id == userId)).Email) throw Error(403, "This invitation is for a different email address.");
        if (await db.Members.AnyAsync(x => x.UserId == userId)) throw Error(409, "You already belong to a household.");
        if (await db.Members.CountAsync(x => x.HouseholdId == householdId) >= 2) throw Error(409, "This household already has two members.");
        db.Members.Add(new HouseholdMember { HouseholdId = householdId, UserId = userId, Slot = 2, JoinedAt = Now });
        invite.RedeemedAt = Now;
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return View(household);
    }
}
