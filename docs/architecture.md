# Architecture

ShelfMate is a React Native app built with Expo SDK 57, TypeScript, Expo Router, and TanStack Query. Native refresh credentials use Expo SecureStore; access credentials stay in memory. The typed API client refreshes expired sessions, and logout or account changes clear private query state. The four main tabs are Home, Inventory, Shopping, and Alerts; account and household management live in Settings.

The .NET 10 ASP.NET Core API has thin HTTP endpoints, application service interfaces, domain entities/rules, and EF Core/Npgsql persistence in PostgreSQL. Passwords and opaque session/invite tokens are stored as hashes. Explicit EF migrations change the schema; startup does not create production schema. Household membership is checked for each resource request. Database constraints and transactional locking enforce the two-member limit, single-use invites, optimistic versions, and retry-safe shopping-to-inventory transfer.

Inventory expiry is computed on the server using date-only arithmetic and the household's IANA time zone. Expiry type (Printed, Estimated, Unknown) is distinct from lifecycle (Active, Consumed, Discarded). The dashboard uses one captured household date and excludes non-active products from urgency counts and Use First.

Shopping items are shared by household. Purchase confirmation and inventory transfer are separate operations; a linked transfer can be safely retried. Both resources use version checks to surface concurrent edits.

Authenticated SignalR connections join a server-resolved household group. A resource-change event prompts clients to refetch authoritative data. The app reconnects and refetches on foreground resume; it does not claim fresh data while disconnected.

In-app alerts use current preferences and active inventory. A server worker schedules opted-in push reminders through Expo, records unique dispatch claims, and checks provider receipts. Push delivery is best-effort; the app requires a real Expo project and Android Firebase credentials for device delivery. In-app alerts do not depend on push permission.

The internal Android APK has been locally signed and verified. It embeds the development API's LAN address chosen at build time and is available locally at `.local/artifacts/ShelfMate-internal.apk`; it is ignored by Git. Two-phone acceptance, production HTTPS hosting, real push setup, and public store distribution remain release tasks. Local HTTP is for the same-Wi-Fi internal test only.
