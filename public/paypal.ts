/*  (o) OneDime | public/paypal.ts
 *  ----------------------------------------------------------
 *  Private activity review; a confirmation creates or links one record.
 */
import { request, showApp, toast } from "./workspaces.js";
import { creatorPlatforms, freelancePlatforms, deliveryPlatforms, stores } from "../src/ledger/options.js";
type Payment = { id:string;txn_id:string;occurred_on:string;payer:string;gross_cents:number;fee_cents:number;net_cents:number;currency:string;kind:string;
  routed_app:string|null;routed_record_type:string|null;routed_record_id:string|null;eligible:boolean;mismatch:boolean;
  suggestion:{record_type:string;platform:string;app:string;confidence:number}|null };
type Payload = { connection:{name:string|null;verified:boolean|null};month:string;rows:Payment[];unrouted:number;totalsByApp:Record<string,number>;totalsByMonth:Record<string,Record<string,number>> };
const el=(id:string)=>document.getElementById(id)!;
const money=(cents:number,currency="USD")=>`${currency==="USD"?"$":currency+" "}${(cents/100).toFixed(2)}`;
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;}
function button(text:string,action:()=>void){const b=node("button",text);b.type="button";b.className="act small";b.addEventListener("click",action);return b;}
const types = { first:{label:"First Dime",app:"first",path:"/entries",platforms:["Prolific","Rev","TranscribeMe","SideShift","Microworkers","Other"]},
  income:{label:"Spotlight",app:"spotlight",path:"/spotlight/income",platforms:creatorPlatforms},
  gigs:{label:"Freelance",app:"freelance",path:"/freelance/gigs",platforms:freelancePlatforms},
  shifts:{label:"Market: delivery",app:"market_delivery",path:"/market/shifts",platforms:deliveryPlatforms},
  sales:{label:"Market: selling",app:"market_selling",path:"/market/sales",platforms:stores} };
