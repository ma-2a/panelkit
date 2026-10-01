# Changelog

## 0.2.0 — 2026-10-01

- New layout: blocks on the left, preview and grid on the right, YAML below
- Blocks open in place to show their settings, so it is clear what you are editing
- Every block can be removed from the list, with undo
- Device presets for common View Assist screens, plus a custom size
- Tab set templates: home, camera, music, lights and calendar, sharing one navbar on the right
- New blocks: camera (built in or Advanced Camera Card), calendar, Mushroom light card
- Link targets can now run a script, scene or automation
- The navbar check now catches it covering any content, not only the assist bar
- Tapping a cell that already belongs to the selected block clears it

## 0.1.0 — 2026-10-01

First release.

- Grid editor with per-row and per-column sizing in any CSS grid unit
- Live preview at the aspect ratio of the target display
- View Assist blocks: title, status icons, assist bar, message, timers, satellite image, web page, intent cards, dim overlay
- HACS cards as blocks: navbar-card, Mushroom chips, Mushroom template card, mini-media-player, clock-weather-card
- Tile card and raw card YAML for anything else
- Navbar editor with four styles, position, accent color, labels and routes
- One link field everywhere: view name, absolute path or external URL
- Validation for non-rectangular areas, unplaced blocks, missing assist bar, navbar overlapping the assist bar, routes without a target
- Lists the HACS repositories a view needs
- Six templates to start from
- Work is kept in local storage, nothing is sent anywhere
