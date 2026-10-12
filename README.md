# ShelfMate

Shared household inventory, grocery checklist, and expiry reminders for Android and iOS.

## Current state

Phases 1–6 are implemented: separate accounts and two-member households, shared inventory and expiry dashboard, shared shopping with retry-safe purchase transfer, authenticated household live updates, and in-app alerts plus scheduled Expo push dispatch. Backend and mobile automated checks pass. A locally signed Android internal APK has been built and signature-verified. Two-phone acceptance remains outstanding; this is not yet a public store release. Push delivery needs an Expo project and Android Firebase credentials. No sample household data is displayed.

## Local setup

Prerequisites: .NET 10 SDK, Node 22 LTS, npm, Docker with Compose, and a simulator or Expo Go for SDK 57. Install the EF migration CLI before setup: `dotnet tool install --global dotnet-ef --version 10.0.10`.

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

Sign in or create your account. Home lets you create a household or enter an invitation code during onboarding, then shows your household dashboard. Open Account & household settings to generate/share or revoke a code; your partner signs in with a separate account and joins from Home. Confirm the proposed IANA time zone at household creation. Household writes trigger live refetches on connected devices. Network errors offer retry, and expired sessions return to sign-in. Native sessions persist in SecureStore; web development sessions are memory-only.

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

Next milestone: install the signed APK on two Android phones and verify separate accounts, invitation, shared inventory/shopping changes, transfer, and reminder behavior. Then close release-hardening gaps and decide whether the target is private APK distribution or Google Play. The full milestone contract and future work are in AGENTS.md.

Latest recorded automated verification: 58 backend tests and 40 mobile tests pass; mobile typecheck, lint, and Expo Android/iOS/web exports pass. On 2026-10-12, the Android release build completed and `apksigner` verified its signature. The local database migrations were applied for device testing. The APK is ignored local output at `.local/artifacts/ShelfMate-internal.apk`; it is not committed. Physical device behavior is still unverified. The npm dependency audit has unresolved advisories and remains release-hardening work.

Manual device acceptance remains: install the APK on two Android phones, create separate accounts, create/join one household, verify shared inventory and shopping updates and the purchase transfer, verify restart/session persistence, and check the two-member limit. Push delivery needs a configured Expo project and Firebase credentials; in-app alerts remain available. Public release additionally needs production HTTPS hosting, privacy/store materials, and Play Console release setup.


## Try inventory

1. Sign in and create/join your household, then open Inventory.
2. Add a product with a name and quantity. The default category is Other and unit is piece; optional details let you change them, enter storage/purchase/notes, and set the item reminder flag.
3. Leave expiry blank for Unknown, or enter YYYY-MM-DD and explicitly choose Printed or Estimated. The server calculates urgency from the household calendar; no purchase-based date is invented. In-app alerts are available; push delivery requires provider setup.
4. Search/filter/sort items. Mark a product consumed or discarded after confirming, then find it under that history filter. History cannot be edited/reactivated in this phase.
5. With two accounts, live updates refresh household data across devices. To test conflicts, open the same item for editing on both, save one, then save the second: reload the latest details and review before resubmitting. Cached offline results may be stale and mutations require connectivity.

Two-device inventory verification remains outstanding. The automated HTTP tests confirm both accounts operate on the same persisted records, but they do not replace real mobile device acceptance.


## Install/open the mobile app

See [phone installation instructions](docs/mobile-installation.md) for Expo Go, the signed Android APK, LAN API setup, and remaining iOS/store release prerequisites.
