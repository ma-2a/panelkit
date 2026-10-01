const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "builder", "index.html");
const html = fs.readFileSync(FILE, "utf8");
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

const fail = [];
const pass = [];
function check(name, cond, detail) {
  (cond ? pass : fail).push(detail ? `${name} — ${detail}` : name);
}

const stubEl = () => new Proxy(
  { style: {}, options: [], dataset: {}, classList: { add() {}, remove() {} },
    append() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null },
    value: "", textContent: "", innerHTML: "", clientWidth: 900, hidden: false },
  { get: (t, p) => (p in t ? t[p] : () => stubEl()), set: (t, p, v) => { t[p] = v; return true } }
);
global.document = {
  querySelector: () => stubEl(), querySelectorAll: () => [], getElementById: () => null,
  createElement: () => stubEl(), documentElement: stubEl()
};
global.window = { addEventListener() {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.navigator = { clipboard: { writeText: async () => {} } };

const ctx = {};
new Function("with(this){" + src + "; Object.assign(this.__x={}, {TYPES,PRESETS,SCHEMAS,blockDefaults,buildYaml,checks,deps,toYaml,clean,yq,navTarget,cardCfg,areasString,setState:s=>state=s,getState:()=>state})}").call(ctx);
const A = ctx.__x;

let yaml;
try { yaml = require("js-yaml"); } catch (e) { yaml = null; }

function withState(s, fn) { A.setState(s); return fn(); }

for (const [name, preset] of Object.entries(A.PRESETS)) {
  const s = preset();
  const out = withState(s, A.buildYaml);
  check(`preset ${name}: produces yaml`, out.length > 100);
  if (yaml) {
    let doc = null;
    try { doc = yaml.load(out); } catch (e) { check(`preset ${name}: yaml parses`, false, e.message.split("\n")[0]); }
    if (doc) {
      check(`preset ${name}: yaml parses`, true);
      check(`preset ${name}: is button-card`, doc.type === "custom:button-card");
      check(`preset ${name}: has templates`, Array.isArray(doc.template) && doc.template.includes("body_template"));
      const areas = doc.styles.grid.find(g => "grid-template-areas" in g)["grid-template-areas"];
      const rows = areas.trim().split("\n").map(r => r.trim().replace(/"/g, "").split(/\s+/));
      check(`preset ${name}: grid rows equal width`, new Set(rows.map(r => r.length)).size === 1);
      const cols = doc.styles.grid.find(g => "grid-template-columns" in g)["grid-template-columns"].split(/\s+/);
      check(`preset ${name}: column count matches areas`, cols.length === rows[0].length);
      const rowSizes = doc.styles.grid.find(g => "grid-template-rows" in g)["grid-template-rows"].split(/\s+/);
      check(`preset ${name}: row count matches areas`, rowSizes.length === rows.length);
      const used = new Set(rows.flat().filter(c => c !== "."));
      const provided = new Set(["status", "assist"]);
      for (const a of used) {
        if (provided.has(a)) continue;
        check(`preset ${name}: area "${a}" has a custom_field`, doc.custom_fields && a in doc.custom_fields);
      }
      for (const a of Object.keys(doc.custom_fields || {})) {
        const floating = ["navbar", "shader"].includes(a);
        check(`preset ${name}: custom_field "${a}" is placed`, used.has(a) || floating);
      }
    }
  }
  check(`preset ${name}: no warnings`, withState(s, A.checks).length === 0, withState(s, A.checks).join(" / "));
}

const every = A.PRESETS.blank();
every.cols = 2;
every.rows = [{ size: "min-content", cells: ["title", "status"] }];
const types = Object.keys(A.TYPES).filter(t => !["title", "status", "assist"].includes(t));
types.forEach((t, i) => {
  const name = t;
  every.blocks[name] = A.blockDefaults(t);
  if (!A.TYPES[t].floating) every.rows.push({ size: "1fr", cells: [name, name] });
});
every.rows.push({ size: "min-content", cells: ["assist", "assist"] });
const everyOut = withState(every, A.buildYaml);
check("all block types: yaml parses", (() => { try { yaml && yaml.load(everyOut); return true } catch (e) { return false } })());
if (yaml) {
  const doc = yaml.load(everyOut);
  for (const t of types) {
    const cf = doc.custom_fields[t];
    check(`block ${t}: emitted`, cf !== undefined);
    if (A.TYPES[t].hacs === undefined) continue;
    const str = JSON.stringify(cf);
    check(`block ${t}: card config present`, str.includes("custom:") || t === "tile");
  }
  check("navbar: routes present", doc.custom_fields.navbar.card.routes.length > 0);
  check("navbar: floating style absolute", doc.styles.custom_fields.navbar.some(r => r.position === "absolute"));
}

const t = A.PRESETS.blank();
A.setState(t);
check("target: bare name uses dashboard path", A.navTarget("music").v === "/view-assist/music");
check("target: absolute path untouched", A.navTarget("/lovelace/0").v === "/lovelace/0");
check("target: external url", A.navTarget("https://x.dev").kind === "url");
check("target: empty is null", A.navTarget("") === null);
t.vaBase = "/panel";
check("target: custom base path", A.navTarget("clock").v === "/panel/clock");

check("quote: plain token", A.yq("mdi:home") === "mdi:home");
check("quote: hex color quoted", A.yq("#24292c") === '"#24292c"');
check("quote: spaces quoted", A.yq("My title") === '"My title"');
check("quote: yaml keyword quoted", A.yq("on") === '"on"');
check("quote: colon with space quoted", A.yq("a: b") === '"a: b"');
check("quote: injection attempt stays one scalar", A.yq('x\nevil: true') === JSON.stringify("x\nevil: true"));

const esc = A.PRESETS.blank();
esc.blocks.title.text = 'He said "hi" & <b>bold</b>: done';
const escOut = withState(esc, A.buildYaml);
if (yaml) {
  const doc = yaml.load(escOut);
  check("escaping: quotes survive round trip", doc.custom_fields.title === 'He said "hi" & <b>bold</b>: done');
}

const broken = A.PRESETS.blank();
broken.rows = [
  { size: "1fr", cells: ["a", "b"] },
  { size: "1fr", cells: ["b", "a"] }
];
broken.blocks = { a: A.blockDefaults("message"), b: A.blockDefaults("message") };
check("checks: detects non-rectangular area", withState(broken, A.checks).some(m => m.includes("rectangle")));

const unplaced = A.PRESETS.info();
unplaced.blocks.lost = A.blockDefaults("message");
check("checks: detects unplaced block", withState(unplaced, A.checks).some(m => m.includes("not assigned")));

const noassist = A.PRESETS.blank();
noassist.rows = noassist.rows.filter(r => !r.cells.includes("assist"));
delete noassist.blocks.assist;
check("checks: warns about missing assist", withState(noassist, A.checks).some(m => m.includes("assist")));

const twonav = A.PRESETS.info();
twonav.blocks.n1 = A.blockDefaults("navbar");
twonav.blocks.n2 = A.blockDefaults("navbar");
check("checks: warns about two navbars", withState(twonav, A.checks).some(m => m.includes("More than one navbar")));

const h = A.PRESETS.home();
check("deps: lists navbar + mushroom + media + weather", (() => {
  const d = withState(h, A.deps);
  return ["button-card", "Navbar Card", "Mushroom", "Mini Media Player", "Clock Weather Card"].every(x => d.includes(x));
})());
check("deps: blank view needs button-card only", withState(A.PRESETS.blank(), A.deps).length === 1);

const idem = A.PRESETS.home();
check("determinism: same state yields same yaml", withState(idem, A.buildYaml) === withState(idem, A.buildYaml));

check("html: single file, no local assets", !/(src|href)="(?!https:\/\/fonts|\.\.\/|https:\/\/github|https:\/\/ko-fi|#)[^"]/.test(html));
check("html: every localStorage call guarded", html.split("localStorage").slice(0, -1).every(part => /try\s*\{[^{}]*$/.test(part.slice(-80))));
check("html: lang is en", /<html lang="en"/.test(html));
check("html: has viewport-fit", /viewport-fit=cover/.test(html));
check("html: has title", /<title>[^<]{5,}<\/title>/.test(html));
check("html: dark theme tokens", /prefers-color-scheme: dark/.test(html));
check("html: no leftover german", !/[äöüßÄÖÜ]/.test(html));
check("html: kofi link present", html.includes("https://ko-fi.com/ma2a"));
check("html: no banner comments", !/\/\*\s*[-=]{3,}/.test(html));
check("html: no todo markers", !/\b(TODO|FIXME|XXX|placeholder text)\b/i.test(html));

console.log(`${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
  console.log("\nFAILED:");
  fail.forEach(f => console.log("  ✗ " + f));
  process.exit(1);
}
