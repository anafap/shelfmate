# ShelfMate — AI Coding Agent Instructions

> Project: ShelfMate — a shared household inventory, grocery checklist, and product-expiry tracking mobile app.
>
> This file is the implementation contract for coding agents working in this repository. Read it before making changes. If the repository already contains code, inspect it first and preserve working behavior. Implement incrementally; do not claim an unbuilt feature is complete.

## 1. Product mission

Build a polished Android/iOS application that lets two people manage the same household inventory so they know:

1. What products are currently at home?
2. What should they use first because its expiry date is approaching?
3. What must they buy next?

**Product name:** ShelfMate. **MVP audience:** a household shared by two adults. Design membership and data relationships so a future release can support more members, but enforce a maximum of two active members in the MVP. Each person has their own account; never share login credentials.

A spreadsheet-like experience is not the goal: common actions must be fast, understandable, and mobile-first. Prefer clarity and reliability over an elaborate interface or speculative AI features.

## 2. Authoritative MVP scope

Build these end-to-end before adding stretch features:

- Sign up, sign in, sign out, and authenticated session management.
- Create a household and invite one other person using a secure, expiring, single-use invitation.
- Both members can see and edit the same household inventory and shopping list; changes must be reflected across devices.
- Add, edit, search, filter, and archive inventory items with category, quantity, unit, optional purchase date, optional expiry date, storage location, and optional notes.
- Clearly display inventory items as **Active**, **Consumed**, or **Discarded**. An active item's **Expired / Expiring Soon / OK / Unknown** label is _computed_ from its expiry date, household-local current date, and alert thresholds; it is not a separately editable life-cycle status.
- Organize items by category: Fruits, Vegetables, Dairy, Meat & Poultry, Seafood, Frozen Food, Pantry & Canned, Bakery, Beverages, Medicines, Household Essentials, and Other. Categories are extensible.
- Home dashboard: active product count, items expiring soon, items reaching expiry today/past date, shopping list count, and **Use First** sorted by nearest expiry.
- Shared shopping checklist: add, edit, check/uncheck, and remove items; show who marked an item purchased and when.
- When an item is checked as purchased, **offer** to transfer it into inventory. Ask for quantity and expiry date as applicable; do not silently duplicate an existing inventory item. The purchase action and transfer are distinct and retry-safe.
- Configurable in-app and push reminder preferences, with defaults at 7, 3, and 1 day(s) before expiry and on the expiry date. Users can opt out of push, mute categories, and disable individual-item reminders.
- Mark items consumed/discarded; stop future notifications for these items without deleting useful history.
- Loading, empty, offline/network-error, confirmation, and permission-denied states.

**Out of MVP:** barcode lookup, receipt OCR, AI product recognition, recipe recommendations, nutritional claims, predictive freshness models, complex analytics, payments, and public social features. Record them in a future-work section instead of implementing them prematurely.

## 3. Technology and architecture

Preferred stack (do not swap it without documenting the trade-off):

| Layer             | Choice                                                          | Role                                                               |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Mobile            | React Native + Expo + TypeScript                                | Single Android/iOS codebase                                        |
| Mobile data       | TanStack Query                                                  | Server-state fetching, cache invalidation and refetch              |
| Mobile navigation | Expo Router                                                     | Typed screen navigation                                            |
| Backend           | ASP.NET Core Web API (.NET 8 or later supported LTS) + C#       | Domain rules and authenticated API                                 |
| Database          | PostgreSQL + EF Core + Npgsql                                   | Durable multi-user persistence and migrations                      |
| Live update       | SignalR                                                         | Notify other active household clients to refetch changed resources |
| Reminders         | Server-side scheduled worker + Expo push notifications          | Reliable reminders independent of app being open                   |
| Testing           | xUnit for backend; Jest/React Native Testing Library for mobile | Automated validation                                               |
| Local environment | Docker Compose for PostgreSQL                                   | Reproducible development                                           |

Architecture guideline: separate `Api`, `Application`, `Domain`, and `Infrastructure` responsibilities pragmatically. Controllers should remain thin; authorization, expiry calculations, invitation rules, and purchase/transfer decisions belong in tested services/domain logic. Do not create gratuitous abstractions just to imitate Clean Architecture.

Suggested repository layout (adapt to an existing repository rather than overwriting it):

```text
shelfmate/
  AGENTS.md
  README.md
  .env.example
  .gitignore
  mobile/
    app/                 # Expo Router screens
    src/
      components/
      features/          # auth, household, inventory, shopping, alerts
      lib/               # typed API client and query setup
      theme/
    __tests__/
  backend/
    ShelfMate.sln
    src/
      ShelfMate.Api/
      ShelfMate.Application/
      ShelfMate.Domain/
      ShelfMate.Infrastructure/
    tests/
      ShelfMate.UnitTests/
      ShelfMate.IntegrationTests/
  infra/
    compose.yaml
  docs/
    architecture.md
    api.md
    decisions.md
```

