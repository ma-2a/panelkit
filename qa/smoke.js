const {JSDOM}=require("jsdom");const fs=require("fs");const path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","builder","index.html"),"utf8");
const errors=[];
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://ma-2a.github.io/panelkit/builder/"});
const w=dom.window; w.addEventListener("error",e=>errors.push(e.message));
w.HTMLElement.prototype.scrollIntoView=function(){};
const d=w.document; const $=s=>d.querySelector(s); const $$=s=>[...d.querySelectorAll(s)];
const fire=(el,type="change")=>el.dispatchEvent(new w.Event(type,{bubbles:true}));
let steps=0; const step=(name,fn)=>{ try{fn();steps++;}catch(e){errors.push(name+": "+e.message);} };

step("initial render", ()=>{ if(!$$(".bitem").length) throw new Error("no blocks"); });
for(const p of ["home","camera","music","lights","calendar","info","infonav","infopic","timers","split","blank"]){
  step("preset "+p, ()=>{
    const s=$("#preset"); s.value=p; fire(s);
    const items=$$(".bitem");
    items.forEach((li,i)=>{
      const b=$$(".bitem")[i].querySelector(".bsel"); b.click();
      const open=$(".bitem.open");
      if(open){ open.querySelectorAll("input[type=text],select,textarea").forEach(x=>fire(x)); open.querySelectorAll("input[type=checkbox]").forEach(x=>{x.click();x.click();}); }
    });
    if(!$("#yaml").textContent.startsWith("type: custom:button-card")) throw new Error("yaml missing");
  });
}
step("open picker and add every type", ()=>{
  $("#preset").value="blank"; fire($("#preset"));
  const types=[...new Set($$("[data-add]").map(b=>b.dataset.add))];
  types.forEach(t=>{ $("#addtoggle").click(); const b=d.querySelector(`[data-add="${t}"]`); b.click(); });
  if($$(".bitem").length<types.length) throw new Error("not all added");
});
step("navbar editor", ()=>{
  $("#preset").value="infonav"; fire($("#preset"));
  const nav=$$(".bitem").find(li=>li.dataset.block==="navbar"); if(!nav.classList.contains("open")) nav.querySelector(".bsel").click();
  $$("[data-look]").forEach(b=>b.click());
  $("#n-add").click(); $$("[data-rmv]")[0].click(); $$("[data-rdel]")[0].click();
  const pos=$("#n-pos"); pos.value="left"; fire(pos);
});
step("chips editor", ()=>{
  $("#preset").value="home"; fire($("#preset"));
  const li=$$(".bitem").find(x=>x.dataset.block==="chips"); li.querySelector(".bsel").click();
  $("#c-add").click(); const k=$$("[data-k=kind]")[0]; k.value="action"; fire(k); $$("[data-cdel]")[0].click();
});
step("remove and undo via list", ()=>{
  $("#preset").value="lights"; fire($("#preset"));
  const before=$$(".bitem").length;
  $$(".bitem").find(x=>x.dataset.block==="garden").querySelector(".bdel").click();
  if($$(".bitem").length!==before-1) throw new Error("not removed");
  if($("#snack").hidden) throw new Error("no snackbar");
  $("#snackundo").click();
  if($$(".bitem").length!==before) throw new Error("undo failed");
});
step("remove via inspector button", ()=>{
  const li=$$(".bitem").find(x=>x.dataset.block==="desk"); li.querySelector(".bsel").click();
  $("#i-del").click(); if($$(".bitem").some(x=>x.dataset.block==="desk")) throw new Error("still there");
});
step("paint and erase", ()=>{
  $("#preset").value="blank"; fire($("#preset"));
  $("#addtoggle").click(); d.querySelector('[data-add="tile"]').click();
  const cells=$$("#painter .cell"); cells[2].click(); cells[3].click();
  if(!$("#yaml").textContent.includes('"tile tile"')) throw new Error("not painted");
  d.querySelector('[data-g="clear"]').click(); $$("#painter .cell")[2].click();
  if(!$("#yaml").textContent.includes('". tile"')) throw new Error("not erased");
});
step("grid tools", ()=>{ ["addrow","addcol","delcol","delrow"].forEach(g=>d.querySelector(`[data-g="${g}"]`).click()); });
step("devices", ()=>{
  const s=$("#device"); for(const o of [...s.options]){ s.value=o.value; fire(s); }
  s.value="custom"; fire(s); if($("#customsize").hidden) throw new Error("custom inputs hidden");
  $("#cw").value="1024"; fire($("#cw")); if(!/1024 × 800/.test($("#devlabel").textContent)) throw new Error("label "+$("#devlabel").textContent);
});
step("rename block", ()=>{
  $("#preset").value="info"; fire($("#preset"));
  const n=$("#i-name"); n.value="Body Text"; fire(n);
  if(!$$(".bitem").some(x=>x.dataset.block==="body_text")) throw new Error("rename failed");
  if(!$("#yaml").textContent.includes("body_text")) throw new Error("yaml not renamed");
});
step("view settings", ()=>{ const m=$("#bgmode"); for(const v of ["fixed","satellite","color"]){ m.value=v; fire(m);} });
step("tabs", ()=>{ $$(".tabs button").forEach(b=>b.click()); });
step("theme", ()=>{ $("#themebtn").click(); $("#themebtn").click(); });
step("persistence", ()=>{ const raw=w.localStorage.getItem("panelkit.view"); if(!raw||!JSON.parse(raw).rows) throw new Error("not saved"); });
step("legacy state migrates", ()=>{
  w.localStorage.setItem("panelkit.view", JSON.stringify({name:"x",cols:1,colSizes:["1fr"],rows:[{size:"1fr",cells:["assist"]}],blocks:{assist:{type:"assist",style:{}}},device:"1280x800"}));
  const dom2=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://ma-2a.github.io/panelkit/builder/"});
});
step("middle dot in rendered UI", ()=>{ if(/\u00b7/.test(d.body.textContent)) throw new Error("found ·"); });
console.log(`${steps} steps ok, ${errors.length} errors`); errors.forEach(e=>console.log("  x "+e));
process.exit(errors.length?1:0);
