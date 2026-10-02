const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "builder", "index.html"), "utf8");
const landing = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

const fail = [], pass = [];
const check = (name, cond, detail) => (cond ? pass : fail).push(detail && !cond ? `${name} (${detail})` : name);

const stubEl = () => new Proxy(
  { style: { setProperty() {} }, options: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
    append() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null }, querySelector() { return stubEl() },
    querySelectorAll() { return [] }, value: "", textContent: "", innerHTML: "", clientWidth: 900, hidden: false },
  { get: (t, p) => (p in t ? t[p] : () => stubEl()), set: (t, p, v) => { t[p] = v; return true } }
);
global.document = {
  querySelector: () => stubEl(), querySelectorAll: () => [], getElementById: () => null, addEventListener() {},
  createElement: () => stubEl(), documentElement: stubEl()
};
global.window = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: true }) };
global.getComputedStyle = () => ({ gridTemplateColumns: "", gridTemplateRows: "" });
global.localStorage = { getItem: () => null, setItem() {} };
global.navigator = { clipboard: { writeText: async () => {} } };

const ctx = {};
new Function("with(this){" + src +
  "; this.__x = {TYPES,PRESETS,SCHEMAS,DEVICES,blockDefaults,buildYaml,checks,deps,yq,navTarget,tapFor,cardCfg,hacsOf," +
  "removeBlock,undoRemove,addBlock,deviceSize,dropPlan,applyPlan,resizePlan,applyResize,moveBlockTo,rectOf,fits,normalizeView,gridSpec,FINE,newProject,switchView,addView,deleteView,moveView,duplicateView," +
  "buildAllViews,effectiveRoutes,applyNavbarEverywhere,hexOr,load,TABSET,issues,autoPlace,keepLargestRect,histUndo,histRedo,renderAll," +
  "setState:s=>{ if(!project||!project.views.includes(s)) project=newProject([s]); state=s; }," +
  "setProject:p=>{ project=p; state=p.views[p.active]; }, getProject:()=>project, getState:()=>state}}").call(ctx);
const A = ctx.__x;
const run = (s, fn) => { A.setState(s); return fn(); };
const parse = out => yaml.load(out);

