# S2 user-facing copy inventory

Every changed user-facing line is recorded below as before (-) and after (+). Code identifiers are retained. The account-identity verification and webhook signature verification terms retain their separate technical meanings.

`diff
diff --git a/README.md b/README.md
index 29c4f98..b6d535b 100644
--- a/README.md
+++ b/README.md
@@ -19 +19 @@ without decimal drift. Hours, minutes and miles use explicit scaled integers. Fi
-keeps its existing XP, streak, quest and rung rules. Verified earnings in Spotlight,
+keeps its existing XP, streak, quest and rung rules. Matched earnings in Spotlight,
@@ -21 +21 @@ Freelance and Market also add XP and advance a permanent profession rank; these
-never create money or change rung claims. Verified totals decide earnings rankings, and
+never create money or change rung claims. Matched totals decide earnings rankings, and
@@ -124,2 +124,2 @@ A payment belongs in exactly one workspace. Printify and Ninja Transfers are sup
-quests and rung claims. Other-workspace XP uses only matched verified payments and grants
-10 XP per verified dollar. Creator, Freelancer, Driver, Seller and Starter ranks use verified
+quests and rung claims. Other-workspace XP uses only payments matched to your PayPal activity
+and grants 10 XP per matched dollar. Creator, Freelancer, Driver, Seller and Starter ranks use matched
@@ -142 +142 @@ are reconciliation metadata and are not counted again in Summary. First Dime tre
-verified earnings as paid because it has no separate payout status.
+matched earnings as paid because it has no separate payout status.
@@ -325 +325 @@ The app does not scrape, automate or log into gig platforms, implement receipt-i
-verification, award XP outside First Dime or use live PayPal.
+verification or use live PayPal.
diff --git a/handoffs/week5-features.md b/handoffs/week5-features.md
index e3bb0ff..5d23e5a 100644
--- a/handoffs/week5-features.md
+++ b/handoffs/week5-features.md
@@ -66 +66 @@ F5  STATS SCREEN WITH HANDHELD-STYLE CHARTS (spec = the Stats tab in reference/p
-  A fifth top-level tab, "Stats", after Market. Port the pilot's screen exactly:
+  Six top-level tabs, with "Stats" fifth after Market and PayPal retained as the sixth tab. Port the pilot's screen exactly:
@@ -81 +81 @@ F5  STATS SCREEN WITH HANDHELD-STYLE CHARTS (spec = the Stats tab in reference/p
-  - Phone: app tabs in two rows (3 + 2). No horizontal overflow at 320px.
+  - Phone: app tabs in two rows (3 + 3). No horizontal overflow at 320px.
diff --git a/public/app.html b/public/app.html
index cc10729..a4b2695 100644
--- a/public/app.html
+++ b/public/app.html
@@ -75,2 +75,2 @@
-        <section class="goal-hero" aria-labelledby="goal-title"><div class="goal-coin" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="10"/><circle id="goal-ring" cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7"/></svg><div class="coin-face"><b id="goal-percent">0%</b><span>of goal</span></div></div><div><p class="eyebrow">Current goal</p><h2 id="goal-title">Earn your first dime</h2><p id="goal-sub" class="muted"></p><p class="field-help">Your personal goal uses logged earnings. The rung race requires verified earnings.</p><p id="level-summary" class="level-summary">Loading your progress…</p></div></section>
-      <p id="rank-first" class="rank-summary" aria-live="polite">Starter rank loads with your progress.</p><p class="field-help">How to get verified: match a First Dime entry to an incoming PayPal payment from its mapped payer; the logged amount must equal gross or net.</p>
+        <section class="goal-hero" aria-labelledby="goal-title"><div class="goal-coin" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="10"/><circle id="goal-ring" cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7"/></svg><div class="coin-face"><b id="goal-percent">0%</b><span>of goal</span></div></div><div><p class="eyebrow">Current goal</p><h2 id="goal-title">Earn your first dime</h2><p id="goal-sub" class="muted"></p><p class="field-help">Your personal goal uses logged earnings. The rung race requires matched earnings.</p><p id="level-summary" class="level-summary">Loading your progress…</p></div></section>
+      <p id="rank-first" class="rank-summary" aria-live="polite">Starter rank loads with your progress.</p><p class="field-help">Matched to your PayPal activity: match a First Dime entry to an incoming PayPal payment from its mapped payer; the logged amount must equal gross or net.</p>
@@ -79 +79 @@
-        <div><dt>Verified</dt><dd id="verified-amount">—</dd></div>
+        <div><dt>Matched</dt><dd id="verified-amount">—</dd></div>
@@ -97 +97 @@
-              <p id="amount-help" class="field-help full-width">Up to $10,000 per entry. Logged earnings await verification before they count toward rungs.</p>
+              <p id="amount-help" class="field-help full-width">Up to $10,000 per entry. Logged earnings await matching before they count toward rungs.</p>
@@ -104 +104 @@
-            <section class="rung-workspace" aria-labelledby="rung-heading"><p class="eyebrow">The rung race</p><h2 id="rung-heading">First verified total wins.</h2><p class="muted" id="next-rung">Loading next rung…</p><ol id="rung-list" class="rung-list"></ol><p class="field-help">Each rung has one winner. Matched PayPal CSV payments can verify entries. Sandbox milestone bonuses are off by default.</p></section>
+            <section class="rung-workspace" aria-labelledby="rung-heading"><p class="eyebrow">The rung race</p><h2 id="rung-heading">First matched total wins.</h2><p class="muted" id="next-rung">Loading next rung…</p><ol id="rung-list" class="rung-list"></ol><p class="field-help">Each rung has one winner. Matched PayPal CSV payments can match entries. Sandbox milestone bonuses are off by default.</p></section>
@@ -108 +108 @@
-        <section class="workspace-section" aria-labelledby="sites-heading"><h2 id="sites-heading">Your site rates</h2><p class="field-help">Effective hourly rate counts only sessions where you logged minutes, including earnings awaiting verification.</p><ul id="site-rates" class="plain-list"></ul></section>
+        <section class="workspace-section" aria-labelledby="sites-heading"><h2 id="sites-heading">Your site rates</h2><p class="field-help">Effective hourly rate counts only sessions where you logged minutes, including earnings awaiting matching.</p><ul id="site-rates" class="plain-list"></ul></section>
@@ -111 +111 @@
-      <section id="panel-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard" tabindex="0" hidden><div class="workspace-section"><p class="eyebrow">Leaderboard</p><h2>The verified standings.</h2><p class="muted">Joining shares your display name, verified earnings by site, XP, level, and rung wins with other players. Your notes stay private.</p><button type="button" class="primary-button" id="leaderboard-toggle" disabled>Loading…</button><p id="leaderboard-empty" class="muted"></p><h3 class="board-heading">First to each rung</h3><div class="table-scroll"><table><thead><tr><th scope="col">Bonus quest</th><th scope="col">Claimed by</th><th scope="col">When</th></tr></thead><tbody id="race-body"></tbody></table></div><p class="field-help">Only opted-in winners appear here. Private winners retain their claims.</p><h3 class="board-heading">Top earners</h3><ol id="leaderboard-list" class="leaderboard-list"></ol><h3 class="board-heading">Top earner on each site</h3><ul id="site-leaders" class="plain-list"></ul></div></section>
+      <section id="panel-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard" tabindex="0" hidden><div class="workspace-section"><p class="eyebrow">Leaderboard</p><h2>The matched standings.</h2><p class="muted">Joining shares your display name, matched earnings by site, XP, level, and rung wins with other players. Your notes stay private.</p><button type="button" class="primary-button" id="leaderboard-toggle" disabled>Loading…</button><p id="leaderboard-empty" class="muted"></p><h3 class="board-heading">First to each rung</h3><div class="table-scroll"><table><thead><tr><th scope="col">Bonus quest</th><th scope="col">Claimed by</th><th scope="col">When</th></tr></thead><tbody id="race-body"></tbody></table></div><p class="field-help">Only opted-in winners appear here. Private winners retain their claims.</p><h3 class="board-heading">Top earners</h3><ol id="leaderboard-list" class="leaderboard-list"></ol><h3 class="board-heading">Top earner on each site</h3><ul id="site-leaders" class="plain-list"></ul></div></section>
@@ -141 +141 @@
-        <li><b>Level and XP:</b> First Dime keeps its existing XP for minutes and logged dollars. Verified dollars in Spotlight, Freelance and Market add 10 XP per dollar; each new Creator, Freelancer, Driver or Seller rank adds 100 XP once. Quests, rung claims and rested time keep their existing rewards. Each level takes a little more XP than the last.</li>
+        <li><b>Level and XP:</b> First Dime keeps its existing XP for minutes and logged dollars. Matched dollars in Spotlight, Freelance and Market add 10 XP per dollar; each new Creator, Freelancer, Driver or Seller rank adds 100 XP once. Quests, rung claims and rested time keep their existing rewards. Each level takes a little more XP than the last.</li>
@@ -150,2 +150,2 @@
-        <li><b>Joining is optional.</b> When you join, other players see your display name, verified total, XP, level and verified earnings by site. Your rung claims are also visible. Your email, log entries and notes stay private.</li>
-        <li><b>Bonus quests:</b> each rung of the goal ladder ($0.10, $1, $10 and up) can be claimed once, by the first player whose verified total reaches it. Claiming one is worth +100 XP.</li>
+        <li><b>Joining is optional.</b> When you join, other players see your display name, matched total, XP, level and matched earnings by site. Your rung claims are also visible. Your email, log entries and notes stay private.</li>
+        <li><b>Bonus quests:</b> each rung of the goal ladder ($0.10, $1, $10 and up) can be claimed once, by the first player whose matched total reaches it. Claiming one is worth +100 XP.</li>
@@ -153 +153 @@
-        <li><b>Verified earnings only:</b> logged entries await verification before they count toward rungs or public earnings. A rung claim stays with its winner, including after deleting an entry or leaving the leaderboard. First Dime keeps its existing progression XP; unverified Spotlight, Freelance and Market amounts give no XP. Use PayPal activity import to match a payment by payer/platform and a logged amount equal to that payment's gross or net. CSV matching records source paypal_csv; it does not authenticate the uploaded file with PayPal. Many delivery apps and stores pay to a bank, so those earnings cannot be verified through PayPal yet.</li>
+        <li><b>Matched earnings only:</b> logged entries await matching before they count toward rungs or public earnings. A rung claim stays with its winner, including after deleting an entry or leaving the leaderboard. First Dime keeps its existing progression XP; unmatched Spotlight, Freelance and Market amounts give no XP. Use PayPal activity import to match a payment by payer/platform and a logged amount equal to that payment's gross or net. CSV matching records source paypal_csv; it does not authenticate the uploaded file with PayPal. Many delivery apps and stores pay to a bank, so those earnings cannot be matched through PayPal yet.</li>
@@ -172 +172 @@
-      <p class="field-help">How to get verified: route an incoming PayPal payment to a paid gig. The logged client-paid or take-home amount must equal its gross or net.</p>
+      <p class="field-help">Matched to your PayPal activity: route an incoming PayPal payment to a paid gig. The logged client-paid or take-home amount must equal its gross or net.</p>
@@ -215 +215 @@
-  <section class="slip row"><p id="rank-market" class="rank-summary" aria-live="polite">Driver and Seller ranks load with your progress.</p><p class="field-help">How to get verified: route an incoming PayPal payment to a delivery shift or paid sale. The logged pay and tips, sale price, or take-home sale amount must equal its gross or net.</p></section>
+  <section class="slip row"><p id="rank-market" class="rank-summary" aria-live="polite">Driver and Seller ranks load with your progress.</p><p class="field-help">Matched to your PayPal activity: route an incoming PayPal payment to a delivery shift or paid sale. The logged pay and tips, sale price, or take-home sale amount must equal its gross or net.</p></section>
@@ -297 +297 @@
-      <p class="field-help">How to get verified: route an incoming PayPal payment to paid creator income. The logged amount must equal its gross or net.</p>
+      <p class="field-help">Matched to your PayPal activity: route an incoming PayPal payment to paid creator income. The logged amount must equal its gross or net.</p>
@@ -373,2 +373,2 @@
-  <section class="stats-lcd"><h2>Real hourly rate</h2><p class="stats-note">Verified work with time logged.</p><div id="stats-rate-chart"></div><details><summary>Show as a table</summary><div id="stats-rate-table" class="table-scroll"></div></details></section>
-  <section class="stats-lcd"><h2>Verified vs pending</h2><p id="stats-meter-note" class="stats-note">This month, across all apps.</p><div id="stats-meter"></div><details><summary>Show as a table</summary><div id="stats-meter-table" class="table-scroll"></div></details></section>
+  <section class="stats-lcd"><h2>Real hourly rate</h2><p class="stats-note">All work with time logged, matched or not.</p><div id="stats-rate-chart"></div><details><summary>Show as a table</summary><div id="stats-rate-table" class="table-scroll"></div></details></section>
+  <section class="stats-lcd"><h2>Matched vs pending</h2><p id="stats-meter-note" class="stats-note">This month, across all apps.</p><div id="stats-meter"></div><details><summary>Show as a table</summary><div id="stats-meter-table" class="table-scroll"></div></details></section>
diff --git a/public/app.ts b/public/app.ts
index 298ee79..ccd9399 100644
--- a/public/app.ts
+++ b/public/app.ts
@@ -86 +86 @@ function rankText(rank: ProfessionRank) {
-  return `${title} · ${rank.rank ? `rank ${rank.rank}` : "working toward rank 1"} · ${money(rank.verifiedCents)} verified · ${progress}`;
+  return `${title} · ${rank.rank ? `rank ${rank.rank}` : "working toward rank 1"} · ${money(rank.verifiedCents)} matched · ${progress}`;
@@ -111 +111 @@ function renderStats(stats: GameStatsWithProfessions) {
-  element("next-rung").textContent = stats.nextRungCents === null ? "Your verified total has reached the top rung." : `Your next target: ${money(stats.nextRungCents)} verified.`;
+  element("next-rung").textContent = stats.nextRungCents === null ? "Your matched total has reached the top rung." : `Your next target: ${money(stats.nextRungCents)} matched.`;
@@ -143 +143 @@ function renderEntries(entries: Entry[]) {
-    row.append(detail, node("td", `${entry.minutes} min`), node("td", money(entry.amountCents)), node("td", entry.verified ? "Verified" : "Awaiting verification"), action);
+    row.append(detail, node("td", `${entry.minutes} min`), node("td", money(entry.amountCents)), node("td", entry.verified ? "Matched" : "Awaiting matching"), action);
@@ -201 +201 @@ function renderLeaders(leaders: Leader[]) {
-  }) : [node("li", "No verified site leaders yet.", "muted")]));
+  }) : [node("li", "No matched site leaders yet.", "muted")]));
@@ -204 +204 @@ function renderLeaders(leaders: Leader[]) {
-    row.append(node("h3", `${index + 1}. ${leader.displayName}`), node("p", `${money(leader.verifiedTotalCents)} verified · ${number(leader.xp)} XP · Level ${leader.level}${leader.professionClass ? ` · ${leader.professionClass.profession[0].toUpperCase() + leader.professionClass.profession.slice(1)} class` : ""}`));
+    row.append(node("h3", `${index + 1}. ${leader.displayName}`), node("p", `${money(leader.verifiedTotalCents)} matched · ${number(leader.xp)} XP · Level ${leader.level}${leader.professionClass ? ` · ${leader.professionClass.profession[0].toUpperCase() + leader.professionClass.profession.slice(1)} class` : ""}`));
diff --git a/public/stats.ts b/public/stats.ts
index 48aa1d5..cc01ad4 100644
--- a/public/stats.ts
+++ b/public/stats.ts
@@ -20 +20 @@ function table(headers: string[], rows: string[][]) {
-  caption.textContent = headers[0] === "Month" ? "Earned by month and app" : headers[0] === "Platform" ? "Real hourly rate by platform" : "Verified and pending amounts this month";
+  caption.textContent = headers[0] === "Month" ? "Earned by month and app" : headers[0] === "Platform" ? "Real hourly rate by platform" : "Matched and pending amounts this month";
@@ -28 +28 @@ function render(data: Stats, animate: boolean) {
-  const tiles: [string, string, number?][] = [["Earned this month", money(data.earnedCents), data.earnedCents], ["Verified share", data.earnedCents ? `${pct}%` : "—"], ["Best real hourly rate", best ? money(best.centsPerHour) : "—", best?.centsPerHour], ["Active days, last 7", `${data.activeDays} of 7`], ["Streak across any app", `${data.streak} ${data.streak === 1 ? "day" : "days"}`]];
+  const tiles: [string, string, number?][] = [["Earned this month, before fees", money(data.earnedCents), data.earnedCents], ["Matched share", data.earnedCents ? `${pct}%` : "—"], ["Best real hourly rate", best ? money(best.centsPerHour) : "—", best?.centsPerHour], ["Active days, last 7", `${data.activeDays} of 7`], ["Streak across any app", `${data.streak} ${data.streak === 1 ? "day" : "days"}`]];
@@ -44,3 +44,3 @@ function render(data: Stats, animate: boolean) {
-  if (!data.hourly.length) { el("stats-rate-chart").innerHTML = `<p class="stats-note">No verified timed work yet. Add time to your work entries to see a real hourly rate.</p><svg viewBox="0 0 320 28" role="img" aria-label="No real hourly rates yet" shape-rendering="crispEdges"><desc>No verified work with time logged yet.</desc><text x="4" y="18">No timed work yet</text></svg>`; el("stats-rate-table").replaceChildren(); }
-  else { const rh = 22, lab = 104, maxRate = Math.max(...data.hourly.map(x => x.centsPerHour), 1); let bars = `<svg viewBox="0 0 320 ${data.hourly.length * rh + 8}" role="img" aria-label="Verified real hourly rate by platform, top eight" shape-rendering="crispEdges"><desc>${data.hourly.map(r => `${r.platform}, ${money(r.centsPerHour)} per hour`).join(", ")}</desc>`; data.hourly.forEach((r, i) => { const y = i * rh + 4, w = Math.max(2, Math.round(r.centsPerHour / maxRate * 160)); bars += `<text x="${lab - 6}" y="${y + 11}" text-anchor="end">${esc(r.platform).slice(0, 14)}</text><rect class="stats-rate ${animate ? "stats-grow-x" : ""}" style="--step:${i}" x="${lab}" y="${y + 2}" width="${w}" height="12"/><text x="${lab + w + 5}" y="${y + 11}">${money(r.centsPerHour)}</text>`; }); el("stats-rate-chart").innerHTML = bars + "</svg>"; el("stats-rate-table").replaceChildren(table(["Platform", "Per hour"], data.hourly.map(r => [r.platform, money(r.centsPerHour)]))); }
-  let meter = `<svg viewBox="0 0 320 34" role="img" aria-label="Verified and pending shares this month: ${pct}% verified" shape-rendering="crispEdges"><desc>Verified ${money(data.verifiedCents)}, pending ${money(Math.max(0, data.earnedCents - data.verifiedCents))} this month.</desc>`;
+  if (!data.hourly.length) { el("stats-rate-chart").innerHTML = `<p class="stats-note">No timed work yet. Add time to your work entries to see a real hourly rate.</p><svg viewBox="0 0 320 28" role="img" aria-label="No real hourly rates yet" shape-rendering="crispEdges"><desc>No work with time logged yet.</desc><text x="4" y="18">No timed work yet</text></svg>`; el("stats-rate-table").replaceChildren(); }
+  else { const rh = 22, lab = 104, maxRate = Math.max(...data.hourly.map(x => x.centsPerHour), 1); let bars = `<svg viewBox="0 0 320 ${data.hourly.length * rh + 8}" role="img" aria-label="Real hourly rate by platform, top eight" shape-rendering="crispEdges"><desc>${data.hourly.map(r => `${r.platform}, ${money(r.centsPerHour)} per hour`).join(", ")}</desc>`; data.hourly.forEach((r, i) => { const y = i * rh + 4, w = Math.max(2, Math.round(r.centsPerHour / maxRate * 160)); bars += `<text x="${lab - 6}" y="${y + 11}" text-anchor="end">${esc(r.platform).slice(0, 14)}</text><rect class="stats-rate ${animate ? "stats-grow-x" : ""}" style="--step:${i}" x="${lab}" y="${y + 2}" width="${w}" height="12"/><text x="${lab + w + 5}" y="${y + 11}">${money(r.centsPerHour)}</text>`; }); el("stats-rate-chart").innerHTML = bars + "</svg>"; el("stats-rate-table").replaceChildren(table(["Platform", "Per hour"], data.hourly.map(r => [r.platform, money(r.centsPerHour)]))); }
+  let meter = `<svg viewBox="0 0 320 34" role="img" aria-label="Matched and pending shares this month: ${pct}% matched" shape-rendering="crispEdges"><desc>Matched ${money(data.verifiedCents)}, pending ${money(Math.max(0, data.earnedCents - data.verifiedCents))} this month.</desc>`;
@@ -48,2 +48,2 @@ function render(data: Stats, animate: boolean) {
-  el("stats-meter").innerHTML = meter + `</svg><p class="stats-note">Verified ${money(data.verifiedCents)} · Pending ${money(Math.max(0, data.earnedCents - data.verifiedCents))}</p>`;
-  el("stats-meter-table").replaceChildren(table(["Status", "Amount"], [["Verified", money(data.verifiedCents)], ["Pending", money(Math.max(0, data.earnedCents - data.verifiedCents))]]));
+  el("stats-meter").innerHTML = meter + `</svg><p class="stats-note">Matched ${money(data.verifiedCents)} · Pending ${money(Math.max(0, data.earnedCents - data.verifiedCents))}</p>`;
+  el("stats-meter-table").replaceChildren(table(["Status", "Amount"], [["Matched", money(data.verifiedCents)], ["Pending", money(Math.max(0, data.earnedCents - data.verifiedCents))]]));

`
