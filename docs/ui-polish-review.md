# UI polish review — 2026-11-04

Reviewed navigation, Home, Inventory, add/edit forms, Shopping and its sheets, Alerts, reminder preferences, authentication, household setup/settings, shared headers, screen frames, and date/time controls. This is a source review with limited rendered verification, not full device acceptance.

## Corrections

| Area | Finding | Change |
| --- | --- | --- |
| Floating add action | Platform icon-font metrics can shift the visible plus inside an otherwise centered button. | Draw two centered strokes; rotate them for Close. Use the shared primary green and pressed feedback. Accessible labels, menu dismissal and placement stay intact. |
| Home | A 300-point flex basis applied to the vertical phone list, making compact cards unnecessarily tall. | Apply the basis only to the horizontal wide layout. |
| Home | Product names and expiry badges compete on narrow cards; helper text is only 11 points. | Put the name on its own line, allow badge text to shrink/wrap, increase helpers to 13/18. View-all targets are 48 points. |
| Household header | The household name can collapse to a tiny chip beside member/sync/refresh controls. | Give the chip a useful basis/minimum width so the wrapping row can move other controls below. |
| Inventory | Three action buttons are forced into one row; metadata is small. | Allow action wrapping with a minimum button width; use 13-point metadata and action copy. Let the page title shrink beside its count. |
| Shopping | Headings and quantity/name rows compete for horizontal room; purchase labels are 11 points. | Constrain headings to available width, allow name/quantity wrapping, use 13-point shared muted labels. |
| Shared actions | Wrapped labels inherit left text alignment. | Center multiline action labels. |

Existing tokens, FoundationScreen, PageHeader, shared form controls and four-tab navigation remain the visual baseline. No API, data, expiry computation, purchase/transfer or invitation policy changes.

## Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test -- --silent`: 17 suites, 118 tests passed.
- `git diff --check`: passed.
- Expo SDK 57 Symbols documentation and installed implementation inspected before replacing the FAB glyph.
- Started Expo web preview at http://localhost:8091. Visually inspected sign-in and account creation in desktop Chrome. No account was created or submitted.
- Household screens require a signed-in test session; a request to sign in was presented to Ana. No authenticated rendered review or native-device review is claimed.

## Next acceptance pass

Inspect all four tabs with real test inventory at 320–390-point widths, large system text, long names, and bottom safe areas. Verify add/close alignment in both states on Android and iOS. Exercise keyboard-open editors and shopping transfer, date/time dialogs, filter dropdown visibility, offline/conflict feedback, and screen-reader focus after opening/dismissing sheets. Check notification-denied and invitation-error states with a test household. The web shopping removal confirmation uses React Native Alert and needs browser verification before claiming web feature parity.

These checks remain open; passing interaction tests does not establish a perfect UI.

## Signed-in responsive review follow-up

Inspected the real empty household Home in desktop Chrome and at a 390 × 844 responsive viewport. The plus is visibly centered; the add menu opens above the button with a centered close icon. Home counts, empty state and shopping summary remain readable at phone width.

The Inventory preview exposed a web-specific defect: category choices were a vertical stack because the non-horizontal ScrollView content had wrapping without row direction. Added explicit row direction to Choices and made Inventory categories a horizontal strip on web as on native, keeping search, status/sort and results accessible without scrolling past all categories. The preview reload cleared the test session; authenticated post-fix verification and remaining tabs await sign-in. This is browser responsive inspection, not native-device acceptance.
