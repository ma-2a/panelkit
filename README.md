# PanelKit

A visual layout editor for [View Assist](https://dinki.github.io/View-Assist/) views in Home Assistant.

**[Open the builder](https://ma-2a.github.io/panelkit/builder/)** · no install, nothing leaves your browser.

View Assist views are a single `custom:button-card` with a `grid-template-areas` layout and a set of
`custom_fields`. That is a flexible format, and an awkward one to write by hand. PanelKit draws the
grid, fills in the fields and hands back YAML you paste into a manual card.

## What it does

- Grid editor with per-row and per-column sizing in any CSS grid unit
- Live preview at the aspect ratio of your display
- View Assist blocks: title, status icons, assist bar, message, timers, satellite image, web page, intent cards
- HACS cards with proper forms: navbar-card, Mushroom chips, Mushroom template card, mini-media-player, clock-weather-card
- One link field for every block: `music` becomes `/view-assist/music`, `/lovelace/0` stays as is, `https://…` becomes a tap action
- Validation for non-rectangular areas, unplaced blocks, missing assist bar, navbar overlapping the assist bar
- Lists the HACS repositories the generated view needs

## Requirements

`custom:button-card` and a working View Assist setup. The built-in `variable_template` and `body_template`
provide the status icons, the assist bar and the satellite variables the generated views rely on.
Everything else depends on the blocks you pick, and the builder tells you which.

## Using the output

1. Install the listed cards from HACS under *Frontend*, then reload the browser
2. Add a view to your View Assist dashboard, named exactly like the view in the builder, type *Panel (1 card)*
3. Add a card, choose *Manual*, clear it, paste the YAML, save
4. Open it with `view_assist.navigate` or from a navbar route

## Running it locally

It is one HTML file with no build step and no dependencies:

```
git clone https://github.com/ma-2a/panelkit.git
cd panelkit
python3 -m http.server 8000
```

Then open `http://localhost:8000/builder/`.

## Tests

`qa/run.js` renders every template and every block type, parses the generated YAML, and checks the
grid, the custom fields, the quoting and the validation rules.

```
cd qa && npm install && node run.js
```

## Not yet

- Importing existing views
- Entity picker
- More cards: Bubble Card, Ultra Card, swipe-card

Requests are welcome in [issues](https://github.com/ma-2a/panelkit/issues).

## Support

If this saved you some time, [Ko-fi](https://ko-fi.com/ma2a).

## Credits

View Assist is by [dinki](https://github.com/dinki/View-Assist). PanelKit is an independent tool and is
not affiliated with it, with Home Assistant, or with the authors of the cards it generates configuration for.

MIT licensed.
