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
  { style: { setProperty() {} }, options: [], dataset: {}, classList: { add() {}, remove() {} },
    append() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null }, querySelector() { return stubEl() },
    querySelectorAll() { return [] }, value: "", textContent: "", innerHTML: "", clientWidth: 900, hidden: false },
  { get: (t, p) => (p in t ? t[p] : () => stubEl()), set: (t, p, v) => { t[p] = v; return true } }
);
global.document = {
  querySelector: () => stubEl(), querySelectorAll: () => [], getElementById: () => null, addEventListener() {},
  createElement: () => stubEl(), documentElement: stubEl()
};
global.window = { addEventListener() {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.navigator = { clipboard: { writeText: async () => {} } };

const ctx = {};
new Function("with(this){" + src +
  "; this.__x = {TYPES,PRESETS,SCHEMAS,DEVICES,blockDefaults,buildYaml,checks,deps,yq,navTarget,tapFor,cardCfg,hacsOf," +
  "removeBlock,undoRemove,addBlock,paintCell,deviceSize,newProject,switchView,addView,deleteView,moveView,duplicateView," +
  "buildAllViews,effectiveRoutes,applyNavbarEverywhere,hexOr,load,TABSET," +
  "setState:s=>{ if(!project||!project.views.includes(s)) project=newProject([s]); state=s; }," +
  "setProject:p=>{ project=p; state=p.views[p.active]; }, getProject:()=>project, getState:()=>state}}").call(ctx);
const A = ctx.__x;
const run = (s, fn) => { A.setState(s); return fn(); };
const parse = out => yaml.load(out);

function gridOf(doc) {
  const g = k => doc.styles.grid.find(x => k in x)[k];
  const rows = g("grid-template-areas").trim().split("\n").map(r => r.trim().replace(/"/g, "").split(/\s+/));
  return { rows, cols: String(g("grid-template-columns")).split(/\s+/), sizes: String(g("grid-template-rows")).split(/\s+/) };
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

const rm = A.PRESETS.lights(); A.setState(rm);
A.removeBlock("garden");
let st = A.getState();
check("remove: block gone", !("garden" in st.blocks));
check("remove: cells cleared", st.rows.every(r => !r.cells.includes("garden")));
check("remove: no warning about it", run(st, A.checks).every(m => !m.includes("garden")));
A.undoRemove(); st = A.getState();
check("undo: block back", "garden" in st.blocks);
check("undo: cells back", st.rows[2].cells[1] === "garden");
check("undo: order kept", Object.keys(st.blocks).indexOf("garden") === Object.keys(A.PRESETS.lights().blocks).indexOf("garden"));

const add = A.PRESETS.blank(); A.setState(add);
A.addBlock("mlight"); st = A.getState();
check("add: block created and selected", st.selected === "light" && st.blocks.light.type === "mlight");
check("add: unplaced is flagged", run(st, A.checks).some(m => m.includes("not on the grid")));
A.paintCell(st.rows[1], 0); A.paintCell(st.rows[1], 1);
check("paint: cells assigned", st.rows[1].cells.join() === "light,light");
check("paint: warning gone", !run(st, A.checks).some(m => m.includes("not on the grid")));
A.paintCell(st.rows[1], 1);
check("paint: tapping own cell clears it", st.rows[1].cells[1] === ".");

const bad = A.PRESETS.blank();
bad.rows = [{ size: "1fr", cells: ["a", "b"] }, { size: "1fr", cells: ["b", "a"] }];
bad.blocks = { a: A.blockDefaults("message"), b: A.blockDefaults("message") };
check("checks: non-rectangular area", run(bad, A.checks).some(m => m.includes("rectangle")));
const noAssist = A.PRESETS.blank(); noAssist.rows.pop(); delete noAssist.blocks.assist;
check("checks: missing assist", run(noAssist, A.checks).some(m => m.includes("assist")));
const covered = A.PRESETS.info(); covered.blocks.navbar = A.blockDefaults("navbar");
check("checks: navbar covering content", run(covered, A.checks).some(m => m.includes("covers")));
const two = A.PRESETS.infonav(); two.blocks.n2 = A.blockDefaults("navbar");
check("checks: two navbars", run(two, A.checks).some(m => m.includes("more than one navbar")));

check("devices: Echo Show 5 is 960x480", (() => { const d = A.DEVICES.find(x => x.id === "echo5"); return d && d.w === 960 && d.h === 480; })());
check("devices: Echo Show 8 present", A.DEVICES.some(x => x.label === "Echo Show 8"));
check("devices: custom size option", A.DEVICES.some(x => x.id === "custom"));
const cs = A.PRESETS.blank(); A.setState(cs); Object.assign(A.getProject(), { device: "custom", customW: 1024, customH: 768 });
check("devices: custom size used", JSON.stringify(A.deviceSize()) === "[1024,768]");
check("devices: default is Echo Show 5", A.newProject([]).device === "echo5");

const def = A.load();
check("project: default is the tab set", def.views.map(v => v.name).join() === "home,camera,music,lights,calendar");

let P = tabProject(); A.setProject(P);
A.addView("tabset");
check("project: tab set not duplicated", A.getProject().views.length === 5);
A.addView("home");
check("project: added view gets unique name", A.getProject().views[5].name === "home2" && A.getProject().active === 5);
A.addView("blank");
check("project: blank view named view", A.getProject().views[6].name === "view");
A.deleteView(5);
check("project: view deleted", A.getProject().views.length === 6 && !A.getProject().views.some(v => v.name === "home2"));
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
  check("export: titles from labels", allDoc[0].title === "Home");
}
const dupName = A.newProject([A.PRESETS.info(), A.PRESETS.info()]); A.setProject(dupName);
check("checks: duplicate view names", A.checks().some(m => m.includes("also called")));

const mix = A.newProject([A.PRESETS.home(), A.PRESETS.info(), A.PRESETS.timers()]); A.setProject(mix);
A.getState().blocks.navbar.look = "pill";
A.applyNavbarEverywhere("navbar");
check("navbar: copied to views without one", mix.views.every(v => Object.values(v.blocks).some(b => b.type === "navbar" && b.look === "pill")));
check("navbar: copies leave a free edge", mix.views.every(v => { A.setProject(Object.assign(mix, { active: mix.views.indexOf(v) })); return !A.checks().some(m => m.includes("covers")); }));
check("navbar: copies produce valid yaml", mix.views.every(v => { mix.active = mix.views.indexOf(v); A.setProject(mix); try { parse(A.buildYaml()); return true } catch (e) { return false } }));

check("color: hex kept", A.hexOr("#FF7A3D", "#000000") === "#ff7a3d");
check("color: short hex expanded", A.hexOr("#abc", "#000000") === "#aabbcc");
check("color: rgba falls back", A.hexOr("rgba(0,0,0,.4)", "#123456") === "#123456");

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

console.log(`${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.log("\nFAILED:"); fail.forEach(f => console.log("  x " + f)); process.exit(1); }
