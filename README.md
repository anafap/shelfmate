# ShelfMate

Shared household inventory, grocery checklist, and expiry reminders for Android and iOS.

## Current state

Phases 1–3 implemented: sign-up/sign-in/sign-out, native secure session persistence and token rotation, household creation with an explicit time zone, two-member membership, and owner-managed expiring single-use invitations. Expo Router retains four tabs with household/account settings outside primary navigation. PostgreSQL migrations, real-database integration tests, mobile tests, and CI are included. Shared inventory is implemented with twelve categories, quick add/edit, search/filter/sort/pagination, consumed/discarded history, version conflicts, and server-computed household-local expiry labels. Home shows active count, upcoming dates, today/past dates, and the ten nearest-dated active products in Use First. Shopping, live sync, and reminder delivery are **not implemented**. Two-device/emulator verification remains outstanding; this is not the complete MVP. No sample household data is displayed.

## Local setup

Prerequisites: .NET 10 SDK, Node 22 LTS, npm, Docker with Compose, and a simulator or compatible Expo Go client. Install the EF migration CLI before setup: `dotnet tool install --global dotnet-ef --version 10.0.10`.

```sh
cp .env.example .env
# Replace the password in BOTH POSTGRES_PASSWORD and ConnectionStrings__ShelfMate.
docker compose --env-file .env -f infra/compose.yaml up -d --wait
set -a
source .env
set +a
dotnet ef database update --project backend/src/ShelfMate.Infrastructure --startup-project backend/src/ShelfMate.Api
ASPNETCORE_ENVIRONMENT=Development dotnet run --project backend/src/ShelfMate.Api --no-launch-profile --urls http://0.0.0.0:5050
```

Keep the connection string quoted in `.env` so shell loading preserves its semicolons.

In another terminal:

```sh
cd mobile
cp .env.example .env
npm ci
npm start
```

`EXPO_PUBLIC_API_URL` is a public URL, never a secret. Use `http://localhost:5050` for iOS simulator/web, `http://10.0.2.2:5050` for Android emulator, or your computer's LAN IP for a physical phone on the same network. The API binds all interfaces for local device testing; PostgreSQL stays on loopback. Restart Expo after changing its environment. Browser origins default to `http://localhost:8081` and `http://127.0.0.1:8081`; if Expo selects another port or you use a LAN address, set `Cors__AllowedOrigins__0` to that exact web origin before starting the API. Production web hosting must configure its HTTPS origin explicitly using the same setting. HTTP is for local development; production requires HTTPS.

Sign in or create your account. Home lets you create a household or enter an invitation code during onboarding, then shows your household dashboard. Open Account & household settings to generate/share or revoke a code; your partner signs in with a separate account and joins from Home. Confirm the proposed IANA time zone at household creation. Household changes can be refreshed manually; live sync comes in phase 5. Network errors offer retry, and expired sessions return to sign-in. Native sessions persist in SecureStore; web development sessions are memory-only.

## Verification

```sh
set -a
source .env
set +a
dotnet build backend/ShelfMate.sln
SHELFMATE_TEST_CONNECTION="$ConnectionStrings__ShelfMate" dotnet test backend/ShelfMate.sln
dotnet format backend/ShelfMate.sln --verify-no-changes
cd mobile
npm run typecheck
npm run lint
npm test
npx expo export --platform all
```

Database smoke check while the API is running:

```sh
curl --fail http://localhost:5050/api/v1/health/live
curl --fail http://localhost:5050/api/v1/health/ready
```

`docker compose --env-file .env -f infra/compose.yaml stop` preserves local data. Integration tests replace database availability for deterministic HTTP assertions and also check missing configuration. CI starts real PostgreSQL and verifies API readiness separately. Phase 1 includes an explicit account/household migration. Install the EF CLI with `dotnet tool install --global dotnet-ef --version 10.0.10`. Account integration tests require `SHELFMATE_TEST_CONNECTION` with CREATE DATABASE permission; they create and remove isolated test databases.

## Architecture and next milestone

See [architecture](docs/architecture.md), [API](docs/api.md), [decisions](docs/decisions.md), and [implementation contract](AGENTS.md).

Next: phase 4, the shared shopping checklist and retry-safe purchase-to-inventory transfer, including a real dashboard shopping count. Subsequent milestones and future work are in AGENTS.md.

Phase 3 verification: 47 backend tests (13 expiry unit tests plus 34 real-PostgreSQL HTTP tests) and 29 mobile tests pass. Backend cases include household isolation, concurrent edits, version conflicts, lifecycle/history/reminder flags, category/search/pagination, date validation, household time zones, leap day, daylight-saving changes, printed/estimated/unknown date handling, and dashboard counts/ordering/empty states/date changes. Mobile cases include quick add, optional details without inferred dates, estimated date labels, invalid calendar dates, conflict reload without automatic resubmission, confirmation before consume/discard, filtering, network errors, dashboard counts, empty/unknown-only households, estimated date copy, retry and stale-summary wording. Type checking, lint, C# formatting, and Expo web/iOS/Android bundle exports pass. The inventory migration was applied to the local development database. Native bundle exports are not signed release builds or device tests. npm currently reports dependency vulnerabilities; dependency audit/remediation remains release-hardening work.

Manual device acceptance remains: run on two phones/emulators, create distinct accounts, create/join one household, confirm both member lists, reject a third account, restart to verify native secure persistence, and sign out. Native secure-storage and share-sheet behavior require device verification. Store release builds and push notifications are future phases.


## Try inventory

1. Sign in and create/join your household, then open Inventory.
2. Add a product with a name and quantity. The default category is Other and unit is piece; optional details let you change them, enter storage/purchase/notes, and set the item reminder flag.
3. Leave expiry blank for Unknown, or enter YYYY-MM-DD and explicitly choose Printed or Estimated. The server calculates urgency from the household calendar; no purchase-based date is invented. Reminder delivery is not implemented yet.
4. Search/filter/sort items. Mark a product consumed or discarded after confirming, then find it under that history filter. History cannot be edited/reactivated in this phase.
5. With two accounts, refresh Inventory on the other device to see changes. To test conflicts, open the same item for editing on both, save one, then save the second: reload the latest details and review before resubmitting. Live updates are phase 5; cached offline results may be stale and mutations require connectivity.

Two-device inventory verification remains outstanding. The automated HTTP tests confirm both accounts operate on the same persisted records, but they do not replace real mobile device acceptance.


## Install/open the mobile app

See [phone installation instructions](docs/mobile-installation.md) for SDK-55-compatible Expo Go on Android, iPhone development builds, LAN API setup, simulators and troubleshooting. No signed installer has been created. Home is now the Phase 3 dashboard; shopping/reminders are still unavailable.
