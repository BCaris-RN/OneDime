/*  (o) OneDime | public/accessibility.ts
 *  ----------------------------------------------------------
 *  Shared table semantics and focus protection around the docked and floating pad.
 */
import { movePaneAway } from "./pad.js";
const captions: Record<string,string> = {
  sPlatBody:"Spotlight platform totals (all time)",jPlatBody:"Freelance platform totals (all time)",
  dPlatBody:"Delivery and service platform totals (all time)",sPlatBody2:"Store totals (all time)",
  sIncBody:"Spotlight income",sDealBody:"Brand deals",jBody:"Freelance gigs",dBody:"Delivery and service shifts",
  xBody:"Sales",sExpBody:"Spotlight expenses"
};
function tables() {
  for(const table of document.querySelectorAll("table")) {
    if(!table.caption) {
      const body=table.tBodies[0];
      const title=body?.id.startsWith("expenses-")?`${body.id.slice(9).replaceAll("_"," ")} expenses`:
        captions[body?.id??""]??(table.closest(".slip,.workspace-section,section")?.querySelector("h2")?.textContent??"Workspace records");
      table.createCaption().textContent=title;
    }
    for(const th of table.querySelectorAll("thead th")) if(!th.hasAttribute("scope"))th.setAttribute("scope","col");
    for(const text of table.querySelectorAll("th .hide"))text.classList.replace("hide","sr-only");
    let wrap=table.closest<HTMLElement>(".tablewrap,.table-scroll");
    if(!wrap) { wrap=document.createElement("div");wrap.className="tablewrap";table.before(wrap);wrap.append(table); }
    if(!wrap.hasAttribute("tabindex"))wrap.tabIndex=0;
    wrap.setAttribute("role","region");wrap.setAttribute("aria-label",`${table.caption!.textContent} table`);
  }
}
function clearPane(target:HTMLElement,pane:HTMLElement,offsetTop:number,height:number) {
  const gap=12,top=offsetTop+gap,bottom=offsetTop+height-gap;
  const covered=()=>{
    const a=target.getBoundingClientRect(),b=pane.getBoundingClientRect();
    return a.left<b.right+4&&a.right>b.left-4&&a.top<b.bottom+4&&a.bottom>b.top-4;
  };
  const a=target.getBoundingClientRect(),b=pane.getBoundingClientRect();
  // A region taller than half the screen overlaps the pane wherever it sits; only its edge shows focus.
  if(!covered()||a.height>height/2)return;
  const up=a.bottom-(b.top-gap),down=a.top-(b.bottom+gap);
  // Scroll the control clear of the pane when it still fits on screen; otherwise move the pane.
  if(a.top-up>=top)window.scrollBy({top:up,behavior:"instant"});
  else if(a.bottom-down<=bottom)window.scrollBy({top:down,behavior:"instant"});
  if(covered())movePaneAway();
}
function protectFocus() {
  const target=document.activeElement;
  const controls=document.querySelector<HTMLElement>(".controls");
  if(!(target instanceof HTMLElement)||!controls||controls.contains(target)||controls.classList.contains("in-dialog"))return;
  const viewport=visualViewport;
  if(controls.classList.contains("is-floating")) {
    clearPane(target,controls,viewport?.offsetTop??0,viewport?.height??innerHeight);
    return;
  }
  if(!matchMedia("(max-width:520px)").matches)return;
  const top=(viewport?.offsetTop??0)+12;
  const bottom=Math.min(controls.getBoundingClientRect().top,(viewport?.height??innerHeight)+(viewport?.offsetTop??0))-12;
  const rect=target.getBoundingClientRect();
  if(rect.height>bottom-top) {
    if(rect.top<top||rect.top>bottom-32)window.scrollBy({top:rect.top-top,behavior:"instant"});
    return;
  }
  if(rect.bottom>bottom)window.scrollBy({top:rect.bottom-bottom,behavior:"instant"});
  else if(rect.top<top)window.scrollBy({top:rect.top-top,behavior:"instant"});
}
document.addEventListener("focusin",()=>requestAnimationFrame(protectFocus));
visualViewport?.addEventListener("resize",protectFocus);
window.addEventListener("resize",()=>requestAnimationFrame(protectFocus));
new MutationObserver(tables).observe(document.getElementById("main")!,{subtree:true,childList:true});
tables();