## 4. Data model

Use stable UUID identifiers, UTC timestamps for events/audit fields, and date-only values for printed product expiry dates.

| Entity                   | Essential fields / behavior                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                   | `Id`, display name, normalized unique email, password hash / chosen auth provider ID, created/updated timestamps                                                                                                                                                             |
| `Household`              | `Id`, name, owner user ID, IANA time zone (default chosen explicitly at creation), created timestamp                                                                                                                                                                         |
| `HouseholdMember`        | `Id`, household ID, user ID, role (`Owner`/`Member`), join time; unique pair; max two active members for MVP                                                                                                                                                                 |
| `HouseholdInvite`        | `Id`, household ID, hashed random invite token, created by, expiry time, redeemed-at, optional invited email                                                                                                                                                                 |
| `Category`               | `Id`, name, icon/key, optional system-defined flag                                                                                                                                                                                                                           |
| `InventoryItem`          | `Id`, household ID, name, category ID, quantity (>0), unit, purchase date nullable, expiry date nullable, expiry type (`Printed`/`Estimated`/`Unknown`), storage location, notes, lifecycle status, reminder enabled, created/updated by and timestamps, concurrency version |
| `ShoppingItem`           | `Id`, household ID, name, optional category/quantity/unit/notes, status (`ToBuy`/`Purchased`), created by, purchased by/time nullable, linked inventory item ID nullable, timestamps, concurrency version                                                                    |
| `NotificationPreference` | User ID, household ID, push enabled, selected day offsets, muted categories, preferred local delivery time                                                                                                                                                                   |
| `PushDevice`             | User ID, Expo push token, platform, last-seen time, invalidation timestamp                                                                                                                                                                                                   |
| `NotificationLog`        | User ID, inventory item ID, expiry date snapshot, reminder offset/kind, send attempt/status and timestamp; unique deduplication key                                                                                                                                          |

All household-owned records must carry a `HouseholdId`. Enforce relational constraints, unique indexes, check constraints, and migrations. Avoid mixing two households' data. Keep item-history fields needed for audits.

## 5. Precise expiry and notification rules

- A product's expiry is a **calendar date**, not a UTC instant. Compute `daysRemaining = ExpiryDate - CurrentDateInHouseholdTimeZone` using date arithmetic, not elapsed 24-hour periods.
- `daysRemaining < 0`: date has passed; `0`: expiry date is today; `1..threshold`: expiring soon; `> threshold`: OK. Missing expiry date: Unknown, and no automated expiry notification.
- Default thresholds: `7`, `3`, `1`, and `0` days. Give users control over their reminder settings; do not imply every category shares an objectively known freshness period.
- Date-only expiration and _estimated freshness_ must be visually distinct. For loose produce without printed dates, an optional suggested freshness date must be explicitly marked **Estimated**, editable, and never portrayed as a verified food-safety deadline.
- Do not invent an expiry date from purchase date unless the user explicitly accepts an estimated suggestion.
- Notification text should prompt users to **review** items, not assert that food is necessarily safe or unsafe solely from a date. Medicines may warrant separate explanatory language; do not provide medical guidance.
- The server schedules reminders for eligible **Active** items, only for subscribed members. Check notification preferences at dispatch time; respect the household time zone and each member's preferred local alert time.
- On expiry-date edits, rescheduling must use the updated date. Deduplicate sends by user + item + expiry date snapshot + reminder kind/offset. A retry must not produce duplicate messages.
- Marking an item Consumed/Discarded, or disabling reminders, cancels/skips pending alerts. Handle permission denial or invalid Expo tokens gracefully. Provide an in-app alert list as a fallback.
- Notification delivery may be delayed or unavailable due to device/platform settings; never promise guaranteed exact-time push delivery.

## 6. Shared-household rules and access control

- The authenticated user may access a household resource only if they are a current member of that household. Enforce this **on the server on every read, write, export, hub subscription, and notification lookup**; hiding UI actions is not sufficient.
- Only an Owner can generate/revoke invitations or manage the household. An invite is cryptographically random, expires (suggested default: 7 days), is single-use, and is stored hashed; enforce household capacity transactionally when redeemed.
- No cross-household data leakage through IDs, filters, real-time events, cached queries, or logs. Never accept a client-provided user ID as proof of authority.
- Prefer JWT access tokens with secure refresh-token rotation/revocation if implementing authentication in-house. Store mobile credentials/tokens only in secure OS-backed storage; never hardcode secrets or commit credentials.
- The final Owner cannot leave or delete their membership without explicitly transferring ownership or deleting the household. Prevent accidental deletion of shared data.
- SignalR broadcasts an authenticated, household-scoped **resource-changed event**; clients refetch authoritative records. It must not broadcast across households.
- Resolve simultaneous edits with a documented optimistic-concurrency strategy and understandable conflict feedback (e.g., record version check). Do not silently overwrite another member's changes.

