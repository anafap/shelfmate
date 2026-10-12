using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ShelfMate.Application;

namespace ShelfMate.Api;

[Authorize]
public sealed class HouseholdHub(IAccountService accounts) : Hub
{
    public static string Group(Guid householdId) => $"household:{householdId}";
    public override async Task OnConnectedAsync()
    {
        var user = Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var household = await accounts.CurrentHousehold(user);
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(household.Id));
        await base.OnConnectedAsync();
    }
}
