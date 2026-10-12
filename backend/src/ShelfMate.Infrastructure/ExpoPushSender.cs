using System.Net.Http.Json;
using System.Text.Json;
using ShelfMate.Application;

namespace ShelfMate.Infrastructure;

public sealed class ExpoPushSender(HttpClient http) : IPushSender
{
    public async Task<List<PushResult>> Send(IReadOnlyList<PushTarget> devices, string title, string body, CancellationToken cancellationToken)
    {
        var results = new List<PushResult>();
        foreach (var batch in devices.Chunk(100))
        {
            try
            {
                using var response = await http.PostAsJsonAsync("https://exp.host/--/api/v2/push/send", batch.Select(x => new { to = x.Token, title, body, sound = "default", data = new { screen = "alerts" } }), cancellationToken);
                response.EnsureSuccessStatusCode();
                using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
                var data = json.RootElement.GetProperty("data").EnumerateArray().ToArray();
                for (var i = 0; i < batch.Length; i++)
                {
                    if (i >= data.Length) { results.Add(new(batch[i].DeviceId, "UnknownDelivery", null)); continue; }
                    var ticket = data[i];
                    if (ticket.GetProperty("status").GetString() == "ok") results.Add(new(batch[i].DeviceId, "Accepted", ticket.GetProperty("id").GetString()));
                    else results.Add(new(batch[i].DeviceId, Invalid(ticket) ? "InvalidDevice" : "Rejected", null));
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or OperationCanceledException)
            { results.AddRange(batch.Select(x => new PushResult(x.DeviceId, "UnknownDelivery", null))); }
        }
        return results;
    }
    private static bool Invalid(JsonElement element) => element.TryGetProperty("details", out var details) && details.TryGetProperty("error", out var error) && error.GetString() == "DeviceNotRegistered";
    public async Task<Dictionary<string, string>> Receipts(string[] ticketIds, CancellationToken cancellationToken)
    {
        using var response = await http.PostAsJsonAsync("https://exp.host/--/api/v2/push/getReceipts", new { ids = ticketIds }, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        return json.RootElement.GetProperty("data").EnumerateObject().ToDictionary(x => x.Name, x => x.Value.GetProperty("status").GetString() == "ok" ? "ReceiptAccepted" : Invalid(x.Value) ? "InvalidDevice" : "Rejected");
    }
}
