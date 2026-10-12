using System.Net;
using System.Text;
using System.Text.Json;
using ShelfMate.Application;
using ShelfMate.Infrastructure;

namespace ShelfMate.IntegrationTests;

public sealed class PushProtocolTests
{
    [Fact]
    public async Task ExpoTicketsPreserveDeviceIdentityAndDetectInvalidTokens()
    {
        var first = Guid.NewGuid(); var second = Guid.NewGuid();
        using var http = new HttpClient(new Handler(async request =>
        {
            Assert.Equal("/--/api/v2/push/send", request.RequestUri!.AbsolutePath);
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
            Assert.Equal("expiry-review", payload.RootElement[0].GetProperty("channelId").GetString());
            Assert.Equal("Review", payload.RootElement[0].GetProperty("body").GetString());
            return Json("""{"data":[{"status":"ok","id":"ticket"},{"status":"error","details":{"error":"DeviceNotRegistered"}}]}""");
        }));
        var results = await new ExpoPushSender(http).Send([new PushTarget(first, "ExpoPushToken[one]"), new PushTarget(second, "ExpoPushToken[two]")], "ShelfMate", "Review", CancellationToken.None);
        Assert.Equal(new PushResult(first, "Accepted", "ticket"), results[0]);
        Assert.Equal(new PushResult(second, "InvalidDevice", null), results[1]);
    }
    [Fact]
    public async Task UncertainHttpFailureDoesNotPretendToBeSent()
    {
        using var http = new HttpClient(new Handler(_ => throw new HttpRequestException("Network failure")));
        var results = await new ExpoPushSender(http).Send([new PushTarget(Guid.NewGuid(), "ExpoPushToken[one]")], "ShelfMate", "Review", CancellationToken.None);
        Assert.Equal("UnknownDelivery", results.Single().Status);
        Assert.Null(results.Single().TicketId);
    }
    private static HttpResponseMessage Json(string json) => new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
