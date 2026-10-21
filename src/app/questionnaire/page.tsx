import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow } from "@/components/evidence";
import { QuestionnaireForm } from "./questionnaire-form";
import { currentHousehold } from "@/lib/current-household";
import { summarise, type ProfileAnswers } from "@/domain/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Household profile" };

export default async function QuestionnairePage() {
  const data = await currentHousehold();
  const profile = data.profile;
  const summary = summarise(profile);
  const initial: ProfileAnswers | null = profile
    ? {
        homeType: profile.homeType,
        householdSize: profile.householdSize,
        airconCount: profile.airconCount,
        occupancy: profile.occupancy,
        coolingHours: profile.coolingHours,
        waterHeating: profile.waterHeating,
        evCharging: profile.evCharging,
        appliances: profile.appliances,
      }
    : null;

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <span className="eyebrow">Household profile</span>
          <h1>A minute now, a more specific plan.</h1>
          <p>
            Your answers shape the modelled estimate and which actions you see. They never change a recorded kWh.
            {summary.source === "answered" ? " You can edit them any time." : " You can skip and come back."}
          </p>
        </div>
        <Link className="secondary-button" href="/actions">
          Back to your plan
        </Link>
      </div>

      <EvidenceRow />

      {summary.source === "answered" ? (
        <p className="source-note">
          Current profile version <span className="mono">{summary.version}</span>. Modelled routine:{" "}
          <strong>{summary.archetype.replaceAll("_", " ")}</strong>.
        </p>
      ) : (
        <p className="source-note">
          No profile saved yet. Until you answer, the plan uses the <strong>mixed</strong> routine and no similar-home
          comparison is available.
        </p>
      )}

      <QuestionnaireForm initial={initial} />

      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Privacy</span>
            <h2>Where these answers go</h2>
          </div>
        </div>
        <ul className="result-list">
          <li>
            <span>Stored with your household</span>
            <strong>Home type, size, aircon count, routine, appliances</strong>
          </li>
          <li>
            <span>Used for</span>
            <strong>Archetype, action eligibility, profile band</strong>
          </li>
          <li>
            <span>Shared</span>
            <strong>Never — only the band is used to form a group of 5 or more</strong>
          </li>
          <li>
            <span>Changes recorded usage</span>
            <strong>No</strong>
          </li>
        </ul>
        <p className="source-note">
          Answers are editable. Changing one re-derives the plan and the band immediately; it never rewrites a stored
          estimate or a published aggregate.
        </p>
      </section>
    </>
  );
}
