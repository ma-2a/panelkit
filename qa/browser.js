const path=require("path");const puppeteer=require("puppeteer-core");
async function chromePath(){ if(process.env.CHROME_PATH) return process.env.CHROME_PATH; return await require("@sparticuz/chromium").executablePath(); }
let failed=0;
(async()=>{
  const browser=await puppeteer.launch({executablePath:await chromePath(),args:["--no-sandbox","--disable-gpu"],headless:true});
  const page=await browser.newPage(); await page.setViewport({width:1440,height:1000});
  await page.emulateMediaFeatures([{name:"prefers-color-scheme",value:"dark"}]);
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await page.goto("file://"+path.join(__dirname,"..","builder","index.html"),{waitUntil:"load"});
  await page.evaluate(()=>{ localStorage.clear(); }); await page.reload({waitUntil:"load"});
  const T=(n,c,d)=>{ if(!c) failed++; console.log((c?"ok  ":"FAIL")+" "+n+(c?"":"  "+(d||""))); };
  const grid=()=>page.evaluate(()=>project.views[project.active].rows.map(r=>r.cells.join(" ")).join(" | "));
  const box=async sel=>{ const el=await page.$(sel); return el && await el.boundingBox(); };
  const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
  const dragFrom=async (from,to)=>{ await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(from.x+8,from.y+8,{steps:2}); await page.mouse.move(to.x,to.y,{steps:8}); await page.mouse.up(); await new Promise(r=>setTimeout(r,150)); };

  await page.evaluate(()=>[...document.querySelectorAll("#vtabs .go")].find(b=>b.textContent==="Lights").click());
  const g0=await grid();
  T("lights start", g0.includes("living floorlamp office"), g0);
  const bars=await page.evaluate(()=>({c:document.querySelectorAll("#colbar .tk").length, r:document.querySelectorAll("#rowbar .tk").length, cols:getComputedStyle(document.querySelector("#colbar")).gridTemplateColumns}));
  T("bars match grid", bars.c===4 && bars.r===4 && /px/.test(bars.cols), JSON.stringify(bars));

  let liv=await box('.screen .blk[data-block="living"]'); await page.mouse.click(center(liv).x,center(liv).y); await new Promise(r=>setTimeout(r,100));
  T("click selects", await page.evaluate(()=>state.selected)==="living" && !!(await page.$(".sel-frame")));
  T("sidebar opens block", await page.evaluate(()=>!!document.querySelector('.bitem.open[data-block="living"]')));

  const garden=await box('.screen .blk[data-block="garden"]');
  liv=await box('.screen .blk[data-block="living"]');
  await dragFrom(center(liv), center(garden));
  let g=await grid();
  T("drop on block swaps", g.includes("garden floorlamp office") && g.includes("desk living alloff"), g);

  await page.evaluate(()=>{ histUndo(); });
  T("undo swap", (await grid())===g0, await grid());

  await page.evaluate(()=>{ delete state.blocks.garden; state.rows.forEach(r=>r.cells=r.cells.map(c=>c==="garden"?".":c)); state.selected="desk"; renderAll(); });
  let desk=await box('.screen .blk[data-block="desk"]'); const e=await box('.sel-frame .hd.e');
  T("handles visible", !!e);
  await dragFrom(center(e), {x:center(e).x+desk.width, y:center(e).y});
  g=await grid();
  T("resize east into free cell", g.includes("desk desk alloff"), g);
  const e2=await box('.sel-frame .hd.e');
  await dragFrom(center(e2), {x:center(e2).x+desk.width*2, y:center(e2).y});
  g=await grid();
  T("resize stops at other block", g.includes("desk desk alloff"), g);
  const w=await box('.sel-frame .hd.e');
  const c0=await page.evaluate(()=>{ const g=[...document.querySelectorAll(".screen .gcell")][2*4+0].getBoundingClientRect(); return g.x+g.width/2; });
  await dragFrom(center(w), {x:c0, y:center(w).y});
  g=await grid();
  T("resize shrink", g.includes("desk . alloff"), g);

  desk=await box('.screen .blk[data-block="desk"]');
  const free=await page.evaluate(()=>{ const g=[...document.querySelectorAll(".screen .gcell")][2*4+1].getBoundingClientRect(); return {x:g.x+g.width/2,y:g.y+g.height/2}; });
  await dragFrom(center(desk), free);
  g=await grid();
  T("move into free cell", g.includes(". desk alloff"), g);

  const office=await box('.screen .blk[data-block="office"]');
  await page.mouse.click(center(office).x,center(office).y);
  await page.keyboard.press("ArrowDown");
  g=await grid();
  T("keyboard blocked by other block", g.includes("living floorlamp office"), g);
  await page.evaluate(()=>{ state.selected="desk"; renderAll(); document.querySelector('.screen .blk[data-block="desk"]').focus(); });
  await page.keyboard.press("ArrowLeft");
  g=await grid();
  T("keyboard move", g.includes("desk . alloff"), g);
  await page.keyboard.down("Shift"); await page.keyboard.press("ArrowRight"); await page.keyboard.up("Shift");
  g=await grid();
  T("keyboard resize", g.includes("desk desk alloff"), g);

  const titleBox=await box('.screen .blk[data-block="title"]');
  await page.mouse.click(center(titleBox).x,center(titleBox).y); await new Promise(r=>setTimeout(r,120)); await page.mouse.click(center(titleBox).x,center(titleBox).y);
  await page.keyboard.type("My lights"); await page.keyboard.press("Enter"); await new Promise(r=>setTimeout(r,100));
  T("inline title edit", await page.evaluate(()=>state.blocks.title.text)==="My lights", await page.evaluate(()=>state.blocks.title.text));

  await page.select('#rowbar select[data-row="1"]','min-content');
  T("row size from bar", await page.evaluate(()=>state.rows[1].size)==="min-content");
  await page.click('#addrowbtn');
  T("add row above assist", await page.evaluate(()=>state.rows.length===5 && state.rows[4].cells.includes("assist") && state.rows[3].cells.every(c=>c===".")));
  await page.click('#addcolbtn');
  T("add column before navbar spacer", await page.evaluate(()=>state.cols===5 && state.colSizes[4]==="90px" && state.colSizes[3]==="1fr"));
  await page.hover('#rowbar .tk:nth-child(5)'); await page.click('#rowbar [data-delrow="4"]');
  T("delete row with assist reports it", await page.evaluate(()=>!document.querySelector("#snack").hidden && document.querySelector("#snacktext").textContent.includes("assist")));
  await page.click('#snackundo'); await new Promise(r=>setTimeout(r,100));
  T("undo row delete", await page.evaluate(()=>state.rows.length===5 && state.rows[4].cells.includes("assist")));

  await page.evaluate(()=>{ document.querySelector("#addtoggle").click(); document.querySelector('[data-add="tile"]').click(); });
  T("added block lands on screen", await page.evaluate(()=>usedAreas().includes("tile") && state.selected==="tile"));

  T("no page errors", errs.length===0, errs.join(" | "));
  await browser.close();
  console.log(failed ? `${failed} browser checks failed` : "all browser checks passed");
  process.exit(failed?1:0);
})().catch(e=>{console.error("CRASH",e);process.exit(1)});