## 7. Suggested HTTP API contract

Use `/api/v1` routes, DTO validation, consistent problem details, pagination where necessary, and conventional HTTP statuses. Refine route shapes in `docs/api.md` as implementation proceeds.

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/me

POST   /api/v1/households
GET    /api/v1/households/current
GET    /api/v1/households/current/members
POST   /api/v1/households/current/invites
POST   /api/v1/household-invites/redeem
DELETE /api/v1/households/current/invites/{id}

GET    /api/v1/households/current/categories
GET    /api/v1/households/current/dashboard
GET    /api/v1/households/current/inventory?category=&status=&search=&sort=
POST   /api/v1/households/current/inventory
GET    /api/v1/households/current/inventory/{id}
PATCH  /api/v1/households/current/inventory/{id}
POST   /api/v1/households/current/inventory/{id}/consume
POST   /api/v1/households/current/inventory/{id}/discard

GET    /api/v1/households/current/shopping-items
POST   /api/v1/households/current/shopping-items
PATCH  /api/v1/households/current/shopping-items/{id}
DELETE /api/v1/households/current/shopping-items/{id}
POST   /api/v1/households/current/shopping-items/{id}/purchase
POST   /api/v1/households/current/shopping-items/{id}/transfer-to-inventory

GET    /api/v1/households/current/alerts
GET    /api/v1/me/notification-preferences
PUT    /api/v1/me/notification-preferences
POST   /api/v1/me/push-devices
DELETE /api/v1/me/push-devices/{id}

