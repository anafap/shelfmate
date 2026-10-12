# Architecture

Expo SDK 55 / React Native uses Expo Router for four primary tabs plus a hidden Settings route, and TanStack Query for household/member/invitation data. The session gate requires an authenticated account. Native refresh credentials use Expo SecureStore; access credentials remain in memory. The typed client serializes refresh attempts, retries an expired access token once, and preserves stored credentials on network failure. Logout/identity change clears query caches; no offline mutation queue exists.

ASP.NET Core uses thin endpoints and a session authentication handler. Application defines DTOs and the account-service boundary; Domain defines account/session/household/member/invite entities. Infrastructure implements persistence and transactional business rules with EF Core/Npgsql. Framework PasswordHasher hashes passwords. A testable TimeProvider controls expiry. Access/refresh/invite tokens are cryptographically random and stored only as hashes. Session refresh and logout lock the same stable session row so rotation is single-use and logout revokes it immediately.

Household membership is resolved from the authenticated user on every read/write. Invitations require Owner role. Creation and redemption lock the user, and invitation operations lock the household. Unique user membership and unique household slots (1/2), plus foreign keys and check constraints, enforce the MVP limit. Redemption atomically checks expiry/revocation/replay/email/capacity and records membership. Invitation secrets are returned only on creation and never through list endpoints.

Explicit migrations are applied with the EF CLI, never automatic schema creation. Integration tests apply these migrations to disposable PostgreSQL databases and exercise real HTTP flows, including concurrent requests. Rate limits cover authentication and invite redemption; Problem Details and correlation IDs identify errors. Production requires HTTPS.

Inventory, date-only expiry logic, shopping transfers, household-scoped SignalR refetch events and scheduled reminders remain subsequent phases. Phase 1 does not claim live sync or complete MVP acceptance. Device testing remains outstanding.
