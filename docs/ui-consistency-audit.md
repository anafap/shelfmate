# UI consistency audit — 2026-11-04

Ana requested the same UI language as Home across all screens and a list of missing areas. This audit covers every current route, unauthenticated entry, inline product details, and Shopping sheets. Findings below are from source inspection; no fresh rendered screen or device acceptance is claimed.

## Findings and corrections

| Area | Where consistency was missing | Correction |
| --- | --- | --- |
| Shared palette | Home and the household header defined their own ink, green, border, and muted colors; other screens used different token values or literal copies. | Shared tokens now use Home's existing values. Home, Inventory, Shopping, authentication, settings, navigation, and shared controls reference those roles. Home's section order, cards, metrics, and floating add layout remain intact. |
| Add/Edit inventory | Separate 24-point editor header, separate input sizing/borders, 600-point editor width, independent button styles, and no explicit page background. | Shared `PageHeader`, form control styles, panel treatment, button styles, pale background, and the same 560-point compact bound used for settings/forms. Selected category text can wrap. |
| Edit summary | The summary was fixed above the scrolling fields, consuming space for long names/large text or an open keyboard. | Summary and fields share the scroll area; header and save/cancel remain outside it. Device layout still needs review. |
| Settings/account/household | Account/household names used a separate 22-point heading. Shared legacy cards used padding 24/radius 20, versus padding 16/radius 16 in newer panels. Several links, badges, and invitation surfaces copied color literals. | Names and legacy cards now reuse shared section/panel typography and spacing. Links and badges reference theme roles. Owner/member permissions and invitation actions are preserved. |
| Shopping list | The page title was maintained separately from the shared header. | Uses `PageHeader` and shared theme colors; checklist and purchase history structure remain. |
| Shopping add/edit/details/transfer sheets | Separate 23-point titles, an off-white sheet background, and independent title/close arrangement. Inventory links had 44-point targets. | Uses the shared header with a trailing close action where applicable, Home's page background, standard 16-point sheet padding, shared fields, and 48-point link targets. Purchase and transfer remain distinct. |
| Reminder preferences | Time controls and custom-day fields had separately defined label/frame treatments. | Time, text, and date fields share `controlStyles.ts`. Existing preference panels/header already use the shared pattern. Save/cancel destinations and permission feedback are preserved. |
| Sign-in/sign-up and household setup | Shared fields/buttons and legacy body copy had drifted from newer screen styles. | Shared label, input, body, card, and action styles now drive these screens too. Authentication and setup behavior is unchanged. |
| Product detail and Home fallback states | `FoundationScreen` still rendered an older 34-point hero and uppercase eyebrow when its heading was visible. | Uses the compact shared header and body copy, including focused Inventory details and Home loading/error states. |
| Editor loading/error states | Edit returned bare loading/error containers; Add fallback had no visible page title. | Edit fallback uses the shared screen shell; Add fallback has a shared title/back header and full page background. |
| Alerts | Already uses `FoundationScreen`, `PageHeader`, shared panels, and the shared expiry formatter. | Receives Home's palette through its existing token imports; no screen-specific redesign was needed. |

Uniformity means the same palette, hierarchy, controls, and state treatment. Home metrics, checklist rows, editor forms, expiry warnings, and native system pickers retain shapes appropriate to their functions. Semantic urgency colors and the established bright floating add action remain deliberate variations.

## Verification

- Mobile lint and TypeScript checks passed.
- All 15 mobile suites / 96 tests passed, covering inventory add/edit/conflicts, shopping purchase/transfer, settings/household, auth, alerts/preferences, and navigation.
- Android/iOS/web export results are recorded in the accompanying UI baseline update.
- A temporary loopback fixture API and Expo preview were started, but Chrome inspection failed because Computer Use permissions were not granted. No preview account was created against the real backend; both temporary servers were stopped. No screenshot was captured.
- No backend/API/database changes were made. The existing APK predates this change; a fresh APK is needed for phone review.

## Still missing: rendered acceptance

Review Android and iOS at narrow widths and larger system text, especially Add/Edit's scrolling summary and footer, Settings names/invitation codes, Shopping sheet headings/close controls, and date/time picker presentation. Exercise keyboard-open forms, bottom safe areas, screen-reader order, permission denial, stale data, and conflicts. Browser export validates bundling, not browser appearance. A native build and device review are the next actionable check.