HUB    /hubs/household
```

State-changing purchase and transfer operations must be retry-safe. Transfer must not create a second inventory record when a response is lost and the client retries. Require an idempotency key or implement an equivalent database-enforced uniqueness mechanism. Treat archive/consume/discard transitions explicitly, rather than hard-deleting data by default.

## 8. Mobile UX specification

Primary navigation has **four tabs**:

1. **Home** — household summary, urgent expiry items, and the nearest-expiry **Use First** section.
2. **Inventory** — searchable category filters, clear item cards, quantity, date/estimated-date labels, add/edit and consume/discard actions.
3. **Shopping** — simple shared checklist, quick add, purchaser indication, and purchase-to-inventory handoff.
4. **Alerts** — in-app expiry reminders and access to notification preferences.

Place invitations, membership management, and account settings under profile/settings rather than adding permanent navigation tabs. Use accessible text and icons in addition to color for urgency states. Support dynamic text, sufficient contrast, tap targets, and confirmation for destructive operations. Use friendly, neutral copy and minimize forms: product name and quantity can be entered quickly; optional fields should not impede common flows.

Important states to design: brand-new household, awaiting invited member, zero inventory, unknown expiry, no alerts, push permission denied, connectivity loss, concurrent update conflict, failed invitation, and transfer already completed. Never show made-up production counts or claim live sync when disconnected.

## 9. Quality, security, and observability

- Validate all input on the backend: trimmed nonempty product names, positive quantities, known units/categories, valid status transitions, allowed date ranges, and bounded note lengths.
- Hash passwords with an established, maintained library; use HTTPS, secrets via environment variables, rate limiting for authentication and invite redemption, and avoid logging tokens or sensitive account details.
- Add centralized exception handling and structured logs with correlation IDs. Return useful client-safe errors; never expose stack traces to users.
- Write EF Core migrations; do not rely on production schema auto-creation. Seed only category reference data and explicit development fixtures.
- Keep storage and network integrations behind interfaces for tests. Use test clocks to make date and time-zone scenarios deterministic.
- On household switching or logout, clear household-scoped client caches and subscriptions to prevent stale private data display.
- Format and lint TypeScript/C#; keep build and tests passing after each milestone. Include an `.env.example` without real secrets and a README with setup, run, test, and architecture commands.

## 10. Required automated tests

Prioritize these cases:

- Expiry calculations for yesterday/today/tomorrow, threshold boundaries, leap day, date-only behavior, and household time zones.
- Printed vs estimated vs unknown expiry; no reminder when expiry is missing.
- Consumed/discarded products never receive future reminders.
- Changed dates recalculate alerts; retries cannot create duplicate notifications.
- Two members see the same item; an outsider cannot read/write or subscribe to their household.
- Invite expiry, replay, revocation, concurrent redemption, and the maximum-two-member limit.
- Concurrent item updates return a conflict, not silent data loss.
- Purchased shopping item transfer creates one inventory item even with repeated requests.
- Dashboard counts exclude consumed/discarded items and Use First sorts by nearest non-null expiry.
- Push notifications denied/invalid token: app remains usable and in-app alerts remain accessible.
- Mobile tests for quick-add inventory, shopping checklist toggling, empty states, and purchase-to-inventory flow.

## 11. Implementation order and definition of done

Work in vertical slices and demonstrate each slice running through API + database + mobile. Suggested sequence:

| Phase | Deliverable                                                              | Completion evidence                                                         |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 0     | Repository scaffold, Docker database, configuration, CI, README          | Fresh clone starts locally; smoke tests pass                                |
| 1     | Auth and household creation/invitation                                   | Two distinct accounts join one household; third cannot join MVP household   |
| 2     | Categories, inventory CRUD, lifecycle and expiry rules                   | Members can manage the same inventory; calculations pass unit tests         |
| 3     | Home and Use First dashboard                                             | Correct counts and expiry ordering, including empty state                   |
| 4     | Shared shopping checklist and purchase transfer                          | Changes sync; repeated transfer creates no duplicate                        |
| 5     | SignalR changes + mobile cache invalidation                              | Updating device A becomes visible on device B without manually restarting   |
| 6     | In-app alerts, preferences, scheduled reminders, push integration        | Server tests cover scheduling and deduplication; device permissions handled |
| 7     | Accessibility, validation, error flows, integration tests, release build | All MVP acceptance checks pass and README reflects reality                  |

An MVP is **done** only when two separate accounts on two devices/emulators can add/edit products and shopping items in one household, view consistent expiry information, receive configured eligible alerts when notifications are permitted, and complete the shopping-to-inventory flow safely. A static mockup, local-only list, or untested notification button does **not** qualify.

## 12. Instructions for any coding agent

1. Start by inspecting the repository; report the existing structure and the smallest useful next milestone. Do not re-scaffold or delete user work without need.
2. Implement one vertical slice at a time. For each slice, include data changes, validation, API, mobile UI, and relevant tests where applicable.
3. Keep business logic in testable backend services; avoid duplicating expiry formulas across app screens.
4. Before editing a database schema or API contract, update the corresponding migration/DTO and documentation; keep existing behavior backward-compatible where practical.
5. Use realistic sample data **only** in explicitly marked development seeds, tests, or illustrative screenshots. Never present sample data as a live household.
6. Do not fabricate barcode data, freshness durations, push-delivery guarantees, deployment state, or test results.
7. Run the relevant formatter, build, and tests where tools are available. If something cannot be run, state exactly what remains unverified and why.
8. When finishing a task, summarize files changed, user-visible behavior, commands run and results, known limitations, and the recommended next actionable task.
9. Ask a question only when a missing choice blocks correct implementation; otherwise use the defaults defined here and record noteworthy choices in `docs/decisions.md`.
10. Keep MVP scope disciplined. Suggest phase-2 enhancements separately rather than silently expanding the feature set.

## 13. Future ideas (not current acceptance criteria)

- Barcode scanning/product metadata lookup (with manual fallback).
- Receipt OCR with explicit review before adding detected items.
- Multi-household or more-than-two-member tiers.
- Recurring shopping reminders and stock-low prompts.
- Waste/consumption insights and simple trends.
- Recipe suggestions based on Use First, with no unsupported safety claims.
- Offline mutation queue with well-defined reconciliation and conflict behavior.
- Localization and home-screen widgets.

**Guiding principle:** ShelfMate should make the correct household state visible to both people, minimize duplicate entry, and help them notice products approaching an entered or clearly marked estimated date.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

LLMs often pick an interpretation silently and run with it. This principle forces explicit reasoning:

State assumptions explicitly — If uncertain, ask rather than guess
Present multiple interpretations — Don't pick silently when ambiguity exists
Push back when warranted — If a simpler approach exists, say so
Stop when confused — Name what's unclear and ask for clarification 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

Combat the tendency toward overengineering:

No features beyond what was asked
No abstractions for single-use code
No "flexibility" or "configurability" that wasn't requested
No error handling for impossible scenarios
If 200 lines could be 50, rewrite it
The test: Would a senior engineer say this is overcomplicated? If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting
Don't refactor things that aren't broken
Match existing style, even if you'd do it differently
If you notice unrelated dead code, mention it — don't delete it
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused
Don't remove pre-existing dead code unless asked
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform imperative tasks into verifiable goals:

Instead of... Transform to...
"Add validation" "Write tests for invalid inputs, then make them pass"
"Fix the bug" "Write a test that reproduces it, then make it pass"
"Refactor X" "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let the LLM loop independently. Weak criteria ("make it work") require constant clarification.

addess me as Ana
