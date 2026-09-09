# Product color system

`public/palette.css` is the shared source of color values for the landing page, operator workspace, and nested banking training screens. The app imports the file; the isolated frames load it directly.

- Graphite surfaces establish the product shell and navigation.
- Ivory surfaces hold forms, records, and reviewable artifacts.
- Mint identifies the brand and the landing page's primary action.
- Forest green identifies workspace actions and success states.
- Amber indicates intervention or a known business outcome.
- Red indicates a stopped, failed run.

Background, foreground, border, focus, and semantic state colors have named tokens. Alpha effects derive from those tokens with `color-mix`. Tenant variants use the same color system and retain their own labels and UI behavior.

The 4K walkthrough (1:45) is re-recorded when this system changes so embedded screens in the video match the current product.

Run `npx tsx scripts/check-colors.ts` against the local preview to check text contrast (4.5:1 threshold), shared button colors, and all result states. The latest measured results are in `evidence/color-verification.json`.
