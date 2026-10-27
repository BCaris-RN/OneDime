/*  (o) OneDime | src/feedback/export.ts
 *  ----------------------------------------------------------
 *  Private operator reports without account identity fields.
 */
import { createHash } from "node:crypto";

export type FeedbackExportRow = {
  id: string;
  playerId: string;
  app: string;
  body: string;
  blocking: boolean;
  status: string;
  createdAt: Date;
};

const apps = [
  ["first", "First Dime"],
  ["spotlight", "Spotlight"],
  ["freelance", "Freelance"],
  ["market", "Market"],
  ["paypal", "PayPal"],
  ["stats", "Stats"],
] as const;

function playerTag(playerId: string): string {
  return `player-${createHash("sha256").update(playerId).digest("hex").slice(0, 12)}`;
}

function reportText(value: string): string {
  return value
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi, "[email removed]")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&");
}

export function formatFeedbackReport(rows: readonly FeedbackExportRow[], exportedAt: Date): string {
  const lines = [
    `# OneDime feedback - ${exportedAt.toISOString().slice(0, 10)}`,
    "",
    `${rows.length} feedback item${rows.length === 1 ? "" : "s"}. Times are UTC.`,
    "",
    "Private operator report. Account names and emails are not queried. Email-shaped text is redacted;",
    "players may still type names or other personal details. Review bodies before sharing this report.",
    "Player tags are pseudonymous and remain the same across exports.",
    "",
  ];
  const knownApps = new Set<string>(apps.map(([app]) => app));
  const groups = [...apps, ["other", "Other"]] as const;

  for (const [app, label] of groups) {
    const grouped = rows.filter((row) => app === "other" ? !knownApps.has(row.app) : row.app === app);
    if (!grouped.length) continue;
    grouped.sort((left, right) =>
      Number(right.blocking) - Number(left.blocking)
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.id.localeCompare(right.id)
    );
    lines.push(`## ${label}`, "");
    for (const row of grouped) {
      lines.push(
        `### ${reportText(row.id)}`,
        "",
        `- Player: ${playerTag(row.playerId)}`,
        `- Created: ${row.createdAt.toISOString()}`,
        `- Status: ${reportText(row.status)}`,
        `- Blocking: ${row.blocking ? "yes" : "no"}`,
        "",
        ...reportText(row.body).split("\n").map((line) => `> ${line}`),
        ""
      );
    }
  }
  if (!rows.length) lines.push("No feedback yet.", "");
  return lines.join("\n");
}
