import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow, Notice } from "@/components/evidence";
import {
  GoalJourney,
  JourneyComparison,
  JourneyTimeline,
  JourneyTrend,
  NextStepCard,
} from "@/components/journey";
import { currentHousehold } from "@/lib/current-household";
import { buildJourneyViewModel } from "@/lib/view-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your carbon journey" };

export default async function JourneyPage() {
  const data = await currentHousehold();
  const view = buildJourneyViewModel(data);

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Your carbon journey</span>
          <h1>Progress, one confirmed bill at a time.</h1>
          <p>
            Recorded totals stay separate from normalised comparisons and estimated emissions. This
            is your private view; it never depends on community-sharing consent.
          </p>
        </div>
        <Link className="primary-button" href="/energy/upload">
          Add a bill
        </Link>
      </div>

      <EvidenceRow />

      {view.isDemo ? (
        <Notice tone="warn" title="Demo journey">
          This timeline uses seeded demonstration bills, actions and a demo namespace. Add your first
          real bill to replace the demo periods; demo history never mixes with personal records.
        </Notice>
      ) : null}

      <div className="journey-page-grid">
        <NextStepCard view={view} />
        <JourneyTimeline view={view} />
        <div className="journey-side">
          <JourneyComparison view={view} />
          <GoalJourney view={view} />
        </div>
        <JourneyTrend view={view} />
      </div>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">How to read this</span>
            <h2>Comparisons describe observed use, not proven savings</h2>
          </div>
        </div>
        <ul className="result-list">
          <li>
            <span>Recorded total</span>
            <strong>The kWh you confirmed from a bill, shown unchanged.</strong>
          </li>
          <li>
            <span>kWh per day</span>
            <strong>
              Recorded total divided by validated billing days. Different-length periods are compared
              only on this metric.
            </strong>
          </li>
          <li>
            <span>Estimated CO₂e</span>
            <strong>
              The stored factor version for that period. If factors differ between periods, emissions
              are shown but not compared, and nothing is recalculated.
            </strong>
          </li>
          <li>
            <span>Goal</span>
            <strong>
              The existing goal engine, unchanged. The Provisional or Confirmed badge appears wherever
              the goal appears.
            </strong>
          </li>
          <li>
            <span>Completed actions</span>
            <strong>
              User-reported intent. Completing an action never claims that a later reduction was
              caused by it.
            </strong>
          </li>
        </ul>
        <p className="source-note">
          There are no streaks. Missed months cost nothing, and you are never prompted to enter a bill
          you do not have.
        </p>
        {!view.hasStoredEstimates && view.trend.hasBills ? (
          <p className="source-note">
            Some periods predate stored estimates. They are recalculated from the current factor for
            display only and are marked in the timeline; the recorded kWh totals are unchanged.
          </p>
        ) : null}
      </section>

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Persistence</span>
            <h2>What survives a refresh</h2>
          </div>
        </div>
        <p className="small muted">
          Bill estimates, goal milestones and user-reported action completions are written through the
          existing server-side store. In this pilot deployment that store is process memory unless
          Supabase is configured, so saved state survives a page refresh and normal navigation but not
          a server restart or a request served by a different instance. The migration adds the
          durable <span className="mono">goal_milestone</span> table for production.
        </p>
      </section>

      <p className="source-note">
        <Link href="/actions">Review your action plan</Link> ·{" "}
        <Link href="/energy">See the energy detail</Link> ·{" "}
        <Link href="/learn">Read the method</Link>
      </p>
    </>
  );
}
