# Decisions

- 2026-10-12: Begin with phase 0 because the workspace contains only AGENTS.md. Preserve the existing GitHub license and history.
- Use installed .NET 10 LTS, satisfying the requested .NET 8-or-later supported LTS stack. Reference: https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core
- Use the official Expo SDK 55 template and its compatible React Native versions; retain its `src/app` route location. Reference: https://docs.expo.dev/versions/v55.0.0/
- Local PostgreSQL 17 runs through Docker Compose, bound to loopback. Local passwords belong in ignored .env files.
- Phase 0 has no domain schema, therefore no artificial empty migration. Add EF migrations with the auth/household slice.
- Use first-party operational checks without authentication; expose only availability. Production requires HTTPS. HTTP instructions are for local development.
- Future work remains as listed in AGENTS.md: barcode lookup, OCR, recipes, analytics, offline mutation queue, localization, and widgets.
- Use host port 5433 by default because 5432 is occupied on this workstation; configure POSTGRES_PORT and connection string together. CI uses its isolated service port 5432.
