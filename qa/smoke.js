const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "builder", "index.html"), "utf8");
const URL = "https://ma-2a.github.io/panelkit/builder/";
const errors = [];
let steps = 0;

function boot(storage) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: URL,
    beforeParse(w) {
      w.HTMLElement.prototype.scrollIntoView = function () {};
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
    }
  });
  dom.window.addEventListener("error", e => errors.push(e.message));
  return dom.window;
}

let w = boot();
let d = w.document;
const $ = s => d.querySelector(s);
const $$ = s => [...d.querySelectorAll(s)];
const fire = (el, type = "change") => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const step = (name, fn) => { try { fn(); steps++; } catch (e) { errors.push(name + ": " + e.message); } };
const tabs = () => $$("#vtabs .vtab");
const activeName = () => $("#viewname").value;

step("starts with the tab set", () => {
  const names = $$("#vtabs .go").map(t => t.textContent.trim());
  if (names.join() !== "🏠Home,📹Camera,🎵Music,💡Lights,📅Calendar") throw new Error(names.join());
});

step("switch views and edit every block", () => {
  tabs().forEach((_, i) => {
    $$("#vtabs .go")[i].click();
    if (!$$("#vtabs .vtab")[i].classList.contains("on")) throw new Error("tab " + i + " not active");
    $$(".bitem").forEach((li, j) => {
      $$(".bitem")[j].querySelector(".bsel").click();
      const open = $(".bitem.open");
      if (open) {
        open.querySelectorAll("input[type=text],select,textarea").forEach(x => fire(x));
        open.querySelectorAll("input[type=checkbox]").forEach(x => { x.click(); x.click(); });
      }
    });
    if (!$("#yaml").textContent.startsWith("type: custom:button-card")) throw new Error("no yaml");
    if ($("#yamlname").textContent !== activeName()) throw new Error("yaml label out of sync");
  });
});

step("add every kind of view from the menu", () => {
  const ids = $$("#addmenu [data-view]").map(b => b.dataset.view);
  for (const id of ids) {
    $("#addview").click();
    if ($("#addmenu").hidden) throw new Error("menu did not open");
    d.querySelector(`#addmenu [data-view="${id}"]`).click();
    if (!$("#addmenu").hidden) throw new Error("menu did not close");
  }
  const names = $$("#vtabs .go").map(b => b.dataset.vi);
  if (names.length < 14) throw new Error("only " + names.length + " views");
});

step("delete a view and undo", () => {
  const before = tabs().length;
  const victim = $$("#vtabs .go")[2].textContent;
  $$("#vtabs [data-vx]")[2].click();
  if (tabs().length !== before - 1) throw new Error("not deleted");
  if ($("#snack").hidden || $("#snackundo").hidden) throw new Error("no undo");
  $("#snackundo").click();
  if (tabs().length !== before || $$("#vtabs .go")[2].textContent !== victim) throw new Error("undo failed");
});

step("delete via view settings", () => {
  const before = tabs().length;
  $$("#vtabs .go")[before - 1].click();
  $("#vdel").click();
  if (tabs().length !== before - 1) throw new Error("not deleted");
});

step("move, duplicate and rename", () => {
  $$("#vtabs .go")[1].click();
  const n = activeName();
  $("#vright").click();
  if ($$("#vtabs .go")[2].textContent.indexOf("Camera") < 0) throw new Error("move failed");
  $("#vdup").click();
  if (activeName() !== n + "_copy") throw new Error("dup name " + activeName());
  $("#viewname").value = "Front Door"; fire($("#viewname"));
  if (activeName() !== "front_door") throw new Error("rename " + activeName());
  $("#viewlabel").value = "Door"; fire($("#viewlabel"));
  $("#viewicon").value = "mdi:door"; fire($("#viewicon"));
  if (!$$("#vtabs .vtab.on")[0].textContent.includes("Door")) throw new Error("label not in tab");
});

step("navbar follows views and can go manual", () => {
  $$("#vtabs .go")[0].click();
  const nav = $$(".bitem").find(x => x.dataset.block === "navbar");
  if (!nav.classList.contains("open")) nav.querySelector(".bsel").click();
  if (!$(".syncnote")) throw new Error("no sync note");
  const routes = (($("#yaml").textContent.match(/- url: /g)) || []).length;
  if (routes !== tabs().length) throw new Error(`routes ${routes} vs views ${tabs().length}`);
  $("#n-sync").click();
  if ($(".syncnote") || !$("#n-add")) throw new Error("manual editor missing");
  $("#n-add").click(); $$("[data-rdel]")[0].click();
  $("#n-sync").click();
  if (!$(".syncnote")) throw new Error("sync not restored");
});

