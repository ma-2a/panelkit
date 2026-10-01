# PanelKit

A visual layout editor for [View Assist](https://dinki.github.io/View-Assist/) views in Home Assistant.

**[Open the builder](https://ma-2a.github.io/panelkit/builder/)**. No install, nothing leaves your browser.

View Assist views are a single `custom:button-card` with a `grid-template-areas` layout and a set of
`custom_fields`. That is a flexible format, and an awkward one to write by hand. PanelKit draws the
grid, fills in the fields and hands back YAML you paste into a manual card.

## What it does

- Device presets: Echo Show 5, 8 and 10, Lenovo ThinkSmart View, Fire HD 8 and 10, 7 inch tablets, Raspberry Pi display, or any custom size
- Several views in one project, with a view bar to switch, add, delete, reorder and duplicate
- Templates, including a tab set (home, camera, music, lights, calendar) that shares one navbar
- A navbar that follows your views, and one click to put it on every view
- Export one view, or all of them at once for the raw configuration editor
- Edit directly in the preview: drag to move, drop on another block to swap, pull handles to resize, keyboard arrows work too
- Row and column sizes from a menu next to the preview, custom CSS grid values if you need them
- Undo and redo for everything
- View Assist blocks: title, status icons, assist bar, message, timers, satellite image, web page, intent cards
- HACS cards with proper forms: navbar-card, Mushroom chips, template and light cards, mini-media-player, clock-weather-card, Advanced Camera Card
- Home Assistant cards: camera feed, calendar agenda, tile
- One link field for every block: `music` becomes `/view-assist/music`, `/lovelace/0` stays as is, `script.x` or `scene.x` runs it, `https://…` opens it
- Problems are explained and come with a one-click fix
- Lists the HACS repositories the generated view needs

## Requirements

`custom:button-card` and a working View Assist setup. The built-in `variable_template` and `body_template`
provide the status icons, the assist bar and the satellite variables the generated views rely on.
Everything else depends on the blocks you pick, and the builder tells you which.

## Getting it into Home Assistant

Click **Add to Home Assistant** in the builder. It walks you through every step for the view you are working on, or for all views at once:

1. Install the cards the view uses from HACS. The builder lists exactly which ones, with links.
2. Open the View Assist dashboard and switch to edit mode.
3. Create an empty panel view. The builder shows the title and URL name to enter, with copy buttons.
4. Paste the card code into a manual card.
5. Open the view on your device, from a navbar or with the `view_assist.navigate` action the builder prepares for you.

For several views at once it uses the raw configuration editor instead of steps 3 and 4.

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
grid, the custom fields, the quoting and the validation rules. `qa/smoke.js` loads the builder in jsdom
and clicks through every template, block editor and device. `qa/browser.js` drives a real Chrome:
dragging, swapping, resizing, keyboard moves, inline editing and the size bars.

```
cd qa && npm install && npm test
CHROME_PATH=/path/to/chrome npm run browser
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

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
