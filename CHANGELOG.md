# Changelog

## 0.5.0 — 2026-10-01

- Every problem now says why it happened and comes with a one-click fix
- PanelKit remembers which block a cell belonged to, so “Put it back” and “Give cells back” undo an accidental paint-over exactly
- Blocks without a place get “Find a place”, which picks a sensible row: title and status at the top, assist bar at the bottom, everything else above it
- “Show cells” highlights the affected cells in the grid, which also marks broken areas with a dashed outline
- Undo and redo for every change, with buttons in the top bar and Ctrl+Z / Ctrl+Shift+Z
- A notice with Undo appears the moment a block is painted off the grid
- The preview says when the layout is broken, and the install guide warns before you paste a view that still has problems
- Issue count in the preview header and on the mobile Canvas tab
- A missing assist bar is reported once instead of twice

## 0.4.0 — 2026-10-01

- Rewritten install guide: step by step, with the exact cards to install and links to them, where to click in Home Assistant, the title and URL name to enter with copy buttons, and how to open the view on the device
- “All views” mode in the guide for adding every view at once through the raw configuration editor
- Prepared `view_assist.navigate` action with the right path to test a view
- Calmer, denser interface: icon set instead of emoji, clearer block list, segmented controls, YAML syntax highlighting
- “Add to Home Assistant” button always visible in the top bar
- Follows the system light or dark setting, the toggle still overrides it

## 0.3.0 — 2026-10-01

- Several views in one project: a view bar to switch, add, delete (with undo), reorder, duplicate and rename
- Add a single view from a template or the whole tab set at once
- The navbar can follow your views: one route per view, label and icon from each view's settings, in view bar order
- “Use this navbar in every view” copies the navbar and makes room for it where needed
- “Copy all views” exports every view as dashboard entries for the raw configuration editor
- Color pickers for the base color, the navbar background and area backgrounds
- Warning when two views share a name
- Work from 0.2 is moved into the new project format automatically

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