function gridOf(doc) {
  const g = k => doc.styles.grid.find(x => k in x)[k];
  const rows = g("grid-template-areas").trim().split("\n").map(r => r.trim().replace(/"/g, "").split(/\s+/));
  const expand = t => String(t).replace(/repeat\((\d+),\s*([^)]+)\)/g, (_, n, v) => Array(+n).fill(v.trim()).join(" ")).trim().split(/\s+/);
  return { rows, cols: expand(g("grid-template-columns")), sizes: expand(g("grid-template-rows")) };
}

for (const [name, preset] of Object.entries(A.PRESETS)) {
  const s = preset();
  let doc;
  try { doc = parse(run(s, A.buildYaml)); check(`preset ${name}: yaml parses`, true); }
  catch (e) { check(`preset ${name}: yaml parses`, false, e.message.split("\n")[0]); continue; }
  check(`preset ${name}: button-card with View Assist templates`, doc.type === "custom:button-card" && doc.template.includes("body_template"));
  const g = gridOf(doc);
  check(`preset ${name}: rows equal width`, new Set(g.rows.map(r => r.length)).size === 1);
  check(`preset ${name}: column sizes match`, g.cols.length === g.rows[0].length);
  check(`preset ${name}: row sizes match`, g.sizes.length === g.rows.length);
  const used = new Set(g.rows.flat().filter(c => c !== "."));
  for (const a of used) if (!["status", "assist"].includes(a))
    check(`preset ${name}: "${a}" has content`, doc.custom_fields && a in doc.custom_fields);
  for (const a of Object.keys(doc.custom_fields || {}))
    check(`preset ${name}: "${a}" is placed or floats`, used.has(a) || ["navbar", "shader"].includes(a));
  const w = run(s, A.checks);
  check(`preset ${name}: no warnings`, w.length === 0, w.join(" / "));
  check(`preset ${name}: view name set`, /^[a-z0-9_]+$/.test(s.name));
}

const tabProject = () => A.newProject(A.TABSET.map(k => A.PRESETS[k]()));
for (const name of ["home", "camera", "music", "lights", "calendar"]) {
  const p = tabProject(); p.active = A.TABSET.indexOf(name); A.setProject(p);
  const doc = parse(A.buildYaml());
  check(`tab ${name}: no warnings in tab set`, A.checks().length === 0, A.checks().join(" / "));
  const nav = doc.custom_fields.navbar.card;
  check(`tab ${name}: navbar on the right`, nav.desktop.position === "right");
  check(`tab ${name}: five routes`, nav.routes.length === 5);
  check(`tab ${name}: own route exists`, nav.routes.some(r => r.url === `/view-assist/${name}`));
  check(`tab ${name}: active icon derived`, nav.routes.find(r => r.url === "/view-assist/home").icon_selected === "mdi:home");
  check(`tab ${name}: glass and accent`, /backdrop-filter/.test(nav.styles) && /#ff7a3d/.test(nav.styles));
  const g = gridOf(doc);
  check(`tab ${name}: navbar column empty`, g.rows.every(r => r[r.length - 1] === "."));
}

const cam = parse(run(A.PRESETS.camera(), A.buildYaml)).custom_fields;
check("camera: core picture-entity live", cam.camera.card.type === "picture-entity" && cam.camera.card.camera_view === "live");
check("camera: floodlight is a mushroom light", cam.floodlight.card.type === "custom:mushroom-light-card");
const adv = A.PRESETS.camera(); adv.blocks.camera.engine = "advanced";
const advDoc = parse(run(adv, A.buildYaml)).custom_fields.camera.card;
check("camera: advanced card config", advDoc.type === "custom:advanced-camera-card" && advDoc.cameras[0].camera_entity === "camera.front_door");
check("camera: advanced adds HACS dependency", run(adv, A.deps).includes("Advanced Camera Card"));
check("camera: core needs no extra dependency", !run(A.PRESETS.camera(), A.deps).includes("Advanced Camera Card"));

const cal = parse(run(A.PRESETS.calendar(), A.buildYaml)).custom_fields.agenda.card;
check("calendar: core card", cal.type === "calendar");
check("calendar: agenda view", cal.initial_view === "listWeek");
check("calendar: entities split", JSON.stringify(cal.entities) === JSON.stringify(["calendar.family", "calendar.birthdays"]));

const mus = parse(run(A.PRESETS.music(), A.buildYaml)).custom_fields;
check("music: full cover player", mus.player.card.type === "custom:mini-media-player" && mus.player.card.artwork === "full-cover");
check("music: favorites runs a script", mus.favorites.card.tap_action.action === "perform-action" &&
  mus.favorites.card.tap_action.perform_action === "script.turn_on" && mus.favorites.card.tap_action.target.entity_id === "script.play_favorites");

const lights = parse(run(A.PRESETS.lights(), A.buildYaml)).custom_fields;
const lightCards = Object.values(lights).filter(f => f && f.card && f.card.type === "custom:mushroom-light-card");
check("lights: five light cards", lightCards.length === 5);
check("lights: brightness slider on", lightCards.every(f => f.card.show_brightness_control === true));
check("lights: all off runs script", lights.alloff.card.tap_action.target.entity_id === "script.all_lights_off");

const home = parse(run(A.PRESETS.home(), A.buildYaml)).custom_fields;
check("home: calendar chip uses jinja", home.chips.card.chips.some(c => /state_attr/.test(c.content || "")));
check("home: chip navigates to calendar", home.chips.card.chips.some(c => c.tap_action && c.tap_action.navigation_path === "/view-assist/calendar"));

const every = A.PRESETS.blank();
every.rows = [{ size: "min-content", cells: ["title", "status"] }];
const types = Object.keys(A.TYPES).filter(t => !["title", "status", "assist"].includes(t));
types.forEach(t => {
  every.blocks[t] = A.blockDefaults(t);
  if (!A.TYPES[t].floating) every.rows.push({ size: "1fr", cells: [t, t] });
});
every.rows.push({ size: "min-content", cells: ["assist", "assist"] });
let everyDoc;
try { everyDoc = parse(run(every, A.buildYaml)); check("all block types: yaml parses", true); }
catch (e) { check("all block types: yaml parses", false, e.message.split("\n")[0]); }
if (everyDoc) for (const t of types) check(`block ${t}: emitted`, everyDoc.custom_fields[t] !== undefined);

const s0 = A.PRESETS.blank(); A.setState(s0);
check("target: view name", A.navTarget("music").v === "/view-assist/music");
check("target: absolute path", A.navTarget("/lovelace/0").v === "/lovelace/0");
check("target: url", A.navTarget("https://x.dev").kind === "url");
check("target: script", A.navTarget("script.good_night").kind === "action");
check("target: scene", JSON.stringify(A.tapFor("scene.movie")) === JSON.stringify({ action: "perform-action", perform_action: "scene.turn_on", target: { entity_id: "scene.movie" } }));
check("target: automation triggers", A.tapFor("automation.x").perform_action === "automation.trigger");
check("target: empty", A.navTarget("") === null);
A.getProject().vaBase = "/panel";
check("target: custom dashboard path", A.navTarget("clock").v === "/panel/clock");

const navAct = A.PRESETS.infonav();
navAct.blocks.navbar.sync = false;
navAct.blocks.navbar.routes.push({ icon: "mdi:weather-night", label: "Night", target: "script.good_night" });
const navDoc = parse(run(navAct, A.buildYaml)).custom_fields.navbar.card;
const night = navDoc.routes.find(r => r.label === "Night");
check("navbar: script route has tap action, no url", night && !night.url && night.tap_action.perform_action === "script.turn_on");

check("quote: plain token", A.yq("mdi:home") === "mdi:home");
check("quote: hex color", A.yq("#24292c") === '"#24292c"');
check("quote: spaces", A.yq("My title") === '"My title"');
check("quote: yaml keyword", A.yq("on") === '"on"');
check("quote: colon space", A.yq("a: b") === '"a: b"');
check("quote: newline stays one scalar", A.yq("x\nevil: true") === JSON.stringify("x\nevil: true"));
const tricky = A.PRESETS.blank();
tricky.blocks.title.text = 'He said "hi" & <b>bold</b>: done';
check("escaping: title round trip", parse(run(tricky, A.buildYaml)).custom_fields.title === 'He said "hi" & <b>bold</b>: done');

const grid = v => v.rows.map(r => r.cells.join(" ")).join(" | ");
const R0 = (v, n) => A.rectOf(v, n);
const fresh = k => { const p = A.newProject([A.PRESETS[k]()]); A.setProject(p); return A.getState(); };

for (const [name, preset] of Object.entries(A.PRESETS)) {
  const v = preset();
  check(`fine grid: ${name} is 12 by 12`, v.fine && v.cols === 12 && v.rows.length === 12 && v.rows.every(r => r.cells.length === 12 && r.size === "1fr"));
  check(`fine grid: ${name} has no navbar spacer in its cells`, v.colSizes.every(x => x === "1fr"));
}
let V = fresh("home");
check("fine grid: title one row high", R0(V, "title").h === 1 && R0(V, "title").r === 0);
check("fine grid: assist one row at the bottom", R0(V, "assist").h === 1 && R0(V, "assist").r === 11 && R0(V, "assist").w === 12);
check("fine grid: clock gets most of the height", R0(V, "clockweather").h >= 8);
V = fresh("music");
check("fine grid: buttons row gets two units", R0(V, "favorites").h === 2 && R0(V, "radio").h === 2);
check("fine grid: halves stay halves", R0(V, "favorites").w === 6 && R0(V, "radio").c === 6);
V = fresh("lights");
check("fine grid: three equal columns", ["living", "floorlamp", "office"].every(n => R0(V, n).w === 4));
V = fresh("camera");
check("fine grid: 3fr 1fr becomes 9 and 3", R0(V, "camera").w === 9 && R0(V, "floodlight").w === 3);
V = fresh("timers");
check("fine grid: vh rows converted", R0(V, "title").h === 2 && R0(V, "assist").h === 1 && R0(V, "timers").h === 9, JSON.stringify([R0(V, "title"), R0(V, "timers"), R0(V, "assist")]));

const legacy = { name: "x", label: "", icon: "", cols: 3, colSizes: ["1fr", "1fr", "90px"], rows: [
  { size: "min-content", cells: ["title", "status", "."] }, { size: "1fr", cells: ["a", "b", "."] }, { size: "min-content", cells: ["assist", "assist", "."] }],
  blocks: { title: A.blockDefaults("title"), status: A.blockDefaults("status"), assist: A.blockDefaults("assist"), a: A.blockDefaults("tile"), b: A.blockDefaults("tile") } };
const lv = A.normalizeView(JSON.parse(JSON.stringify(legacy)));
check("migration: old views become 12 by 12", lv.cols === 12 && lv.rows.length === 12);
check("migration: spacer column dropped", R0(lv, "b").c + R0(lv, "b").w === 12);
check("migration: proportions kept", R0(lv, "a").w === 6 && R0(lv, "b").w === 6 && R0(lv, "a").h === 10);
check("migration: runs once", A.normalizeView(lv) === lv && grid(lv) === grid(A.normalizeView(lv)));

V = fresh("infonav");
let gs = A.gridSpec(V, false);
check("gutter: right navbar adds a 90px column", gs.cols === "repeat(12, 1fr) 90px" && gs.areas.every(r => r.endsWith(' ."')));
V.blocks.navbar.position = "left"; gs = A.gridSpec(V, false);
check("gutter: left navbar adds the column first", gs.cols === "90px repeat(12, 1fr)" && gs.offC === 1 && gs.areas.every(r => r.startsWith('". ')));
V.blocks.navbar.position = "bottom"; gs = A.gridSpec(V, false);
check("gutter: bottom navbar adds a row", gs.rows === "repeat(12, 1fr) 70px" && gs.areas.length === 13);
V.blocks.navbar.position = "top"; gs = A.gridSpec(V, false);
check("gutter: top navbar adds the row first", gs.rows === "70px repeat(12, 1fr)" && gs.offR === 1);
delete V.blocks.navbar; gs = A.gridSpec(V, false);
check("gutter: none without navbar", gs.cols === "repeat(12, 1fr)" && gs.areas.length === 12);
check("gutter: preview scales the strip", A.gridSpec(fresh("home"), true).cols.includes("calc(90px * var(--scale,1))"));

V = fresh("lights");
const g0 = grid(V);
let plan = A.dropPlan(V, "living", R0(V, "garden").r, R0(V, "garden").c, { dr: 0, dc: 0 });
check("drag: drop on another block means swap", plan.kind === "swap" && plan.with === "garden");
A.applyPlan(V, "living", plan);
check("drag: swap exchanges places", V.rows[1].cells[0] === "garden" && V.rows[7].cells[4] === "living" && A.issues().length === 0);
A.applyPlan(V, "living", A.dropPlan(V, "living", 1, 0, { dr: 0, dc: 0 }));
check("drag: swapping back restores layout", grid(V) === g0);
const gr = R0(V, "garden"); A.removeBlock("garden");
plan = A.dropPlan(V, "desk", gr.r, gr.c + 1, { dr: 0, dc: 1 });
check("drag: drop on free space moves", plan.kind === "move" && plan.rect.c === gr.c && plan.rect.w === 4);
A.applyPlan(V, "desk", plan);
check("drag: moved", R0(V, "desk").c === gr.c && A.issues().length === 0);
plan = A.dropPlan(V, "desk", 9, 0, { dr: 0, dc: 0 });
check("drag: back into the old spot", plan.kind === "move" && plan.rect.c === 0);

V = fresh("lights");
let L0 = R0(V, "living"), F0 = R0(V, "floorlamp"), O0 = R0(V, "office");
let P = A.resizePlan(V, "living", L0, "e", L0.r, L0.c + L0.w + 1);
check("resize: growing pushes the neighbour", P.rect.w === L0.w + 2 && P.push.floorlamp && P.push.floorlamp.c === F0.c + 2 && P.push.floorlamp.w === F0.w - 2);
A.applyResize(V, "living", P);
check("resize: result is valid", A.issues().length === 0);
P = A.resizePlan(V, "living", R0(V, "living"), "e", L0.r, 11);
check("resize: pushes neighbours along until they reach their minimum", P.push.floorlamp && P.push.floorlamp.w === 2 && P.push.office && P.push.office.w === 2 && P.rect.c + P.rect.w === 8, JSON.stringify(P));
A.applyResize(V, "living", P);
check("resize: nothing overlaps after pushing", A.issues().length === 0, A.issues().map(x => x.text).join(" / "));
P = A.resizePlan(V, "living", R0(V, "living"), "e", L0.r, 1);
check("resize: shrink leaves free space", P.rect.w === 2 && Object.keys(P.push).length === 0);
V = fresh("lights");
L0 = R0(V, "living");
P = A.resizePlan(V, "living", L0, "s", 10, L0.c);
check("resize: growing down pushes the block below", P.push.desk && P.push.desk.h >= 1 && P.rect.r + P.rect.h === P.push.desk.r);
P = A.resizePlan(V, "living", L0, "n", 0, L0.c);
check("resize: title row is pushed only if it can shrink", P.rect.r === L0.r);
P = A.resizePlan(V, "living", L0, "se", L0.r + L0.h - 2, L0.c + L0.w - 2);
check("resize: corner changes both sides", P.rect.w === L0.w - 1 && P.rect.h === L0.h - 1);
check("resize: never below one cell", A.resizePlan(V, "living", L0, "e", L0.r, -5).rect.w === 1);
P = A.resizePlan(V, "title", R0(V, "title"), "e", 0, 11);
check("resize: title pushes status down to one cell", P.push.status && P.push.status.w === 1 && P.rect.w === 11);
V = fresh("lights");
P = A.resizePlan(V, "floorlamp", R0(V, "floorlamp"), "w", 1, 0);
check("resize: growing left pushes the left neighbour", P.push.living && P.push.living.w === 2 && P.rect.c === 2, JSON.stringify(P));
P = A.resizePlan(V, "desk", R0(V, "desk"), "n", 1, 0);
check("resize: growing up pushes the block above", P.push.living && P.push.living.h === 2 && P.rect.r === 3, JSON.stringify(P));

V = fresh("blank");
V.blocks.cam = A.blockDefaults("camera");
const pushed = A.applyPlan(V, "cam", A.dropPlan(V, "cam", 0, 0, null));
check("drag: unplaced block onto a placed one pushes it", pushed === "title" && V.rows[0].cells[0] === "cam");
A.autoPlace(pushed);
check("drag: pushed block finds a new spot", A.issues().length === 0, A.issues().map(x => x.text).join(" / "));

V = fresh("blank"); A.setProject(A.getProject());
A.addBlock("mlight");
check("add: new block is placed right away", A.getState().selected === "light" && R0(A.getState(), "light") && A.issues().length === 0);
V = fresh("lights");
A.addBlock("camera");
check("add: works on a full screen by splitting the largest block", R0(V, "camera") && A.issues().length === 0, A.issues().map(x => x.text).join(" / "));

V = fresh("info");
V.rows.forEach(r => r.cells = r.cells.map(c => c === "title" ? "." : c));
A.autoPlace("title");
check("place: title goes back to the top row", R0(V, "title").r === 0 && A.issues().length === 0);
V.rows.forEach(r => r.cells = r.cells.map(c => c === "status" ? "." : c));
A.autoPlace("status");
check("place: status goes back to the top row", R0(V, "status").r === 0 && A.issues().length === 0);
V.rows.forEach(r => r.cells = r.cells.map(c => c === "assist" ? "." : c));
A.autoPlace("assist");
check("place: assist goes back to the bottom row", R0(V, "assist").r === 11 && A.issues().length === 0);
V = fresh("info");
V.rows[11].cells = V.rows[11].cells.map(() => "message");
V.rows.forEach(r => r.cells = r.cells.map(c => c === "assist" ? "message" : c));
delete V.blocks.assist;
const it = A.issues().find(x => x.text.includes("no assist bar"));
check("place: missing assist offered", !!it);
it.fix.run();
check("place: assist takes the bottom row from a tall block", R0(V, "assist").r === 11 && A.issues().length === 0, A.issues().map(x => x.text).join(" / "));

V = fresh("lights");
A.removeBlock("garden");
check("remove: block gone", !("garden" in V.blocks) && V.rows.every(r => !r.cells.includes("garden")));
A.undoRemove();
check("undo: block back with its cells", "garden" in V.blocks && R0(V, "garden").w === 4);
check("undo: order kept", Object.keys(V.blocks).indexOf("garden") === Object.keys(A.PRESETS.lights().blocks).indexOf("garden"));

const legacyBroken = () => {
  const v = A.normalizeView({ name: "lights", label: "", icon: "", cols: 3, colSizes: ["1fr", "1fr", "1fr"], rows: [
    { size: "min-content", cells: ["living", "living", "status"] }, { size: "1fr", cells: ["living", "floorlamp", "office"] }, { size: "min-content", cells: ["living", "living", "living"] }],
    blocks: { title: A.blockDefaults("title"), status: A.blockDefaults("status"), assist: A.blockDefaults("assist"), living: A.blockDefaults("mlight"), floorlamp: A.blockDefaults("mlight"), office: A.blockDefaults("mlight") } });
  A.setProject(A.newProject([v])); return v;
};
let bl = legacyBroken();
let L = A.issues();
check("errors: old broken layout detected", L.length === 3 && L.some(x => x.text.includes("“living” is not a rectangle")) && L.some(x => x.text.includes("“title” is not on the screen")) && L.some(x => x.text.includes("“assist” is not on the screen")), L.map(x => x.text).join(" / "));
check("errors: every issue has a hint and a fix", L.every(x => x.hint && x.fix && typeof x.fix.run === "function"));
let guard = 0; while ((L = A.issues()).length && guard++ < 10) L[0].fix.run();
check("errors: fixing in order clears everything", A.issues().length === 0, A.issues().map(x => x.text).join(" / "));

const bad = A.PRESETS.blank(); A.setState(bad); bad.blocks.t = A.blockDefaults("tile");
bad.rows[3].cells[0] = "t"; bad.rows[5].cells[5] = "t";
check("checks: non-rectangular area", A.checks().some(m => m.includes("rectangle")));
A.issues().find(x => x.text.includes("rectangle")).fix.run();
check("fix: keeps one piece", A.issues().length === 0);
const noAssist = A.PRESETS.blank(); A.setState(noAssist); delete noAssist.blocks.assist; noAssist.rows.forEach(r => r.cells = r.cells.map(c => c === "assist" ? "." : c));
check("checks: missing assist", A.checks().some(m => m.includes("assist")));
const two = A.PRESETS.infonav(); A.setState(two); two.blocks.n2 = A.blockDefaults("navbar");
check("checks: two navbars", A.checks().some(m => m.includes("more than one navbar")));
A.issues().find(x => x.text.includes("more than one navbar")).fix.run();
check("fix: extra navbar removed", !("n2" in two.blocks) && A.issues().length === 0);
const covered = A.PRESETS.info(); A.setState(covered); covered.blocks.navbar = A.blockDefaults("navbar");
check("checks: navbar never covers content now", A.issues().length === 0);
const orphan = A.PRESETS.blank(); A.setState(orphan); orphan.rows[5].cells = orphan.rows[5].cells.map(() => "ghost");
A.issues().find(x => x.text.includes("belong to no block")).fix.run();
check("fix: orphan cells freed", A.issues().length === 0);
const dupP = A.newProject([A.PRESETS.info(), A.PRESETS.info()]); A.setProject(dupP);
check("checks: duplicate view names", A.checks().some(m => m.includes("also called")));
A.issues().find(x => x.text.includes("also called")).fix.run();
check("fix: duplicate name renamed", dupP.views[0].name !== dupP.views[1].name && A.issues().length === 0);

check("devices: Echo Show 5 is 960x480", (() => { const d = A.DEVICES.find(x => x.id === "echo5"); return d && d.w === 960 && d.h === 480; })());
check("devices: Echo Show 8 present", A.DEVICES.some(x => x.label === "Echo Show 8"));
check("devices: custom size option", A.DEVICES.some(x => x.id === "custom"));
const cs = A.PRESETS.blank(); A.setState(cs); Object.assign(A.getProject(), { device: "custom", customW: 1024, customH: 768 });
check("devices: custom size used", JSON.stringify(A.deviceSize()) === "[1024,768]");
check("devices: default is Echo Show 5", A.newProject([]).device === "echo5");

const def = A.load();
check("project: default is the tab set", def.views.map(v => v.name).join() === "home,camera,music,lights,calendar");
let PJ = tabProject(); A.setProject(PJ);
A.addView("tabset");
check("project: tab set not duplicated", A.getProject().views.length === 5);
A.addView("home");
check("project: added view gets unique name", A.getProject().views[5].name === "home2" && A.getProject().active === 5);
A.addView("blank");
check("project: blank view named view", A.getProject().views[6].name === "view");
A.deleteView(5);
check("project: view deleted", A.getProject().views.length === 6);
A.undoRemove();
check("project: delete undone in place", A.getProject().views[5].name === "home2");
A.switchView(1); A.moveView(1);
check("project: move reorders", A.getProject().views[2].name === "camera" && A.getProject().active === 2);
const navNow = A.cardCfg(A.getState().blocks.navbar);
check("project: synced routes follow order", navNow.routes[1].url === "/view-assist/music" && navNow.routes[2].url === "/view-assist/camera");
A.duplicateView();
check("project: duplicate gets unique name", A.getProject().views[3].name === "camera_copy");
const allYaml = A.buildAllViews();
let allDoc; try { allDoc = parse(allYaml); } catch (e) { allDoc = null; }
check("export: all views parse", Array.isArray(allDoc), allYaml.slice(0, 120));
if (allDoc) {
  check("export: one entry per view", allDoc.length === A.getProject().views.length);
  check("export: panel views with paths", allDoc.every(v => v.type === "panel" && /^[a-z0-9_]+$/.test(v.path)));
  check("export: each holds the button-card", allDoc.every(v => v.cards.length === 1 && v.cards[0].type === "custom:button-card"));
}
const mix = A.newProject([A.PRESETS.home(), A.PRESETS.info(), A.PRESETS.timers()]); A.setProject(mix);
A.getState().blocks.navbar.look = "pill";
A.applyNavbarEverywhere("navbar");
check("navbar: copied to views without one", mix.views.every(v => Object.values(v.blocks).some(b => b.type === "navbar" && b.look === "pill")));
check("navbar: copies produce valid yaml without issues", mix.views.every((v, i) => { mix.active = i; A.setProject(mix); try { parse(A.buildYaml()); return A.issues().length === 0; } catch (e) { return false } }));

check("color: hex kept", A.hexOr("#FF7A3D", "#000000") === "#ff7a3d");
check("color: short hex expanded", A.hexOr("#abc", "#000000") === "#aabbcc");
check("color: rgba falls back", A.hexOr("rgba(0,0,0,.4)", "#123456") === "#123456");

const hp = A.newProject([A.PRESETS.lights()]); A.setProject(hp); A.renderAll();
const before = grid(A.getState());
A.moveBlockTo("living", 7, 4); A.renderAll();
check("history: move changed grid", grid(A.getState()) !== before);
A.histUndo();
check("history: undo restores grid", grid(A.getState()) === before);
A.histRedo();
check("history: redo applies again", grid(A.getState()) !== before);
A.histUndo();

const d1 = A.PRESETS.home();
check("determinism", run(d1, A.buildYaml) === run(d1, A.buildYaml));

for (const [label, text] of [["builder", html], ["landing", landing], ["readme", readme]]) {
  check(`${label}: no middle dots`, !/\u00b7/.test(text));
  check(`${label}: no german`, !/[äöüßÄÖÜ]/.test(text));
}
check("html: every localStorage call guarded", (() => {
  const re = /localStorage\./g; let m;
  while ((m = re.exec(html))) {
    const t = html.lastIndexOf("try{", m.index), c = html.indexOf("catch", t);
    if (t < 0 || c < m.index) return false;
  }
  return true;
})());
check("html: lang en", /<html lang="en"/.test(html) && /<html lang="en"/.test(landing));
check("html: viewport-fit", /viewport-fit=cover/.test(html) && /viewport-fit=cover/.test(landing));
check("html: dark theme", /prefers-color-scheme: dark/.test(html));
check("html: kofi link", html.includes("https://ko-fi.com/ma2a") && landing.includes("https://ko-fi.com/ma2a"));
check("html: no banner comments", !/\/\*\s*[-=]{3,}/.test(html));
check("html: no todo markers", !/\b(TODO|FIXME|XXX)\b/.test(html + landing));
check("html: remove button on every block row", /class="bdel"/.test(html));
check("html: no size dropdowns left", !/tksel|colbar|rowbar|sizesbtn/.test(html));

console.log(`${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.log("\nFAILED:"); fail.forEach(f => console.log("  x " + f)); process.exit(1); }
