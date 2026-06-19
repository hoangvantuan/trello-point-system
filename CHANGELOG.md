# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-06-19

### Added

- **Fractional points (up to 3 decimal places)**: point and estimate now accept values such as `0.125` (1/8), `0.25`, and `0.375`. Quick-log chips `0.125` and `0.25` were added.

### Changed

- Totals are now rounded to **3 decimal places** (previously 2), so logging `0.125` no longer drifts in the UI (e.g. eight entries of `0.125` show `1` instead of `1.04`).
- Point and estimate validation now share a single `hasAtMostDecimals` helper, removing the asymmetry where a `0.125` target could be set but never logged. Number inputs step by `0.125`.

## [1.1.0] - 2026-06-17

### Added

- **Board-level point stats dashboard**: a "📊 Point Stats" board button opens a dashboard modal.
  - **By List** tab: estimate vs. logged totals per list with a progress bar (a snapshot of current progress, open cards only).
  - **By User** tab: total points logged per user, with a weekly/monthly breakdown and a time filter (all / today / this week / this month / this year).
  - Bulk-fetch via the REST API (`filter=all&pluginData=true`) retrieves every card in a single request, including archived cards; aggregation happens client-side with no caching.
- `card-back-section` and `board-buttons` capabilities.
- Power-Up icon set.
- Privacy Policy page.

### Changed

- Translated the entire UI to English (i18n).
- Iframe URLs are now signed via `t.signUrl`.
- Updated `APP_KEY` and `PLUGIN_ID`.

### Fixed

- **Incorrect progress bar on the By List tab when a time filter was active**: a card already fully logged (e.g. `30/30`) showed `0%` when "this week" was selected, because the numerator `Log` was filtered while the denominator `Est` was not (estimates carry no date). The By List tab is now a state snapshot (stock) — `Log` is cumulative across all time, and the time filter and breakdown are removed from this tab; the filter and breakdown (flow) live only on the By User tab. Each tab now carries a caption clarifying its semantics.
- Several iframe resize issues (after entering an estimate, after refresh) and popup overflow.
- Dashboard horizontal overflow on narrow iframes: tables now scroll within their sheet and breakdown bars can shrink.

[1.2.0]: https://github.com/hoangvantuan/trello-point-system/releases/tag/v1.2.0
[1.1.0]: https://github.com/hoangvantuan/trello-point-system/releases/tag/v1.1.0
