# ShelfMate UI baseline

Home and Inventory retain their current composition, cards, filters, navigation, and floating add actions. Changes there are limited to demonstrated readability, accessibility, and date-copy defects. Do not recreate illustrative product photography or add unsupported controls from design references.

Other screens use the same pale green background, white surfaces, dark green text, restrained borders, and semantic expiry colors. Shared tokens live in `mobile/src/theme/tokens.ts`. Use 4/8/12/16/24 spacing, compact titles, and 48-point touch targets. Let content wrap at larger text sizes; urgency must include words alongside color.

Delivery slices: baseline fixes; inventory forms and shopping transfer; Alerts and dedicated preferences; grouped settings; focused authentication and household setup. Preserve existing APIs, cache invalidation, conflict handling, retry safety, and unrelated work. Each slice is checked and committed separately.

Baseline validation: 87 mobile tests passed. No Android device was attached at implementation start; no fresh native baseline capture was possible. Saved references in `docs/screenshots` are illustrative, not evidence of the running app. Native visual and large-text verification remains a release check.

## Implemented behavior

- Home and Inventory retain their screen composition. Product metadata wraps, secondary item text is more readable, and date-only values display as local-friendly calendar dates. The shared expiry-copy formatter distinguishes estimated dates in Home, Inventory, editors, and Alerts without recalculating server urgency.
- Add and edit inventory share the newer editor treatment. New-item optional details stay collapsed. Shopping retains its checklist, floating add button, and purchase history; transfer opens in a keyboard-aware sheet with existing duplicate review and transactional API behavior.
- Alerts focuses on reviewable items. `/reminder-preferences` is a hidden navigation route, opened from Alerts or Settings with a `from` parameter limited to those return destinations. The editor retains custom offsets, category muting, household-local time, explicit save/cancel, and permission-denied feedback.
- Settings separates account, household, member roles, owner-only invitations, and sign-out. Authentication uses concise headings and a full-width primary action. Household setup reveals only the chosen Create or Join form and preserves drafts when returning to the choices.
- No backend, database, authentication protocol, membership policy, or API contract changed.

## Verification — 2026-10-20

- Baseline: 13 mobile suites / 87 tests passed.
- Final: `npm run lint`, `npm run typecheck`, and `npm test -- --silent` passed; 15 suites / 96 tests.
- `CI=1 npx expo export --platform all --output-dir dist/ui-review` succeeded for iOS, Android, and web, including the new reminder route. This validates bundling; it is not a signed release build or device acceptance test.
- New/updated interaction coverage includes estimated-date copy, transfer cancellation and duplicate review, reminder navigation/cancel, failed-save draft retention, permission denial, non-owner settings, and focused setup with draft preservation.
- Android device discovery returned no attached devices. No browser connector was available; native Safari computer access was not approved. No fresh screenshots were captured, and no visual/device acceptance claim is made.

## Remaining acceptance checks

On Android and iOS, review 320–390-point widths, larger system text, long product/household names, screen-reader order, keyboard-open forms, and bottom safe areas. Compare Home and Inventory with the accepted baseline; verify that the same sections and actions remain. Exercise Shopping transfer from a long list, existing-product links, preference save/cancel from both entry points, invitation errors/revocation, disconnected/stale data, and inventory conflict recovery. Build a signed device release after these checks. Backend and two-device live-sync/push acceptance were not rerun for this UI-only change.
