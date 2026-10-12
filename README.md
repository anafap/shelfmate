# ShelfMate

Shared household inventory, grocery checklist, and expiry reminders for Android and iOS.

## Current state

Phase 0 foundation: Expo Router with four development screens and a TanStack Query connection check, .NET 10 API, PostgreSQL readiness, Docker Compose, integration smoke tests, and GitHub Actions. Authentication, household membership, inventory, shopping, live sync, and reminders are **not implemented**. No sample household data is displayed.

## Local setup

Prerequisites: .NET 10 SDK, Node 22 LTS, npm, Docker with Compose, and a simulator or compatible Expo Go client.

```sh
cp .env.example .env
# Replace the password in BOTH POSTGRES_PASSWORD and ConnectionStrings__ShelfMate.
docker compose --env-file .env -f infra/compose.yaml up -d --wait
set -a
source .env
set +a
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

Open Home to check server/database availability. A connection failure offers retry. Tab screens explicitly show that household features are pending.

## Verification

```sh
dotnet build backend/ShelfMate.sln
dotnet test backend/ShelfMate.sln
dotnet format backend/ShelfMate.sln --verify-no-changes
cd mobile
npm run typecheck
npm run lint
npx expo export --platform web
```

Database smoke check while the API is running:

```sh
curl --fail http://localhost:5050/api/v1/health/live
curl --fail http://localhost:5050/api/v1/health/ready
```

`docker compose --env-file .env -f infra/compose.yaml stop` preserves local data. Integration tests replace database availability for deterministic HTTP assertions and also check missing configuration. CI starts real PostgreSQL and verifies API readiness separately. No domain schema exists yet; introduce explicit EF migrations with the next slice rather than using automatic schema creation.

## Architecture and next milestone

See [architecture](docs/architecture.md), [API](docs/api.md), [decisions](docs/decisions.md), and [implementation contract](AGENTS.md).

Next: phase 1, secure sign-up/sign-in/session rotation plus household creation and expiring single-use invitations, tested with two members and a rejected third member. Subsequent milestones and future work are in AGENTS.md.
