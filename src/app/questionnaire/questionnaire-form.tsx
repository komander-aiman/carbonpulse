"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  APPLIANCE_LABELS,
  COOLING_LABELS,
  HOME_TYPE_LABELS,
  OCCUPANCY_LABELS,
  WATER_HEATING_LABELS,
  archetypeFor,
  profileBand,
  type Appliance,
  type ProfileAnswers,
} from "@/domain/profile";

const DEFAULT_ANSWERS: ProfileAnswers = {
  homeType: "terrace",
  householdSize: 3,
  airconCount: 1,
  occupancy: "varies",
  coolingHours: "evening",
  waterHeating: "none",
  evCharging: false,
  appliances: [],
};

const GROUPS = [
  { title: "Your home", hint: "Two questions about the building and who lives in it." },
  { title: "Cooling", hint: "Cooling is usually the largest controllable load in Elmina homes." },
  { title: "Appliances", hint: "Optional, but it makes the plan more specific." },
] as const;

export function QuestionnaireForm({ initial }: { initial: ProfileAnswers | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<ProfileAnswers>(initial ?? DEFAULT_ANSWERS);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof ProfileAnswers>(key: K, value: ProfileAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleAppliance = (appliance: Appliance) => {
    setAnswers((current) => ({
      ...current,
      appliances: current.appliances.includes(appliance)
        ? current.appliances.filter((entry) => entry !== appliance)
        : [...current.appliances, appliance],
    }));
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!response.ok) {
        setError("We could not save your answers. Try again, or skip for now.");
        return;
      }
      router.push("/actions?saved=profile");
      router.refresh();
    });
  };

  const archetype = archetypeFor(answers);
  const band = profileBand(answers);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Step {step + 1} of {GROUPS.length} · {GROUPS[step]!.title}
          </span>
          <h2>{GROUPS[step]!.title}</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {GROUPS[step]!.hint}
          </p>
        </div>
        <span className="evidence-tag estimated">Skippable</span>
      </div>

      <div className="goal-progress" aria-hidden="true" style={{ marginBottom: 18 }}>
        <span style={{ width: `${((step + 1) / GROUPS.length) * 100}%` }} />
      </div>

      {step === 0 ? (
        <>
          <fieldset className="field">
            <legend className="field-label">Home type</legend>
            <div className="choice-grid">
              {(Object.keys(HOME_TYPE_LABELS) as (keyof typeof HOME_TYPE_LABELS)[]).map((value) => (
                <label key={value} className={`choice${answers.homeType === value ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="homeType"
                    value={value}
                    checked={answers.homeType === value}
                    onChange={() => update("homeType", value)}
                  />
                  {HOME_TYPE_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="field-label" htmlFor="householdSize">
              People in the household
            </label>
            <input
              className="text-input"
              id="householdSize"
              type="number"
              min={1}
              max={20}
              value={answers.householdSize}
              onChange={(event) => update("householdSize", Number(event.target.value))}
            />
            <small className="field-hint">Used only to group similar homes. Never shown to anyone else.</small>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="airconCount">
              How many air conditioners?
            </label>
            <input
              className="text-input"
              id="airconCount"
              type="number"
              min={0}
              max={20}
              value={answers.airconCount}
              onChange={(event) => update("airconCount", Number(event.target.value))}
            />
          </div>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <fieldset className="field">
            <legend className="field-label">When is the home occupied?</legend>
            <div className="choice-grid">
              {(Object.keys(OCCUPANCY_LABELS) as (keyof typeof OCCUPANCY_LABELS)[]).map((value) => (
                <label key={value} className={`choice${answers.occupancy === value ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="occupancy"
                    value={value}
                    checked={answers.occupancy === value}
                    onChange={() => update("occupancy", value)}
                  />
                  {OCCUPANCY_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">When does cooling usually run?</legend>
            <div className="choice-grid">
              {(Object.keys(COOLING_LABELS) as (keyof typeof COOLING_LABELS)[]).map((value) => (
                <label key={value} className={`choice${answers.coolingHours === value ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="coolingHours"
                    value={value}
                    checked={answers.coolingHours === value}
                    onChange={() => update("coolingHours", value)}
                  />
                  {COOLING_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <fieldset className="field">
            <legend className="field-label">Water heating</legend>
            <div className="choice-grid">
              {(Object.keys(WATER_HEATING_LABELS) as (keyof typeof WATER_HEATING_LABELS)[]).map((value) => (
                <label key={value} className={`choice${answers.waterHeating === value ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="waterHeating"
                    value={value}
                    checked={answers.waterHeating === value}
                    onChange={() => update("waterHeating", value)}
                  />
                  {WATER_HEATING_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="consent-row">
            <input
              type="checkbox"
              checked={answers.evCharging}
              onChange={(event) => update("evCharging", event.target.checked)}
            />
            <span>
              <b>We charge an electric vehicle at home</b>
              <small>Adds an off-peak charging action. It does not change your recorded kWh.</small>
            </span>
          </label>

          <fieldset className="field">
            <legend className="field-label">Which appliances do you have? (optional)</legend>
            <div className="choice-grid">
              {(Object.keys(APPLIANCE_LABELS) as Appliance[]).map((value) => (
                <label key={value} className={`choice${answers.appliances.includes(value) ? " selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={answers.appliances.includes(value)}
                    onChange={() => toggleAppliance(value)}
                  />
                  {APPLIANCE_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <div className="panel section-gap" style={{ background: "#eef3eb" }}>
        <span className="eyebrow">What this sets</span>
        <p className="small" style={{ margin: "6px 0 0" }}>
          Modelled routine: <strong>{archetype.replaceAll("_", " ")}</strong> · Profile band:{" "}
          <strong>
            {band.homeType} · {band.sizeBand} people · {band.airconBand} aircon
          </strong>
        </p>
        <p className="source-note">
          This shapes the modelled estimate and which actions you see. It never changes a recorded kWh.
        </p>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="button-row" style={{ marginTop: 18 }}>
        {step > 0 ? (
          <button className="secondary-button" type="button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : (
          <a className="secondary-button" href="/actions">
            Skip for now
          </a>
        )}
        {step < GROUPS.length - 1 ? (
          <button className="primary-button" type="button" onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        )}
      </div>
    </section>
  );
}
