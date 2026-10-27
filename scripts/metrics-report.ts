import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { formatMetricsReport, type AggregateMetrics, type MonthlyMetrics } from "../src/metrics/report.js";

if (!process.env.DATABASE_URL) {
  console.error("Metrics report unavailable: DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  const num = (value: unknown) => Number(value ?? 0);
  const verifiedSql = `
    WITH verified AS (
      SELECT l.player_id, 'first'::text record_type, l.id record_id, l.worked_on AS work_date, l.amount_cents AS cents, l.minutes AS minutes
      FROM log_entries l JOIN paypal_transactions p
        ON p.player_id=l.player_id AND p.routed_record_type='first' AND p.routed_record_id=l.id
      WHERE l.verified AND p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0
        AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND l.amount_cents IN (p.gross_cents,p.net_cents)
        AND lower(trim(p.payer)) IN ('hyperwallet','prolific','prolific academic ltd','rev','rev.com','transcribeme','sideshift','microworkers')
        AND l.platform = CASE lower(trim(p.payer))
          WHEN 'hyperwallet' THEN 'Prolific' WHEN 'prolific' THEN 'Prolific' WHEN 'prolific academic ltd' THEN 'Prolific'
          WHEN 'rev' THEN 'Rev' WHEN 'rev.com' THEN 'Rev' WHEN 'transcribeme' THEN 'TranscribeMe'
          WHEN 'sideshift' THEN 'SideShift' WHEN 'microworkers' THEN 'Microworkers' END
      UNION ALL
      SELECT i.player_id,'income',i.id,i.earned_on,i.amount_cents,i.content_minutes
      FROM creator_income i JOIN paypal_transactions p ON p.player_id=i.player_id AND p.routed_record_type='income' AND p.routed_record_id=i.id
      WHERE i.status='paid' AND p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0 AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND i.amount_cents IN (p.gross_cents,p.net_cents)
      UNION ALL
      SELECT g.player_id,'gigs',g.id,g.started_on,g.gross_cents,g.hours_x100
      FROM freelance_gigs g JOIN paypal_transactions p ON p.player_id=g.player_id AND p.routed_record_type='gigs' AND p.routed_record_id=g.id
      WHERE g.stage='Paid' AND p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0 AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND (g.gross_cents IN (p.gross_cents,p.net_cents) OR g.gross_cents-g.fee_cents IN (p.gross_cents,p.net_cents))
      UNION ALL
      SELECT s.player_id,'shifts',s.id,s.worked_on,s.pay_cents+s.tips_cents,s.minutes_online
      FROM delivery_shifts s JOIN paypal_transactions p ON p.player_id=s.player_id AND p.routed_record_type='shifts' AND p.routed_record_id=s.id
      WHERE p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0 AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND s.pay_cents+s.tips_cents IN (p.gross_cents,p.net_cents)
      UNION ALL
      SELECT s.player_id,'sales',s.id,s.sold_on,s.price_cents,0::integer
      FROM sales s JOIN paypal_transactions p ON p.player_id=s.player_id AND p.routed_record_type='sales' AND p.routed_record_id=s.id
      WHERE s.status='paid' AND p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0 AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND (s.price_cents IN (p.gross_cents,p.net_cents) OR s.price_cents-s.fee_cents IN (p.gross_cents,p.net_cents))
    ),
    logged AS (
      SELECT player_id,'first'::text record_type,id record_id,worked_on AS work_date,amount_cents AS cents FROM log_entries
      UNION ALL SELECT player_id,'income',id,earned_on,amount_cents FROM creator_income
      UNION ALL SELECT player_id,'gigs',id,started_on,gross_cents FROM freelance_gigs
      UNION ALL SELECT player_id,'shifts',id,worked_on,pay_cents+tips_cents FROM delivery_shifts
      UNION ALL SELECT player_id,'sales',id,sold_on,price_cents FROM sales
    ),
    months AS (
      SELECT to_char(date_trunc('month', work_date), 'YYYY-MM') AS month_key,
        count(DISTINCT player_id) FILTER (WHERE verified) AS verified_earners,
        coalesce(sum(cents) FILTER (WHERE verified),0) AS verified_cents,
        coalesce(sum(cents),0) AS logged_cents
      FROM (SELECT l.player_id,l.work_date,l.cents,(v.player_id IS NOT NULL) AS verified
            FROM logged l LEFT JOIN verified v ON v.player_id=l.player_id AND v.record_type=l.record_type AND v.record_id=l.record_id) x
      GROUP BY date_trunc('month',work_date)
    ),
    imports AS (SELECT to_char(date_trunc('month',created_at),'YYYY-MM') month_key,count(*) imports FROM paypal_transactions GROUP BY 1)
    SELECT month_key,coalesce(m.verified_earners,0) verified_earners,
      coalesce(m.verified_cents,0) verified_cents,coalesce(m.logged_cents,0) logged_cents,coalesce(i.imports,0) imports
    FROM months m FULL OUTER JOIN imports i USING(month_key) ORDER BY month_key`;

  const aggregateSql = `
    WITH verified_first AS (
      SELECT l.player_id,l.id,l.created_at,l.amount_cents
      FROM log_entries l JOIN paypal_transactions p ON p.player_id=l.player_id AND p.routed_record_type='first' AND p.routed_record_id=l.id
      WHERE l.verified AND p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0 AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND l.amount_cents IN (p.gross_cents,p.net_cents)
        AND lower(trim(p.payer)) IN ('hyperwallet','prolific','prolific academic ltd','rev','rev.com','transcribeme','sideshift','microworkers')
        AND l.platform = CASE lower(trim(p.payer)) WHEN 'hyperwallet' THEN 'Prolific' WHEN 'prolific' THEN 'Prolific' WHEN 'prolific academic ltd' THEN 'Prolific' WHEN 'rev' THEN 'Rev' WHEN 'rev.com' THEN 'Rev' WHEN 'transcribeme' THEN 'TranscribeMe' WHEN 'sideshift' THEN 'SideShift' WHEN 'microworkers' THEN 'Microworkers' END
    ),
    verified_pairs AS (
      SELECT p.player_id,p.routed_record_type,p.routed_record_id,
        CASE p.routed_record_type WHEN 'first' THEN l.amount_cents WHEN 'income' THEN i.amount_cents WHEN 'gigs' THEN g.gross_cents WHEN 'shifts' THEN s.pay_cents+s.tips_cents WHEN 'sales' THEN a.price_cents END cents,
        CASE p.routed_record_type WHEN 'first' THEN l.minutes WHEN 'income' THEN i.content_minutes WHEN 'gigs' THEN g.hours_x100 WHEN 'shifts' THEN s.minutes_online ELSE 0 END time_units,
        CASE p.routed_record_type WHEN 'gigs' THEN 100 ELSE 60 END units_per_hour
      FROM paypal_transactions p
      LEFT JOIN log_entries l ON p.routed_record_type='first' AND l.player_id=p.player_id AND l.id=p.routed_record_id
      LEFT JOIN creator_income i ON p.routed_record_type='income' AND i.player_id=p.player_id AND i.id=p.routed_record_id
      LEFT JOIN freelance_gigs g ON p.routed_record_type='gigs' AND g.player_id=p.player_id AND g.id=p.routed_record_id
      LEFT JOIN delivery_shifts s ON p.routed_record_type='shifts' AND s.player_id=p.player_id AND s.id=p.routed_record_id
      LEFT JOIN sales a ON p.routed_record_type='sales' AND a.player_id=p.player_id AND a.id=p.routed_record_id
      WHERE p.routed_record_id IS NOT NULL AND p.currency='USD' AND p.gross_cents>0 AND p.net_cents>=0 AND p.net_cents=p.gross_cents-p.fee_cents
        AND lower(trim(p.kind)) ~ '^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$'
        AND ((p.routed_record_type='first' AND EXISTS (SELECT 1 FROM verified_first vf WHERE vf.player_id=p.player_id AND vf.id=l.id))
          OR (p.routed_record_type='income' AND i.status='paid' AND i.amount_cents IN (p.gross_cents,p.net_cents))
          OR (p.routed_record_type='gigs' AND g.stage='Paid' AND (g.gross_cents IN (p.gross_cents,p.net_cents) OR g.gross_cents-g.fee_cents IN (p.gross_cents,p.net_cents)))
          OR (p.routed_record_type='shifts' AND s.pay_cents+s.tips_cents IN (p.gross_cents,p.net_cents))
          OR (p.routed_record_type='sales' AND a.status='paid' AND (a.price_cents IN (p.gross_cents,p.net_cents) OR a.price_cents-a.fee_cents IN (p.gross_cents,p.net_cents))))
    ),
    first_counts AS (SELECT count(DISTINCT player_id) players FROM log_entries),
    first_verified_counts AS (SELECT count(DISTINCT player_id) players FROM verified_first),
    weeks AS (
      SELECT player_id,date_trunc('week',work_date) week,count(DISTINCT work_date) active_days
      FROM (SELECT player_id,worked_on work_date FROM log_entries UNION ALL SELECT player_id,earned_on FROM creator_income UNION ALL SELECT player_id,started_on FROM freelance_gigs UNION ALL SELECT player_id,worked_on FROM delivery_shifts UNION ALL SELECT player_id,sold_on FROM sales) d
      GROUP BY player_id,date_trunc('week',work_date)
    ),
    app_counts AS (
      SELECT player_id,count(DISTINCT app) apps FROM (
        SELECT player_id,'first' app FROM log_entries UNION ALL SELECT player_id,'spotlight' FROM creator_income UNION ALL SELECT player_id,'freelance' FROM freelance_gigs UNION ALL SELECT player_id,'market' FROM delivery_shifts UNION ALL SELECT player_id,'market' FROM sales
      ) a GROUP BY player_id
    ),
    hours AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (cents::numeric*units_per_hour/time_units)) median_cents
      FROM verified_pairs WHERE time_units>0),
    routed AS (
      SELECT count(*) total,
        count(*) FILTER (WHERE NOT (
          (p.routed_record_type='first' AND l.id IS NOT NULL AND l.amount_cents IN (p.gross_cents,p.net_cents)) OR
          (p.routed_record_type='income' AND i.id IS NOT NULL AND i.amount_cents IN (p.gross_cents,p.net_cents)) OR
          (p.routed_record_type='gigs' AND g.id IS NOT NULL AND (g.gross_cents IN (p.gross_cents,p.net_cents) OR g.gross_cents-g.fee_cents IN (p.gross_cents,p.net_cents))) OR
          (p.routed_record_type='shifts' AND s.id IS NOT NULL AND s.pay_cents+s.tips_cents IN (p.gross_cents,p.net_cents)) OR
          (p.routed_record_type='sales' AND a.id IS NOT NULL AND (a.price_cents IN (p.gross_cents,p.net_cents) OR a.price_cents-a.fee_cents IN (p.gross_cents,p.net_cents))))) mismatches
      FROM paypal_transactions p LEFT JOIN log_entries l ON p.routed_record_type='first' AND l.player_id=p.player_id AND l.id=p.routed_record_id
      LEFT JOIN creator_income i ON p.routed_record_type='income' AND i.player_id=p.player_id AND i.id=p.routed_record_id
      LEFT JOIN freelance_gigs g ON p.routed_record_type='gigs' AND g.player_id=p.player_id AND g.id=p.routed_record_id
      LEFT JOIN delivery_shifts s ON p.routed_record_type='shifts' AND s.player_id=p.player_id AND s.id=p.routed_record_id
      LEFT JOIN sales a ON p.routed_record_type='sales' AND a.player_id=p.player_id AND a.id=p.routed_record_id WHERE p.routed_record_id IS NOT NULL
    ),
    totals AS (SELECT (SELECT coalesce(sum(cents),0) FROM verified_pairs) verified_cents,
      (SELECT coalesce(sum(cents),0) FROM (SELECT amount_cents cents FROM log_entries UNION ALL SELECT amount_cents FROM creator_income UNION ALL SELECT gross_cents FROM freelance_gigs UNION ALL SELECT pay_cents+tips_cents FROM delivery_shifts UNION ALL SELECT price_cents FROM sales) x) logged_cents)
    SELECT (SELECT count(*) FROM players) players,(SELECT players FROM first_counts) first_players,
      (SELECT players FROM first_verified_counts) verified_first_players,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (vf.created_at-p.created_at))/3600) FROM players p JOIN LATERAL (SELECT created_at FROM verified_first x WHERE x.player_id=p.id ORDER BY created_at LIMIT 1) vf ON true) median_hours,
      (SELECT avg(active_days) FROM weeks) active_days,(SELECT avg(apps) FROM app_counts) apps,
      (SELECT count(*) FILTER (WHERE last_seen_at>=created_at+interval '7 days')::numeric*100/nullif(count(*) FILTER (WHERE created_at<=now()-interval '7 days'),0) FROM players) week1,
      (SELECT count(*) FILTER (WHERE last_seen_at>=created_at+interval '28 days')::numeric*100/nullif(count(*) FILTER (WHERE created_at<=now()-interval '28 days'),0) FROM players) week4,
      (SELECT median_cents FROM hours) median_hourly,
      (SELECT mismatches::numeric*100/nullif(total,0) FROM routed) mismatch,
      (SELECT verified_cents FROM totals) verified_cents,(SELECT logged_cents FROM totals) logged_cents,
      (SELECT count(*) FROM feedback) feedback_count`;

  try {
    const reportDate = new Date();
    const { monthly, metrics } = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const monthRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(verifiedSql);
      const agg = (await tx.$queryRawUnsafe<Record<string, unknown>[]>(aggregateSql))[0] ?? {};
      const monthly: MonthlyMetrics[] = monthRows.map(row => ({
        month: String(row.month_key), verifiedEarners: num(row.verified_earners),
        verifiedCents: num(row.verified_cents), loggedCents: num(row.logged_cents), imports: num(row.imports),
      }));
      const players = num(agg.players), firstEntryPlayers = num(agg.first_players), verifiedFirstDimePlayers = num(agg.verified_first_players);
      const ratio = (n: number, d: number) => d ? n * 100 / d : null;
      const metrics: AggregateMetrics = {
        players, firstEntryPlayers, verifiedFirstDimePlayers,
        medianHoursToFirstVerifiedDime: agg.median_hours === null ? null : num(agg.median_hours),
        averageActiveDaysPerPlayerWeek: agg.active_days === null ? null : num(agg.active_days),
        averageAppsPerPlayer: agg.apps === null ? null : num(agg.apps),
        week1RetentionPercent: agg.week1 === null ? null : num(agg.week1),
        week4RetentionPercent: agg.week4 === null ? null : num(agg.week4),
        returnAfterSevenDayGapPercent: null,
        verifiedSharePercent: ratio(num(agg.verified_cents), num(agg.logged_cents)),
        suggestionAcceptancePercent: null,
        mismatchPercent: agg.mismatch === null ? null : num(agg.mismatch),
        verifiedCents: num(agg.verified_cents),
        medianVerifiedHourlyCents: agg.median_hourly === null ? null : num(agg.median_hourly),
        feedbackCount: num(agg.feedback_count),
      };
      return { monthly, metrics };
    }, { isolationLevel: "RepeatableRead" });
    const output = formatMetricsReport(reportDate, monthly, metrics);
    await mkdir("metrics", { recursive: true });
    const path = `metrics/metrics-${reportDate.toISOString().slice(0, 10)}.md`;
    await writeFile(path, output);
    console.log(`Anonymous metrics report written to ${path}`);
  } catch (error) {
    const detail = error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[database url redacted]")
      : "unknown error";
    console.error(`Metrics report failed: ${detail}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
