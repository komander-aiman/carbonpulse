import { NextResponse } from "next/server";

/**
 * Job entry points. Every job is idempotent and writes one snapshot row keyed
 * by (source, period, checksum) in production. The scaffold returns the job
 * contract so the cron wiring is testable without a database.
 */
const JOBS = [
  "sync-national-energy",
  "sync-national-ghg",
  "sync-context-stats",
  "sync-weather",
  "recalibrate-intensity",
  "rebuild-aggregates",
  "cleanup-uploads",
] as const;

export async function GET() {
  return NextResponse.json({ ok: true, data: { jobs: JOBS } });
}

export async function POST(request: Request, context: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Cron secret required." } },
      { status: 401 },
    );
  }

  const { job } = await context.params;
  if (!(JOBS as readonly string[]).includes(job)) {
    return NextResponse.json(
      { ok: false, error: { code: "unknown_job", message: `Unknown job ${job}.` } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      job,
      status: "accepted",
      startedAt: new Date().toISOString(),
      note: "Adapter execution is wired in the deployment phase; demo mode performs no external calls.",
    },
  });
}
