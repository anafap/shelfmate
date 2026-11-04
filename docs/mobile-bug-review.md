# Mobile bug review — 2026-11-04

Focused source review of authentication/session isolation, route navigation, household setup, inventory editors, shopping transfer, shared invalidation, and reminder preferences. Existing tests were run before changes (118 mobile tests passed). This review does not establish that the project is free of other defects.

## Confirmed findings and fixes

| Priority | Bug and trigger | Correction | Design effect | Commit |
| --- | --- | --- | --- | --- |
| P1 — privacy/session | Sign out while the server is slow or offline: local identity, private screens, caches, and subscriptions remain active until revocation finishes or times out. | Publish the signed-out state immediately, triggering the existing cache clear and subscription cleanup. Preserve persistent revocation retries and final secure-storage cleanup. | Immediate return to sign-in; no layout change. | `c0592d5` |
| P2 — accessibility | On web route changes, keyboard focus can remain on a control in a retained, hidden screen. | Each route has a named main-content region focused on entry and return visits. Cancel queued focus work when the route loses focus. Native rendering uses the existing children directly. | Web focus feedback and an accessible content region; screen composition is preserved. | `419cce4` |
| P2 — setup usability | Household creation requires users to know and type an IANA identifier such as `Asia/Bahrain`. | Searchable city/time-zone picker with readable labels, explicit selection, no-results recovery, and disabled controls during creation. Bundle IANA identifiers for offline/native use and retain device aliases. The API still receives the IANA identifier; the server supplies date/time-zone rules. | Replaces the setup text field with an expandable picker using existing field and action styles. | `d2925f2` |
| P2 — error recovery | Open Add Inventory when the household request fails or no household exists: the disabled category query still reports pending, producing an endless spinner. Request failures incorrectly appear as setup guidance. | Show the actual household error and Retry household. Show category loading only after a household is available; preserve setup guidance for a confirmed missing household. | Uses the existing error card/retry treatment; normal editor layout is preserved. | `320c649` |

## Validation

- `npm test -- --silent`: **19 suites, 126 tests passed**, including delayed sign-out, browser-DOM focus transfer/return visits, time-zone search/selection/aliases, household creation payload, and inventory error/empty-state regressions.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `CI=1 npx expo export --platform all --output-dir dist/bug-review-final`: Android, iOS, and web exports passed.
- `dotnet test backend/ShelfMate.sln --no-restore -m:1`, using the existing `.local/dotnet` runtime, `DOTNET_ROOT`, and configured `SHELFMATE_TEST_CONNECTION`: **61 integration and 13 unit tests passed**, with no skips. The system runtime was too old; the repository-local .NET 10.0.14 runtime completed the run.
- `git diff --check`: passed.
- Ana reported that purchasing a shopping item and transferring it through the separate inventory form worked. Existing automated purchase/transfer tests still pass; the transfer protocol was not changed.

## Limits and next acceptance checks

No production deployment, signed APK replacement, database/API contract change, or dependency installation was performed. Pre-existing uncommitted documentation and app configuration were excluded from the fixes; only the new picker/focus baseline paragraph was staged in `ui-design.md`.

Browser-DOM tests verify focus movement, but a live-browser keyboard/screen-reader walkthrough remains outstanding: Computer Use could not reliably switch into the existing preview. Native visual acceptance also remains outstanding. Next, check Home → Shopping → Inventory → Settings → Back with keyboard navigation and a screen reader, then check the picker and retry states at 320–390-point widths, larger text, and with the keyboard open on Android/iOS. Confirm the picker’s full selected label wraps and saving uses the chosen household time zone.
