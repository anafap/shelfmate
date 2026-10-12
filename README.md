# ShelfMate

Shared household inventory, grocery checklist, and expiry reminders for Android and iOS.

## Current state

Phase 1 implemented: sign-up/sign-in/sign-out, native secure session persistence and token rotation, household creation with an explicit time zone, two-member membership, and owner-managed expiring single-use invitations. Expo Router retains four tabs with household/account settings outside primary navigation. PostgreSQL migrations, real-database integration tests, mobile tests, and CI are included. Inventory, shopping, live sync, and reminders are **not implemented**. Two-device/emulator verification remains outstanding; this is not the complete MVP. No sample household data is displayed.

## Local setup

Prerequisites: .NET 10 SDK, Node 22 LTS, npm, Docker with Compose, and a simulator or compatible Expo Go client.

```sh
cp .env.example .env
# Replace the password in BOTH POSTGRES_PASSWORD and ConnectionStrings__ShelfMate.
docker compose --env-file .env -f infra/compose.yaml up -d --wait
set -a
source .env
set +a
dotnet ef database update --project backend/src/ShelfMate.Infrastructure --startup-project backend/src/ShelfMate.Api
dotnet run --project backend/src/ShelfMate.Api --no-launch-profile --urls http://0.0.0.0:5050
```

Keep the connection string quoted in `.env` so shell loading preserves its semicolons.

In another terminal:

```sh
cd mobile
cp .env.example .env
npm ci
npm start
```

`EXPO_PUBLIC_API_URL` is a public URL, never a secret. Use `http://localhost:5050` for iOS simulator/web, `http://10.0.2.2:5050` for Android emulator, or your computer's LAN IP for a physical phone on the same network. The API binds all interfaces for local device testing; PostgreSQL stays on loopback. Restart Expo after changing its environment. HTTP is for local development; production requires HTTPS.

Sign in or create your account. Home lets you create a household or enter an invitation code. Open Account & household settings to generate/share or revoke a code; your partner signs in with a separate account and joins from Home. Confirm the proposed IANA time zone at household creation. Household changes can be refreshed manually; live sync comes in phase 5. Network errors offer retry, and expired sessions return to sign-in. Native sessions persist in SecureStore; web development sessions are memory-only.

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
npx expo export --platform web
```

Database smoke check while the API is running:

```sh
curl --fail http://localhost:5050/api/v1/health/live
curl --fail http://localhost:5050/api/v1/health/ready
```

`docker compose --env-file .env -f infra/compose.yaml stop` preserves local data. Integration tests replace database availability for deterministic HTTP assertions and also check missing configuration. CI starts real PostgreSQL and verifies API readiness separately. Phase 1 includes an explicit account/household migration. Install the EF CLI with `dotnet tool install --global dotnet-ef --version 10.0.10`. Account integration tests require `SHELFMATE_TEST_CONNECTION` with CREATE DATABASE permission; they create and remove isolated test databases.

## Architecture and next milestone

See [architecture](docs/architecture.md), [API](docs/api.md), [decisions](docs/decisions.md), and [implementation contract](AGENTS.md).

Next: phase 2, categories, inventory CRUD, lifecycle transitions and household-local expiry rules. Subsequent milestones and future work are in AGENTS.md.

Phase 1 automated verification: 10 backend tests (health plus account/household HTTP flows using migrated isolated PostgreSQL databases) and 9 mobile tests. These cover two-account membership, rejected third member, outsider access, owner restrictions, invitation replay/revocation/expiry/email binding, concurrent redemption, token rotation/replay/expiry/logout, account forms, onboarding, revocation confirmation, and network retry behavior. Type checking, lint, C# formatting and Expo web/iOS/Android bundle exports pass. Native bundle exports are not signed release builds or device tests. npm currently reports dependency vulnerabilities; dependency audit/remediation remains release-hardening work.

Manual device acceptance remains: run on two phones/emulators, create distinct accounts, create/join one household, confirm both member lists, reject a third account, restart to verify native secure persistence, and sign out. Native secure-storage and share-sheet behavior require device verification. Store release builds and push notifications are future phases.
