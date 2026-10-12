using ShelfMate.Domain;

namespace ShelfMate.UnitTests;

public sealed class ExpiryTests
{
    [Theory]
    [InlineData(-1, "Expired")]
    [InlineData(0, "ExpiringSoon")]
    [InlineData(1, "ExpiringSoon")]
    [InlineData(3, "ExpiringSoon")]
    [InlineData(7, "ExpiringSoon")]
    [InlineData(8, "OK")]
    public void CalendarBoundariesUseHouseholdDate(int days, string status)
    {
        var date = new DateOnly(2026, 10, 12);
        var result = ExpiryRules.Assess(date.AddDays(days), new DateTimeOffset(2026, 10, 12, 10, 0, 0, TimeSpan.Zero), "Asia/Bahrain");
        Assert.Equal(status, result.Status);
        Assert.Equal(days, result.DaysRemaining);
        Assert.Equal(date, result.LocalDate);
    }

    [Fact]
    public void MissingDateIsUnknown()
    {
        var result = ExpiryRules.Assess(null, DateTimeOffset.UtcNow, "Asia/Bahrain");
        Assert.Equal("Unknown", result.Status);
        Assert.Null(result.DaysRemaining);
    }

    [Theory]
    [InlineData("Asia/Bahrain", 13, -1)]
    [InlineData("America/Los_Angeles", 12, 0)]
    public void SameInstantUsesDifferentHouseholdDates(string zone, int day, int remaining)
    {
        var result = ExpiryRules.Assess(new DateOnly(2026, 10, 12), new DateTimeOffset(2026, 10, 12, 22, 30, 0, TimeSpan.Zero), zone);
        Assert.Equal(new DateOnly(2026, 10, day), result.LocalDate);
        Assert.Equal(remaining, result.DaysRemaining);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(23)]
    public void LeapDayAndTimeOfDayUseCalendarArithmetic(int hour)
    {
        var result = ExpiryRules.Assess(new DateOnly(2024, 3, 1), new DateTimeOffset(2024, 2, 29, hour, 0, 0, TimeSpan.Zero), "Etc/UTC");
        Assert.Equal(1, result.DaysRemaining);
    }

    [Fact]
    public void DaylightSavingTransitionDoesNotUseElapsedHours()
    {
        var result = ExpiryRules.Assess(new DateOnly(2026, 3, 9), new DateTimeOffset(2026, 3, 8, 9, 30, 0, TimeSpan.Zero), "America/Los_Angeles");
        Assert.Equal(1, result.DaysRemaining);
    }

    [Fact]
    public void CustomThresholdChangesUrgencyOnly()
    {
        var result = ExpiryRules.Assess(new DateOnly(2026, 10, 16), new DateTimeOffset(2026, 10, 12, 10, 0, 0, TimeSpan.Zero), "Asia/Bahrain", 3);
        Assert.Equal("OK", result.Status);
        Assert.Equal(4, result.DaysRemaining);
    }
}
