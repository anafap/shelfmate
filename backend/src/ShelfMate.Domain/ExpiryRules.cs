namespace ShelfMate.Domain;

public sealed record ExpiryAssessment(string Status, int? DaysRemaining, DateOnly LocalDate);

public static class ExpiryRules
{
    public const int DefaultThreshold = 7;
    public static ExpiryAssessment Assess(DateOnly? expiryDate, DateTimeOffset utcNow, string timeZone, int threshold = DefaultThreshold)
    {
        var localDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(utcNow, TimeZoneInfo.FindSystemTimeZoneById(timeZone)).DateTime);
        if (expiryDate is null) return new("Unknown", null, localDate);
        var days = expiryDate.Value.DayNumber - localDate.DayNumber;
        return new(days < 0 ? "Expired" : days <= threshold ? "ExpiringSoon" : "OK", days, localDate);
    }
}
