// The form accepts a decimal string; all game/API/storage money remains cents.
export function dollarsToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Enter dollars with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 1_000_000) {
    throw new Error("Enter an amount from $0 to $10,000.");
  }
  return cents;
}
