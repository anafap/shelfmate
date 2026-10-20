# ShelfMate UI baseline

Home and Inventory retain their current composition, cards, filters, navigation, and floating add actions. Changes there are limited to demonstrated readability, accessibility, and date-copy defects. Do not recreate illustrative product photography or add unsupported controls from design references.

Other screens use the same pale green background, white surfaces, dark green text, restrained borders, and semantic expiry colors. Shared tokens live in `mobile/src/theme/tokens.ts`. Use 4/8/12/16/24 spacing, compact titles, and 48-point touch targets. Let content wrap at larger text sizes; urgency must include words alongside color.

Delivery slices: baseline fixes; inventory forms and shopping transfer; Alerts and dedicated preferences; grouped settings; focused authentication and household setup. Preserve existing APIs, cache invalidation, conflict handling, retry safety, and unrelated work. Each slice is checked and committed separately.

Baseline validation: 87 mobile tests passed. No Android device was attached at implementation start; no fresh native baseline capture was possible. Saved references in `docs/screenshots` are illustrative, not evidence of the running app. Native visual and large-text verification remains a release check.
