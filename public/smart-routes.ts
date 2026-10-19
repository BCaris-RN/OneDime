export const intentLabels = [
  "paid surveys, research studies or microtasks",
  "creator audience income, advertisements or sponsorships",
  "freelance services sold to a client",
  "delivery, rides, pet care or household services",
  "selling goods through a store"
] as const;
const routes = [
  { app: "first", record_type: "first", platform: "Other" },
  { app: "spotlight", record_type: "income", platform: "Other" },
  { app: "freelance", record_type: "gigs", platform: "Other" },
  { app: "market_delivery", record_type: "shifts", platform: "Other" },
  { app: "market_selling", record_type: "sales", platform: "Other" }
] as const;
export function smartRoute(labels: string[], scores: number[]) {
  const index = intentLabels.indexOf(labels[0] as typeof intentLabels[number]);
  if (index < 0 || !Number.isFinite(scores[0]) || scores[0] < 0.7 || scores[0] > 1 ||
      !Number.isFinite(scores[1]) || scores[0] - scores[1] < 0.15) return null;
  return { ...routes[index], confidence: scores[0] };
}
