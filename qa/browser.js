const path = require("path");
const puppeteer = require("puppeteer-core");
async function chromePath() { if (process.env.CHROME_PATH) return process.env.CHROME_PATH; return await require("@sparticuz/chromium").executablePath(); }
let failed = 0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: await chromePath(), args: ["--no-sandbox", "--disable-gpu"], headless: true });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  const file = "file://" + path.join(__dirname, "..", "builder", "index.html");
  await page.goto(file, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: "load" });
  const T = (n, c, d) => { if (!c) failed++; console.log((c ? "ok  " : "FAIL") + " " + n + (c ? "" : "  " + (d || ""))); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rect = n => page.evaluate(n => rectOf(state, n), n);
  const cell = (r, c) => page.evaluate((r, c) => { const g = [...document.querySelectorAll(".screen .gcell")][r * 12 + c].getBoundingClientRect(); return { x: g.x + g.width / 2, y: g.y + g.height / 2 }; }, r, c);
  const box = async s => { const b = await (await page.$(s)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const drag = async (from, to) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 6, from.y + 6, { steps: 2 }); await page.mouse.move(to.x, to.y, { steps: 10 }); await page.mouse.up(); await wait(120); };
  const issues = () => page.evaluate(() => issues().map(i => i.text));

  await page.evaluate(() => [...document.querySelectorAll("#vtabs .go")].find(b => b.textContent === "Lights").click());
  T("no size menus", await page.evaluate(() => !document.querySelector("select.tksel, #colbar, #rowbar")));
  T("starts clean", (await issues()).length === 0);

  const liv0 = await rect("living"), gar0 = await rect("garden");
  await page.click('.screen .blk[data-block="living"]'); await wait(80);
  T("click selects and opens settings", await page.evaluate(() => state.selected === "living" && !!document.querySelector('.bitem.open[data-block="living"]')));
  T("eight handles", await page.evaluate(() => document.querySelectorAll(".sel-frame [data-h]").length === 8));

  await drag(await box('.screen .blk[data-block="living"]'), await cell(gar0.r + 1, gar0.c + 1));
  T("drop on block swaps", JSON.stringify(await rect("living")) === JSON.stringify(gar0) && JSON.stringify(await rect("garden")) === JSON.stringify(liv0));
  await page.evaluate(() => histUndo());
  T("undo swap", JSON.stringify(await rect("living")) === JSON.stringify(liv0));

  const fl0 = await rect("floorlamp");
  await page.click('.screen .blk[data-block="living"]'); await wait(80);
  await drag(await box(".sel-frame .hd.e"), await cell(liv0.r, liv0.c + liv0.w + 1));
  const liv1 = await rect("living"), fl1 = await rect("floorlamp");
  T("pull right edge, neighbour makes room", liv1.w === liv0.w + 2 && fl1.c === fl0.c + 2 && fl1.w === fl0.w - 2, JSON.stringify([liv1, fl1]));
  await drag(await box(".sel-frame .hd.s"), await cell(liv1.r + liv1.h, liv1.c));
  const liv2 = await rect("living"), desk2 = await rect("desk");
  T("pull bottom edge, block below makes room", liv2.h === liv1.h + 1 && desk2.r === liv2.r + liv2.h, JSON.stringify([liv2, desk2]));
  await drag(await box(".sel-frame .hd.se"), await cell(liv2.r + liv2.h - 2, liv2.c + liv2.w - 3));
  const liv3 = await rect("living");
  T("corner shrinks both ways", liv3.w === liv2.w - 2 && liv3.h === liv2.h - 1, JSON.stringify(liv3));
  T("still valid", (await issues()).length === 0, (await issues()).join(" | "));

  const free = await cell(liv3.r, liv3.c + liv3.w);
  const before = await rect("living");
  await drag(await box('.screen .blk[data-block="living"]'), free);
  const moved = await rect("living");
  T("drag into free space moves", moved.c > before.c || moved.r !== before.r, JSON.stringify([before, moved]));

  await page.evaluate(() => { state.selected = "desk"; renderAll(); document.querySelector('.screen .blk[data-block="desk"]').focus(); });
  const d0 = await rect("desk");
  await page.keyboard.down("Shift"); await page.keyboard.press("ArrowRight"); await page.keyboard.up("Shift");
  T("keyboard resize", (await rect("desk")).w === d0.w + 1);

  const tb = await box('.screen .blk[data-block="title"]');
  await page.mouse.click(tb.x, tb.y); await wait(120); await page.mouse.click(tb.x, tb.y);
  await page.keyboard.type("My lights"); await page.keyboard.press("Enter"); await wait(100);
  T("inline title edit", await page.evaluate(() => state.blocks.title.text) === "My lights");

  await page.evaluate(() => { document.querySelector("#addtoggle").click(); document.querySelector('[data-add="camera"]').click(); });
  T("new block on a full screen", await page.evaluate(() => usedAreas().includes("camera")) && (await issues()).length === 0, (await issues()).join(" | "));

  const y = await page.evaluate(() => document.querySelector("#g-view").textContent);
  T("yaml uses the fine grid and a navbar strip", /grid-template-columns: repeat\(12, 1fr\) 90px/.test(y) && /grid-template-rows: repeat\(12, 1fr\)/.test(y));
  T("no page errors", errs.length === 0, errs.join(" | "));
  await browser.close();
  console.log(failed ? `${failed} browser checks failed` : "all browser checks passed");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
