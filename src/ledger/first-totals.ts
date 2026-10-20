import { incoming, fixedSuggestion } from "../paypal/activity.js";
type Entry = { id: string; platform: string; amountCents: number; verified: boolean; workedOn: Date };
type Payment = { routed_record_type: string | null; routed_record_id: string | null;
  payer: string; gross_cents: number; fee_cents: number; net_cents: number; currency: string; kind: string;
  occurred_on: string };
export function firstDimeTotals(
  entries: Entry[], payments: Payment[], month: string, include: (day: string) => boolean = () => true
) {
  const inMonth = (day: string) => day.startsWith(month) && include(day);
  const total = { earnedCents:0,paidCents:0,pendingCents:0,feesCents:0,expensesCents:0,netCents:0 };
  for (const entry of entries) {
    const payment = payments.find(row => row.routed_record_type === "first" && row.routed_record_id === entry.id);
    const matched = entry.verified && payment && incoming(payment) && fixedSuggestion(payment.payer)?.platform === entry.platform &&
      (entry.amountCents === payment.gross_cents || entry.amountCents === payment.net_cents);
    const earnedCents = matched ? payment.gross_cents : entry.amountCents;
    const feeCents = matched ? payment.fee_cents : 0;
    const workedOn = entry.workedOn.toISOString().slice(0, 10);
    if (inMonth(workedOn)) {
      total.earnedCents += earnedCents;
      total.feesCents += feeCents;
      total.netCents += earnedCents - feeCents;
      if (!entry.verified) total.pendingCents += entry.amountCents;
    }
    // Receiving a payment can happen in a later month than earning it.
    if (entry.verified && inMonth(matched ? payment.occurred_on : workedOn)) {
      total.paidCents += matched ? payment.net_cents : entry.amountCents;
    }
  }
  return total;
}
