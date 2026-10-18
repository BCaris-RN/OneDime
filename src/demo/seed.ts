import { Prisma, type PrismaClient } from "@prisma/client";
import { insertRow, listRows, stampPayment, validateRow } from "../ledger/store.js";
import type { TableKey } from "../ledger/catalog.js";
const id = (number: number) => `d1000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export async function seedDemo(prisma: PrismaClient, day: string) {
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.upsert({
      where: { paypalUserId: "onedime-fictional-demo" },
      create: {
        id: id(1),
        paypalUserId: "onedime-fictional-demo",
        displayName: "Demo player",
        email: "demo@example.test",
        timeZone: "Pacific/Honolulu",
        paypalVerified: false
      },
      update: {}
    });
    await tx.logEntry.upsert({
      where: { id: id(2) },
      create: {
        id: id(2),
        playerId: player.id,
        platform: "Prolific",
        amountCents: 199,
        minutes: 20,
        workedOn: new Date(`${day}T00:00:00Z`),
        note: "Fictional demo study",
        verified: false
      },
      update: {}
    });
    const records: [TableKey, Record<string, unknown>][] = [
      [
        "income",
        {
          platform: "YouTube",
          stream_type: "Ad revenue",
          amount_cents: 2500,
          earned_on: day,
          status: "pending",
          content_minutes: 60,
          note: "Fictional demo income"
        }
      ],
      [
        "deals",
        {
          brand: "Fictional Studio",
          platform: "TikTok",
          amount_cents: 5000,
          due_on: day,
          deliverables: "One fictional demo clip",
          stage: "Agreed"
        }
      ],
      [
        "expenses",
        { app: "spotlight", item: "Fictional microphone rental", amount_cents: 500, spent_on: day }
      ],
      [
        "gigs",
        {
          platform: "Upwork",
          client: "Fictional Client",
          project: "Demo illustration",
          pricing: "fixed",
          gross_cents: 10000,
          fee_cents: 1000,
          hours_x100: 125,
          started_on: day,
          stage: "Paid"
        }
      ],
      [
        "shifts",
        {
          platform: "Uber",
          worked_on: day,
          pay_cents: 2000,
          tips_cents: 400,
          minutes_online: 75,
          miles_x10: 123
        }
      ],
      [
        "sales",
        {
          store: "Printify Shop",
          item: "Fictional demo print",
          sold_on: day,
          price_cents: 2000,
          fee_cents: 100,
          cost_cents: 700,
          ship_cents: 200,
          made_by: "Printify",
          status: "paid"
        }
      ]
    ];
    for (const [index, [key, data]] of records.entries()) {
      const rowId = id(10 + index),
        existing = await listRows(tx, key, player.id);
      if (!existing.some((row) => row.id === rowId))
        await stampPayment(
          tx,
          key,
          player.id,
          await insertRow(tx, key, player.id, { ...validateRow(key, data), id: rowId }),
          day
        );
    }
    for (const [number, currency, payer, gross, fee, net] of [
      [30, "USD", "Hyperwallet", 199, 0, 199],
      [31, "EUR", "Fictional payer", 1000, 25, 975]
    ] as const) {
      await tx.$executeRaw(Prisma.sql`INSERT INTO paypal_transactions(id,player_id,txn_id,occurred_on,payer,gross_cents,fee_cents,net_cents,currency,kind)
        VALUES(${id(number)}::uuid,${player.id}::uuid,${`FAKE-DEMO-${currency}-1`},${day}::date,${payer},${gross},${fee},${net},${currency},'General Payment') ON CONFLICT(player_id,txn_id) DO NOTHING`);
    }
    return player;
  });
}
