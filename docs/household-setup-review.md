# Create Household redesign — 2026-11-12

## Audit

Reviewed all three supplied Android references: `screenshots/CreateHousehold.jpg`, `screenshots/CreateHousehold1.jpg`, and `screenshots/createhousehold3.jpg`.

- `TimeZonePicker.tsx` inserted search, result count, framed rows, pagination and close controls into the parent form. Loading more results kept increasing page height.
- `HouseholdScreen.tsx` repeated its heading inside the card, displayed the raw IANA identifier below its location label, and gave the return action a competing button treatment.
- `_layout.tsx` mounted the household header and all tabs for every authenticated account, before membership was established.

## Adopted flow

Setup is mandatory before household navigation. A compact ShelfMate wordmark, one page heading and concise explanation precede the two-field form. Existing `FoundationScreen`, `PageHeader`, `Field`, `Action`, control styles, colors and spacing tokens provide the framing. The primary action remains full-width; returning to Create/Join choices is a 48-point text action. Drafts survive switching between those choices. A quiet Sign out action remains on the choices screen so mandatory setup never traps an account. Android Back returns to the choices and is blocked during submission.

The time-zone trigger opens a full-screen native modal selector. Search stays above a separately scrolling `FlatList`; results are compact rows with a visible selected check and accessibility state. Android Back, header Back and accessibility escape dismiss without a change. Choosing a result updates the form and dismisses the selector. Opening does not focus search automatically, so users can browse before opening the keyboard. Keyboard avoidance, safe areas and taps while typing are supported.

Country associations come from public-domain IANA tzdb 2026d `zone.tab`, matching the existing bundled zone list. Bundled English country names use `Intl.DisplayNames`, so searches such as United Kingdom and South Korea use their familiar full names. Search accepts city, country, IANA identifier, spaces, underscores, mixed case and unaccented text. All 419 existing choices remain; valid device aliases remain selectable. The form shows a friendly location only. The submitted value is the original IANA identifier, never a UTC offset. Existing backend validation, persistence and time-zone/DST calculations are unchanged. The device zone is proposed only in the unsaved draft; saved household settings remain authoritative.

Whitespace-only names produce inline feedback. Names are trimmed before submission. A synchronous guard covers button and keyboard submission, in addition to pending disabled controls. The existing server transaction/user lock prevents a second household for one account. Pending copy and a spinner show saving; failed requests retain entered values and offer retry. Membership refresh unlocks the four tabs and routes new members to Home, including when they entered through a household-dependent deep link. Joining, invitation management and authentication APIs remain unchanged.

## Modified source and tests

- `mobile/src/app/_layout.tsx`: focused setup gate and Home transition.
- `mobile/src/features/auth/HouseholdScreen.tsx`: form hierarchy, validation, submission guard, back handling and keyboard framing.
- `mobile/src/components/TimeZonePicker.tsx`: full-screen searchable selector and virtualized rows.
- `mobile/src/lib/timeZones.ts`, `timeZoneCountries.json`: friendly labels and complete country search metadata.
- `mobile/__tests__/household.test.tsx`, `time-zone-picker.test.tsx`, `household-navigation.test.tsx`: workflow, search, dismissal, selected values, validation, retry and navigation regression coverage.
- `docs/ui-design.md`, `docs/decisions.md`: adopted setup baseline and implementation choice.

## Verification

- `npm run lint` and `npm run typecheck`: passed.
- `npm test -- --silent`: 20 suites / 131 tests passed. Regression coverage includes whitespace validation, trimming, synchronous duplicate-submit protection, pending controls, failed-save retry and retained drafts, selected IANA submission, country/city/IANA search, no-result recovery, device aliases, dismissal, complete metadata coverage, setup deep-link gating and navigation to Home. Existing joining and invitation tests pass. An account without a household can still sign out from the choices screen.
- `dotnet test backend/tests/ShelfMate.UnitTests --no-restore --verbosity quiet`: 13 tests passed, including household-local calendar dates and daylight-saving transitions. The test runner required local socket access outside the filesystem sandbox.
- `CI=1 npx expo export --platform all --output-dir dist/household-setup`: Android, iOS and web exports passed.
- `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a`: passed with the installed SDK and existing signing configuration. `apksigner verify --verbose` verified the QA APK. Existing Gradle/dependency deprecation warnings remain; no dependency or native source edits were made.
- The emulator-only QA APK is `.local/artifacts/ShelfMate-setup-qa.apk`, using `http://10.0.2.2:5057`. Local HTTP was enabled through the existing opt-in config plugin. The existing internal APK was not replaced. This QA artifact is not a physical-phone or production distribution build.

### Android runtime checks

Reviewed the actual signed app on a temporary Android 14 / API 34 Pixel 4a emulator. Tested 360dp width at normal text size and 320dp width at 130% system text size (1080×2340 framebuffer, density 480/540 respectively).

- Account access: the review account signed out successfully from the household choices screen without creating a household.
- Default form: one heading; no tabs, settings or refresh controls; both fields and actions fit at the reviewed sizes.
- Open selector: separate full-screen content, selected row, safe-area clearance and dark status-bar icons. Country and IANA searches show the expected result above the keyboard; selection dismisses and updates the form.
- Scrolling: result rows scroll independently while the search header remains visible. Larger text wraps long country labels without horizontal overflow.
- Keyboard: the form scrolls so its full primary action can be reached above the keyboard. The selector keeps results above the keyboard and accepts selection while it is open.
- Back/dismissal: Android Back dismisses without changing the zone. Returning to Create/Join choices and reopening Create retains the name and chosen zone.
- Recoverable failure: stopped the local QA API, submitted the form, observed the connection error with both fields retained, restarted the API and successfully retried.
- Real persistence: created `QA home` with `Europe/London` through the Android UI. A fresh authenticated API read returned that name and identifier. An additional create request returned HTTP 409 and the household ID stayed unchanged. Force-stopping and reopening the app returned to the same household's Home; Settings continued to show `Europe/London`, although the device proposed Bahrain during setup.

The screenshots contain explicitly local QA accounts/household data, not production fixtures or fabricated counts. The first QA account has a household; the separate review account was used for first-open and error captures.

### Remaining release checks

No physical Android/iOS devices or TalkBack session were exercised. The pre-existing Android 16 emulator became unresponsive during display testing, so that OS version is not visually verified by this record. Physical-device, Android 16 and iOS accessibility acceptance remain release checks; the Android 14 captures are not evidence for those platforms. No live push or multi-device synchronization acceptance was rerun for this setup-only change.

See [the Android capture index](screenshots/household-setup/README.md).
