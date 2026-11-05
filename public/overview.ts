/*  (o) OneDime | public/overview.ts
 *  ----------------------------------------------------------
 *  Monthly totals across the five income ledgers, without payment duplication.
 */
import { request } from "./workspaces.js";
import { monthQuery } from "./months.js";
type Row = { app: string; earnedCents: number; paidCents: number; pendingCents: number; feesCents: number; expensesCents: number; netCents: number };
const section = document.createElement("section"); section.className = "slip row";
const heading = document.createElement("h2"); heading.textContent = "This month, everywhere";
const content = document.createElement("div"); content.className = "tablewrap";
const note = document.createElement("p"); note.textContent = "Owned ledgers only; PayPal imports are not added again. Matched First Dime payments use gross earnings, actual fees and received net here; game totals keep your logged amount. Pending follows the work month; workspace pending headlines stay all time.";
const matching = document.createElement("details");
const matchingSummary = document.createElement("summary"); matchingSummary.textContent = "How matching works";
matching.className = "paypal-matching";
matching.append(matchingSummary, note);
section.append(heading, document.getElementById("stats-month-paypal")!, matching, content);
document.getElementById("paypal-activity")!.after(section);
const first = document.createElement("section"); first.className = "slip row";
const firstTitle = document.createElement("h2"); firstTitle.textContent = "First Dime, selected month";
const firstStats = document.createElement("dl"); firstStats.className = "stats";
first.append(firstTitle,firstStats); document.getElementById("stats-month-first")!.after(first);
const names:Record<string,string>={first:"First Dime",spotlight:"Spotlight",freelance:"Freelance",market_delivery:"Market: delivery",market_selling:"Market: selling",total:"Total"};
const money = (value:number) => `$${(value/100).toFixed(2)}`;
const sequences = new Map<string,number>();
async function render(app="paypal") {
  const sequence=(sequences.get(app)??0)+1;sequences.set(app,sequence);
  try {
    const data=await request<{month:string;rows:Row[]}>(`/overview${monthQuery(app)}`);
    if(sequences.get(app)!==sequence)return;
    if(app==="first") {
      firstStats.replaceChildren();
      for(const key of ["earnedCents","paidCents","pendingCents"] as const) {
        const box=document.createElement("div"), term=document.createElement("dt"),value=document.createElement("dd");
        term.textContent=key.replace("Cents","");value.textContent=money(data.rows[0][key]);box.append(term,value);firstStats.append(box);
      }
      return;
    }
    const table=document.createElement("table"),caption=document.createElement("caption"),head=document.createElement("thead"),body=document.createElement("tbody"),header=document.createElement("tr");
    caption.textContent=`Everywhere in ${data.month}`;table.append(caption);
    for(const label of ["App","Earned","Paid","Pending","Fees","Expenses","Net"]) {const th=document.createElement("th");th.scope="col";th.textContent=label;header.append(th);}
    head.append(header);
    for(const row of data.rows) {const tr=document.createElement("tr");for(const text of [names[row.app],...(["earnedCents","paidCents","pendingCents","feesCents","expensesCents","netCents"] as const).map(key=>money(row[key]))]) {const td=document.createElement("td");td.textContent=text;tr.append(td);}body.append(tr);}
    table.append(head,body);content.replaceChildren(table);
  } catch { if(app==="paypal" && sequences.get(app)===sequence) content.textContent="Could not load the overview. Change the month to retry."; }
}
document.addEventListener("onedime:month", event => { const app=(event as CustomEvent<string>).detail;if(app==="first"||app==="paypal")void render(app); });
document.addEventListener("onedime:rendered",()=>{void render();void render("first");});
void render();void render("first");
