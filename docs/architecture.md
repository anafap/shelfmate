# Architecture

The Expo Router mobile app uses TanStack Query for an API readiness check. Its four tabs are clearly labeled foundation screens; they contain no household fixtures or fabricated counts.

The ASP.NET Core API delegates PostgreSQL readiness to Infrastructure. Application defines the database availability boundary. Domain is reserved for subsequent business rules. Infrastructure configures EF Core with Npgsql. No domain tables or automatic schema creation exist yet.

Planned: secure authentication, household authorization on every operation, UUID keys, UTC audit timestamps, date-only expiry calculations, version-checked mutations, household-scoped SignalR invalidation, and server-side reminder dispatch. These are not implemented in phase 0.
