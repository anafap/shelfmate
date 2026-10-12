# API contract

Phase 0 implements only public operational endpoints. No household records exist yet.

- `GET /api/v1/health/live`: 200 `{ "status": "ok" }` when the process is serving.
- `GET /api/v1/health/ready`: 200 `{ "status": "ready" }` after a PostgreSQL connection check; 503 Problem Details when configuration is missing or the database is unreachable. It exposes no connection details.
- Unexpected errors use Problem Details with a server-generated `traceId`. The response header `X-Correlation-ID` identifies the request.

Readiness checks connectivity only, not schema or migration state. There are no tables or migrations in phase 0. Future domain slices must introduce explicit EF migrations before endpoints that depend on them.

Authentication and household routes in AGENTS.md are planned, not implemented.
