---
name: shelfmate-ui
description: Create, change, or review ShelfMate mobile screens and components with consistent styling, navigation, forms, expiry copy, and accessible interaction states. Applies to ShelfMate UI work, not unrelated apps or backend-only changes.
---

# ShelfMate UI

Keep ShelfMate visually coherent across Home, Inventory, Shopping, Alerts, authentication, household setup, settings, and editors. Use this skill inside the ShelfMate repository; resolve the paths below from its root. This skill guides UI implementation and review; it does not authorize a redesign or a change to product scope.

## Establish the current baseline

Read root and mobile `AGENTS.md`, `docs/ui-design.md`, and the screen being changed plus its nearest equivalent. Read `mobile/src/theme/tokens.ts` and the shared components before adding styles. Use current source values rather than copying this skill's snapshots if they change.

The accepted baseline preserves Home and Inventory composition, filters, cards, and floating add actions. Limit changes there to the requested work. `UI-REDESIGN.md` and `docs/screenshots/` contain proposed/illustrative references; their presence alone does not approve a redesign or establish device verification. Explicit new instructions from Ana take precedence over the older baseline. Record an adopted baseline change in `docs/ui-design.md` so later screens follow it.

## Shared visual language

- Import `colors` and `spacing` from `@/theme/tokens`. Existing roles are pale green background, white surface, dark green ink/text, muted secondary text, green primary actions, quiet borders, and red destructive actions. Spacing uses 4/8/12/16/24. Reuse a semantic role before introducing a new value; add a shared token only when a requested repeated pattern needs it.
- Reuse `PageHeader` and `pageUi` for compact headers, panels, sections, rows, and secondary copy. Current header typography is 28/36, section headings 18/25, body 14/21, captions 13/19; panels use radius 16 and padding 16. Preserve hierarchy without adding a second large title or explanatory hero above the main task.
- Reuse `FoundationScreen` for bounded, responsive content. Inspect its options: its default heading is larger, so use `hideHeading` with `PageHeader` when matching the compact screen pattern. Preserve safe-area handling.
- Reuse `FloatingActionButton` on screens with the established floating add pattern. Keep its accessible action label, bottom inset, and `FAB_SCROLL_END_PADDING` clearance. Do not add a competing add button unless the requested flow needs it.
- Use the existing icon approach and platform mappings from nearby components. Prefer shared primitives over copying an entire screen's styles. Existing legacy literals are not a reason to restyle unrelated screens.

## Consistent interactions and copy

- Keep four primary tabs: Home, Inventory, Shopping, Alerts. Account, household invitations, and reminder preferences remain secondary routes. Preserve explicit return navigation for preferences opened from Alerts or Settings.
- Keep inventory cards compact and readable: name, quantity/unit, relevant category/storage, then unmistakable expiry information. Use text and icons alongside urgency color. Long names and metadata must wrap without displacing actions.
- Reuse `InventoryForm` for inventory add/edit and applicable shopping-transfer fields; optional new-item details stay collapsed. Use shared `DateField`/`TimeField` and their platform implementations instead of inventing another picker treatment. Keep field labels, save/cancel placement, pending/disabled feedback, errors, and draft preservation consistent with adjacent forms.
- Reuse `expiryLabel`, `expiryTone`, and `formatProductDate` from `features/inventory/types.ts`. They consume server-provided urgency and days remaining; never recalculate household-local expiry on individual screens. Use natural singular/plural date copy. Keep Estimated and Unknown explicit; a green state must not claim food safety.
- Shopping purchase and inventory transfer are separate actions. Preserve duplicate review, already-transferred feedback, purchaser attribution, confirmation, and retry-safe API behavior during visual changes.
- Show actual sync/network state. Preserve loading, empty, stale/offline, retry, permission-denied, invitation-error, and concurrency-conflict feedback wherever the changed flow supports them. Preserve typed drafts on recoverable failures. Never substitute demo counts or a permanent “Live” badge for real data/state.

## Review and verification

For the affected screen and shared-component callers, check narrow phone widths (320–390 points), large system text, long names, keyboard-open forms, bottom safe areas, and scroll clearance around floating actions. Use at least 48-point touch targets, meaningful accessibility labels/roles/states, visible focus where applicable, and sufficient contrast. Avoid fixed text heights or disabled font scaling to force layouts to fit.

Run the mobile lint and typecheck commands in `mobile/package.json`; run relevant interaction tests for changed behavior. Add tests for meaningful workflow regressions rather than exact style values. Export/build when navigation, native dependencies, or bundling changes warrant it. Follow `mobile/AGENTS.md` for version-matched documentation before changing Expo/React Native APIs.

Inspect rendered affected screens when a preview/device is available. Check consistency against an unchanged sibling screen, not just an illustrative screenshot. Report exactly which platform and states were inspected; automated checks alone do not establish visual or physical-device acceptance. If no preview is available, state that limitation.

Keep the patch limited to the requested UI work. Summarize shared components/tokens used or changed, behavior preserved, checks and results, and remaining device checks. Follow the repository's atomic commit and push rules without including unrelated working-tree changes.