step("navbar copied to every view", () => {
  $("#n-all").click();
  const missing = [];
  $$("#vtabs .go").forEach((b, i) => {
    $$("#vtabs .go")[i].click();
    if (!$$(".bitem").some(x => x.querySelector(".btype").textContent === "Navbar")) missing.push(activeName());
    if ([...$("#warnings").querySelectorAll(".alert")].some(a => a.textContent.includes("covers"))) missing.push(activeName() + " covered");
  });
  if (missing.length) throw new Error(missing.join(", "));
});

step("color pickers", () => {
  $("#bgcolorc").value = "#ff7a3d"; fire($("#bgcolorc"), "input"); fire($("#bgcolorc"));
  if ($("#bgcolor").value !== "#ff7a3d") throw new Error("base color text not synced");
  if (!$("#yaml").textContent.includes('background-color: "#ff7a3d"')) throw new Error("base color not in yaml");
  $$("#vtabs .go")[0].click();
  const nav = $$(".bitem").find(x => x.dataset.block === "navbar");
  if (!nav.classList.contains("open")) nav.querySelector(".bsel").click();
  $("#n-bgc").value = "#112233"; fire($("#n-bgc"));
  if (!$("#yaml").textContent.includes("background: #112233")) throw new Error("navbar bg not in yaml");
  const other = $$(".bitem").find(x => x.dataset.block === "clockweather");
  other.querySelector(".bsel").click();
  d.querySelector("details.sty").open = true;
  $("#s-bgc").value = "#334455"; fire($("#s-bgc"));
  if (!$("#yaml").textContent.includes("background: #334455")) throw new Error("area bg not in yaml");
});

step("copy all views button", () => { $("#copyall").click(); });

step("blocks: add, remove, undo", () => {
  $("#addtoggle").click(); d.querySelector('[data-add="tile"]').click();
  const n = $$(".bitem").length;
  $$(".bitem").find(x => x.dataset.block === "tile").querySelector(".bdel").click();
  if ($$(".bitem").length !== n - 1) throw new Error("not removed");
  $("#snackundo").click();
  if ($$(".bitem").length !== n) throw new Error("undo failed");
});

step("grid tools and eraser", () => {
  ["addrow", "addcol", "delcol", "delrow"].forEach(g => d.querySelector(`[data-g="${g}"]`).click());
  d.querySelector('[data-g="clear"]').click();
  if (d.querySelector('[data-g="clear"]').getAttribute("aria-pressed") !== "true") throw new Error("eraser state");
  d.querySelector('[data-g="clear"]').click();
});

step("devices", () => {
  const s = $("#device");
  for (const o of [...s.options]) { s.value = o.value; fire(s); }
  s.value = "custom"; fire(s);
  $("#cw").value = "1024"; fire($("#cw"));
  if (!/1024 × 800/.test($("#devlabel").textContent)) throw new Error($("#devlabel").textContent);
});

step("pane tabs and theme", () => {
  $$(".tabs button").forEach(b => b.click());
  $("#themebtn").click(); $("#themebtn").click();
});

step("project persists across reload", () => {
  const saved = w.localStorage.getItem("panelkit.project");
  const count = tabs().length;
  const w2 = boot({ "panelkit.project": saved });
  const n2 = w2.document.querySelectorAll("#vtabs .vtab").length;
  if (n2 !== count) throw new Error(`${n2} vs ${count}`);
});

step("old single view migrates", () => {
  const legacy = JSON.stringify({ name: "legacy", cols: 1, colSizes: ["1fr"], rows: [{ size: "1fr", cells: ["assist"] }],
    blocks: { assist: { type: "assist", style: {} } }, device: "1280x800", vaBase: "/va/" });
  const w3 = boot({ "panelkit.view": legacy });
  const tabs3 = [...w3.document.querySelectorAll("#vtabs .go")].map(b => b.textContent);
  if (tabs3.length !== 1 || !tabs3[0].includes("Legacy")) throw new Error(tabs3.join());
  if (w3.document.querySelector("#device").value !== "echo8") throw new Error("device " + w3.document.querySelector("#device").value);
  if (w3.document.querySelector("#vabase").value !== "/va/") throw new Error("base path");
});

step("no middle dots in the UI", () => { if (/\u00b7/.test(d.body.textContent)) throw new Error("found one"); });

console.log(`${steps} steps ok, ${errors.length} errors`);
errors.forEach(e => console.log("  x " + e));
process.exit(errors.length ? 1 : 0);
