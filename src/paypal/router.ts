/*  (o) OneDime | src/paypal/router.ts
 *  ----------------------------------------------------------
 *  Imported activity is owned data; player confirmation routes it once.
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.js";
import { localDay } from "../game/rules.js";
import { ownRow } from "../ledger/store.js";
import type { LedgerRow, TableKey } from "../ledger/catalog.js";
import { parseActivity, incoming, fixedSuggestion } from "./activity.js";
import { routePayment, routeSchema, transactions, recordNet } from "./routing.js";
export function createActivityRouter(prisma: PrismaClient, now: ()=>Date, afterRoute: (playerId: string)=>Promise<void>) {
  const router=Router();
  router.get("/paypal/transactions",async(req:AuthedRequest,res)=>{
    const player=req.currentSession!.player;
    const month=localDay(now(),player.timeZone??"UTC").slice(0,7);
    const rows=await transactions(prisma,player.id);
    const views=await Promise.all(rows.map(async row=>{
      let mismatch=false;
      if(row.routed_record_id){
        const record=row.routed_record_type==="first"?await prisma.logEntry.findFirst({where:{id:row.routed_record_id,playerId:player.id}}):await ownRow(prisma,row.routed_record_type as TableKey,player.id,row.routed_record_id);
        if(record)mismatch=recordNet(row.routed_record_type!,record as unknown as LedgerRow)!==row.net_cents;
      }
      return {...row,mismatch,eligible:incoming(row),suggestion:incoming(row)?fixedSuggestion(row.payer):null};
    }));
    res.json({totalsByMonth:Object.fromEntries([...new Set(rows.filter(row=>row.routed_app).map(row=>row.occurred_on.slice(0,7)))].sort().map(month=>[month,Object.fromEntries(["first","spotlight","freelance","market_delivery","market_selling"].map(app=>[app,rows.filter(row=>row.routed_app===app&&row.occurred_on.startsWith(month)).reduce((sum,row)=>sum+row.net_cents,0)]))])),connection:{name:player.displayName,verified:player.paypalVerified??null,environment:"sandbox"},month,
      rows:views,
      unrouted:rows.filter(row=>!row.routed_record_id&&incoming(row)).length,
      totalsByApp: Object.fromEntries(["first","spotlight","freelance","market_delivery","market_selling"].map(app=>[app,rows.filter(row=>row.routed_app===app&&row.occurred_on.startsWith(month)).reduce((sum,row)=>sum+row.net_cents,0)]))});
  });
  router.post("/paypal/import",async(req:AuthedRequest,res)=>{
    const {csv}=z.strictObject({csv:z.string().min(1).max(524288)}).parse(req.body);
    const rows=parseActivity(csv),playerId=req.currentSession!.player.id;
    let added=0;
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM players WHERE id=${playerId}::uuid FOR UPDATE`;
      if(rows.length) added=await tx.$executeRaw(Prisma.sql`INSERT INTO paypal_transactions(id,player_id,txn_id,occurred_on,payer,gross_cents,fee_cents,net_cents,currency,kind)
        VALUES ${Prisma.join(rows.map(row=>Prisma.sql`(${randomUUID()}::uuid,${playerId}::uuid,${row.txn_id},${row.occurred_on}::date,${row.payer},${row.gross_cents},${row.fee_cents},${row.net_cents},${row.currency},${row.kind})`))} ON CONFLICT(player_id,txn_id) DO NOTHING`);
    });
    res.json({added,duplicates:rows.length-added});
  });
  router.post("/paypal/transactions/:id/route",async(req:AuthedRequest,res)=>{
    const id=z.uuid().parse(req.params.id),input=routeSchema.parse(req.body),playerId=req.currentSession!.player.id;
    const result=await routePayment(prisma,playerId,id,input);
    let payoutsPending=false;
    try { await afterRoute(playerId); } catch { payoutsPending=true; }
    res.json({...result,payoutsPending});
  });
  return router;
}
