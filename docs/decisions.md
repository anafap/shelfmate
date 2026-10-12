# Decisions

- 2026-10-12: Begin with phase 0 because the workspace contains only AGENTS.md. Preserve the existing GitHub license and history.
- Use installed .NET 10 LTS, satisfying the requested .NET 8-or-later supported LTS stack. Reference: https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core
- Use the official Expo SDK 55 template and its compatible React Native versions; retain its `src/app` route location. Reference: https://docs.expo.dev/versions/v55.0.0/
- Local PostgreSQL 17 runs through Docker Compose, bound to loopback. Local passwords belong in ignored .env files.
- Phase 0 has no domain schema, therefore no artificial empty migration. Add EF migrations with the auth/household slice.
- Use first-party operational checks without authentication; expose only availability. Production requires HTTPS. HTTP instructions are for local development.
- Future work remains as listed in AGENTS.md: barcode lookup, OCR, recipes, analytics, offline mutation queue, localization, and widgets.
- Use host port 5433 by default because 5432 is occupied on this workstation; configure POSTGRES_PORT and connection string together. CI uses its isolated service port 5432.

- Phase 1 uses database-backed opaque bearer tokens instead of JWTs: a database read per authenticated request permits immediate revocation without signing-key provisioning. Tokens have 256 bits of randomness, are stored hashed, and rotate under a row lock. Framework PasswordHasher provides password hashing. Native refresh tokens use Expo SecureStore; access tokens remain in memory. Web development sessions are memory-only.
- MVP users belong to one household. Unique user membership and household slot (1/2) indexes enforce membership and capacity. User/household locks serialize creation/redemption. No leave/delete API is offered.

- Auth bug fixes: clear the client query cache synchronously on account changes before notifying React, so newly mounted household queries are not removed mid-load. Deduplicate native startup restoration and reuse an already rotated token after delayed unauthorized responses. Sign-out always clears local credentials; if offline, server revocation remains unconfirmed until that session expires. Web refresh persistence remains memory-only.
- Browser CORS uses an explicit `Cors:AllowedOrigins` allowlist in every environment; development defaults cover localhost and 127.0.0.1 on port 8081. Additional LAN/port origins and production HTTPS origins must be configured explicitly. Local API launches use stable port 5050 and the documented no-profile command sets Development mode.

- Phase 2 expiry is computed on the server from date-only values and the household's IANA calendar date. The default soon threshold is seven days; expiry today is included in ExpiringSoon with `daysRemaining: 0` and distinct UI wording. Printed and Estimated are user-entered date types; Unknown has no date. Consumed/Discarded history shows lifecycle status without active urgency labels. No freshness dates are invented.

- Phase 2 uses UUID optimistic-concurrency versions and full editable snapshots on PATCH. Conflicts preserve the client draft; reload is explicit and replaces it for review before resubmission. No last-writer-wins updates or automatic merges. Quantity supports three decimal places with a positive maximum of 1,000,000. Purchase dates cannot be after household-local today; entered dates are bounded to 1900–2100 and can represent already-passed dates.
- System categories are seeded reference data with stable IDs. Consumed/Discarded are history/archive views; records are not deleted or reactivated. Native date-picker integration and device acceptance remain unverified; date fields currently accept YYYY-MM-DD. Item reminder flags are persisted, but delivery remains phase 6. Phase 2 uses manual refetch between devices; SignalR remains phase 5.