type RecordType=keyof typeof types;
function labelControl(label:string,control:HTMLElement){const l=node("label",label);l.append(control);return l;}
const panel=node("section");panel.className="slip row";panel.append(node("h2","PayPal activity"));
const connection=node("p");connection.id="paypal-status";
const activity=node("a","Open sandbox PayPal activity");activity.href="https://www.sandbox.paypal.com/myaccount/transactions/";activity.target="_blank";activity.rel="noopener noreferrer";
const explain=node("p","Upload your own activity CSV. Only date, payer, gross, fee, net, currency, transaction ID and type are saved. The file and other columns are discarded. Use an English-column CSV with US or ISO dates. Only incoming USD payments can be routed.");
const warning=node("p","CSV matching labels your First Dime entry with source paypal_csv when payer and net amount match. It does not authenticate the file with PayPal. Each payment belongs to one workspace.");warning.className="muted";
const importForm=node("form"),file=node("input");file.type="file";file.accept=".csv,text/csv";file.required=true;file.id="paypal-csv";
const submit=node("button","Import activity CSV");submit.className="act";submit.type="submit";importForm.append(labelControl("Activity CSV (up to 512 KB, 1,000 rows)",file),submit);
const filter=node("select");filter.id="paypal-filter";for(const [value,text] of [["all","All payments"],["first","First Dime"],["spotlight","Spotlight"],["freelance","Freelance"],["market_delivery","Market: delivery"],["market_selling","Market: selling"]]){const option=node("option",text);option.value=value;filter.append(option);}
const stats=node("dl");stats.className="stats";stats.id="paypal-stats";
const monthly=node("div");monthly.className="tablewrap";monthly.id="paypal-monthly";
const review=node("div");review.id="paypal-review";review.className="row";
const refresh=button("Refresh activity",()=>void load());const ai=node("div");ai.id="paypal-ai";
panel.append(connection,activity,explain,warning,importForm,stats,monthly,labelControl("Review workspace",filter),refresh,ai,review);
el("paypal-connection").parentElement!.replaceWith(panel);
const settings=node("section");settings.className="slip row";settings.append(node("h2","Settings"),node("p","Sandbox milestone bonuses are off by default. Google Sheets connection is not enabled; use file exports to import into a new sheet."));el("app-paypal").append(settings);
let payload:Payload|null=null,loading=false;
const strips=new Map<string,HTMLElement>();
for(const app of ["first","spotlight","freelance","market"]){const strip=node("div");strip.className="paypal-strip";el(`app-${app}`).prepend(strip);strips.set(app,strip);}
function badges(){
  for(const row of document.querySelectorAll<HTMLElement>("[data-record-id]")){
    row.querySelectorAll(".paypal-badge").forEach(b=>b.remove());
    const payment=payload?.rows.find(p=>p.routed_record_id===row.dataset.recordId&&p.routed_record_type===row.dataset.recordType);
    if(payment){const badge=node("small",`Paid via PayPal · ${payment.txn_id}${payment.mismatch?" · Amount mismatch":""}`);badge.className="paypal-badge";row.querySelector("td")?.append(badge);}
  }
}
function render(){
  if(!payload)return;
  connection.textContent=`${payload.connection.name??"PayPal player"} · Sandbox connected · ${payload.connection.verified===null?"Account verification not returned":payload.connection.verified?"Verified PayPal account":"Account not verified"}`;
  stats.replaceChildren(...Object.entries(payload.totalsByApp).map(([app,total])=>{const d=node("div");d.append(node("dt",app.replaceAll("_"," ")),node("dd",money(total)));return d;}));
  const table=node("table"),head=node("thead"),header=node("tr"),body=node("tbody");
  for(const text of ["Month","Workspace","Routed net (USD)"])header.append(node("th",text));head.append(header);
  for(const [month,totals] of Object.entries(payload.totalsByMonth))for(const [app,value] of Object.entries(totals))if(value){const tr=node("tr");tr.append(node("td",month),node("td",app.replaceAll("_"," ")),node("td",money(value)));body.append(tr);}
  table.append(head,body);monthly.replaceChildren(node("h3","Routed payments by month"),table);
  for(const [app,strip] of strips){const total=app==="market"?(payload.totalsByApp.market_delivery+payload.totalsByApp.market_selling):payload.totalsByApp[app];
    strip.replaceChildren(node("span",`PayPal · ${money(total??0)} routed here in ${payload.month}`),button(`Review ${payload.unrouted} unrouted`,()=>{filter.value=app==="market"?"market_delivery":app;showApp("paypal");render();}));
  }
  const visible=payload.rows.filter(p=>filter.value==="all"||p.routed_app===filter.value||(!p.routed_record_id&&(!p.suggestion||p.suggestion.app===filter.value)));
  review.replaceChildren();if(!visible.length)review.append(node("p","No payments in this view."));
  const existingRequests=new Map<string,Promise<{rows?:Record<string,unknown>[];entries?:Record<string,unknown>[]}>>();
  for(const p of visible){const section=node("section");section.className="slip row";
    section.append(node("h3",`${p.payer||"Unnamed payer"} · ${p.occurred_on}`),node("p",`${p.txn_id} · ${p.kind} · ${p.currency} · Gross ${money(p.gross_cents,p.currency)} · Fee ${money(p.fee_cents,p.currency)} · Net ${money(p.net_cents,p.currency)}`));
    if(!p.eligible)section.append(node("p","Not counted: only incoming USD payments of supported payment types can be routed."));
    else if(p.routed_record_id){section.append(node("p",`Paid via PayPal · ${p.routed_app}${p.mismatch?" · Amount mismatch: your recorded amount was preserved.":""}`),button("Open workspace",()=>showApp(p.routed_app!.startsWith("market_")?"market":p.routed_app!)));}
    else{
      const type=node("select"),platform=node("select"),record=node("select"),fields=node("div");fields.className="fields";
      for(const [key,value] of Object.entries(types)){const option=node("option",value.label);option.value=key;type.append(option);}
      type.value=p.suggestion?.record_type??"first";
      const suggest=node("p",p.suggestion?`Suggested: ${types[p.suggestion.record_type as RecordType].label} / ${p.suggestion.platform}. Confirm or change it.`:"No suggestion. Choose the workspace and platform.");
      const fill=async()=>{
        const config=types[type.value as RecordType];platform.replaceChildren(...config.platforms.map(value=>node("option",value)));
        platform.value=config.platforms.some(value=>value===p.suggestion?.platform)?p.suggestion!.platform:"Other";
        const create=node("option","Create a new record");create.value="";record.replaceChildren(create);record.disabled=true;
        try{let pending=existingRequests.get(config.path);if(!pending){pending=request<{rows?:Record<string,unknown>[];entries?:Record<string,unknown>[]}>(config.path);existingRequests.set(config.path,pending);}const data=await pending;
          for(const row of data.rows??data.entries??[]){const option=node("option",`${String(row.platform??row.store)} · ${String(row.project??row.item??row.workedOn??row.earned_on??row.started_on??row.worked_on??row.sold_on)} · existing record`);option.value=String(row.id);record.append(option);}
        }catch{toast("Could not load existing records. Refresh activity to retry.");}finally{record.disabled=false;}
      };
      type.setAttribute("aria-label",`Workspace for ${p.txn_id}`);platform.setAttribute("aria-label",`Platform for ${p.txn_id}`);record.setAttribute("aria-label",`Record for ${p.txn_id}`);
      type.addEventListener("change",()=>void fill());void fill();
      const confirm=button("Confirm routing",()=>{confirm.disabled=true;void(async()=>{try{
        await request(`/paypal/transactions/${p.id}/route`,{record_type:type.value,platform:platform.value,...(record.value?{record_id:record.value}:{})});
        toast("Payment routed. Your existing amounts were preserved.");await load();document.dispatchEvent(new Event("onedime:payment-routed"));
      }catch(error){toast(error instanceof Error?error.message:"Could not route payment.");}finally{confirm.disabled=false;}})();});
      fields.append(labelControl("Workspace",type),labelControl("Platform or store",platform),labelControl("Create or link",record));section.append(suggest,fields,confirm);
    }
    review.append(section);
  }
  badges();
}
async function load(){
  if(loading)return;loading=true;
  try{payload=await request<Payload>("/paypal/transactions");render();}catch{toast("Could not load PayPal activity. Refresh to retry.");}finally{loading=false;}
}
filter.addEventListener("change",render);
importForm.addEventListener("submit",event=>{event.preventDefault();if(submit.disabled)return;const selected=file.files?.[0];if(!selected)return;if(selected.size>524288){toast("Choose a CSV file smaller than 512 KB.");return;}
  submit.disabled=true;void(async()=>{try{const result=await request<{added:number;duplicates:number}>("/paypal/import",{csv:await selected.text()});file.value="";toast(`Imported ${result.added}; skipped ${result.duplicates} duplicates.`);await load();}catch{toast("Import failed. Check the English column names, US/ISO dates, amounts and row limit.");}finally{submit.disabled=false;}})();
});
document.addEventListener("onedime:rendered",()=>{badges();void load();});
void load();
