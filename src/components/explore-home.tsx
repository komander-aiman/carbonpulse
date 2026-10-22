"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { ExploreArea, ExploreAreaId, ExploreModel } from "@/domain/explore";
import { EvidenceTag } from "@/components/evidence";

const AREA_POSITION: Readonly<Record<ExploreAreaId, { left: string; top: string }>> = {
  bedroom: { left: "33%", top: "46%" },
  living: { left: "62%", top: "47%" },
  kitchen: { left: "27%", top: "78%" },
  bathroom: { left: "65%", top: "76%" },
  lighting: { left: "46%", top: "29%" },
};

function AreaIcon({ area }: { area: ExploreAreaId }) {
  switch (area) {
    case "bedroom":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 18v-6h18v6M3 18v2m18-2v2M6 12V8h5v4M13 12V8h5v4" />
        </svg>
      );
    case "living":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12V7h16v5M3 12h18v6H3v-6Zm3 6v2m12-2v2" />
          <path d="M8 10h8" />
        </svg>
      );
    case "kitchen":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3h14v18H5V3Zm0 8h14M9 7h.01M9 15h.01" />
        </svg>
      );
    case "bathroom":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Zm4 0V6a2 2 0 0 1 4 0M7 21l-1-2m12 2 1-2" />
        </svg>
      );
    case "lighting":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18h6M10 22h4M8.3 14.2A7 7 0 1 1 16 14c-1 .8-1.4 1.5-1.5 2H9.4c-.2-.6-.5-1.2-1.1-1.8Z" />
        </svg>
      );
  }
}

function effortLabel(effort: 1 | 2 | 3): string {
  if (effort === 1) return "Low effort";
  if (effort === 2) return "Medium effort";
  return "Higher effort";
}

function ExploreActionItem({ action }: { action: ExploreArea["actions"][number] }) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <li className="explore-action">
      <div className="explore-action-head">
        <h4>{action.title}</h4>
        <EvidenceTag label="Estimated" />
      </div>
      <p>{action.description}</p>
      <div className="explore-action-meta">
        <span>{effortLabel(action.effort)} · effort {action.effort}/3</span>
        <span>
          <b>
            {action.kwhLow}–{action.kwhHigh} kWh
          </b>{" "}
          / month
        </span>
        <span>
          <b>
            {action.kgLow.toFixed(1)}–{action.kgHigh.toFixed(1)} kg CO₂e
          </b>
        </span>
        {action.state === "done" ? <span className="evidence-tag recorded">Done · user-reported</span> : null}
        {action.state === "snoozed" ? <span className="evidence-tag cached">Snoozed</span> : null}
      </div>
      <button
        className="tip-toggle"
        type="button"
        aria-expanded={whyOpen}
        onClick={() => setWhyOpen((open) => !open)}
      >
        Why this fits {whyOpen ? "−" : "+"}
      </button>
      {whyOpen ? (
        <div className="tip-detail">
          {action.tip} {action.reason} Evidence version{" "}
          <span className="mono">{action.evidenceVersion}</span>, confidence {action.confidence}. Source:{" "}
          {action.source}.
        </div>
      ) : null}
    </li>
  );
}

export function ExploreHome({ model }: { model: ExploreModel }) {
  const [selectedId, setSelectedId] = useState<ExploreAreaId>(
    model.areas.find((area) => area.actions.length > 0)?.id ?? model.areas[0]!.id,
  );
  const panelId = useId();
  const selected = model.areas.find((area) => area.id === selectedId) ?? model.areas[0]!;
  const selectedCount = selected.actions.length;
  const statusText = `${selected.label} selected. ${
    selectedCount === 1 ? "1 action" : `${selectedCount} actions`
  } shown.`;

  return (
    <section className="panel section-gap explore" aria-labelledby="explore-home-heading">
      <div className="panel-heading explore-heading">
        <div>
          <span className="eyebrow">Explore your home</span>
          <h2 id="explore-home-heading">Where could you start?</h2>
          <p className="small muted explore-intro">
            Choose a room or the lighting in your home to see the actions that fit your household. A monthly bill
            measures the whole home, not individual appliances, so this guide points to actions instead of inventing a
            usage breakdown.
          </p>
        </div>
        <span className={`evidence-tag ${model.tailored ? "practical" : "demo"}`}>
          {model.tailored ? "Tailored to your profile" : "General guidance"}
        </span>
      </div>

      {!model.tailored ? (
        <div className="explore-profile-note">
          <p>
            No household profile is on file, so these rooms show the general <strong>mixed</strong> guidance. Answer the
            short questionnaire to hide rooms and actions that do not apply to your home.
          </p>
          <Link className="secondary-button small-button" href="/questionnaire">
            Complete your profile
          </Link>
        </div>
      ) : null}

      <div className="explore-layout">
        <div className="explore-visual">
          <div className="explore-illustration">
            <svg className="explore-svg" viewBox="0 0 720 460" role="img" aria-label="Illustration of a home with selectable rooms: bedroom, living room, kitchen, bathroom and lighting. Use the room list below for the same choices.">
              <defs>
                <linearGradient id="explore-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8f4ea" />
                  <stop offset="100%" stopColor="#f7f4e8" />
                </linearGradient>
                <linearGradient id="explore-wall" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fffdf7" />
                  <stop offset="100%" stopColor="#f2eee0" />
                </linearGradient>
              </defs>

              <rect width="720" height="460" rx="28" fill="url(#explore-sky)" />

              <circle cx="82" cy="74" r="30" fill="#ffdfc8" opacity="0.7" />
              <path d="M82 32v-8M82 124v-8M40 74h-8M124 74h-8M52 44l-6-6M112 44l6-6" className="explore-sun-ray" />
              <ellipse cx="140" cy="405" rx="70" ry="9" fill="#cfe5cd" opacity="0.7" />
              <ellipse cx="592" cy="405" rx="86" ry="10" fill="#cfe5cd" opacity="0.7" />

              <g className="explore-house">
                <path className="explore-roof" d="M98 158 344 34l246 124Z" />
                <path className="explore-roof-line" d="M120 158 344 48l224 110" />
                <rect className="explore-house-body" x="118" y="158" width="452" height="240" rx="8" />
                <rect className="explore-floor" x="126" y="274" width="436" height="4" rx="2" />
                <rect className="explore-wall-divider" x="340" y="158" width="4" height="240" rx="2" />
                <rect className="explore-door" x="318" y="348" width="48" height="50" rx="5" />
                <circle cx="357" cy="374" r="2.5" fill="#195143" />
                <rect className="explore-window" x="152" y="184" width="66" height="54" rx="6" />
                <path className="explore-window-glint" d="M160 192v36M152 211h66" />
                <rect className="explore-window" x="470" y="184" width="66" height="54" rx="6" />
                <path className="explore-window-glint" d="M478 192v36M470 211h66" />

                <g className="explore-room explore-room-bedroom">
                  <rect x="238" y="214" width="78" height="44" rx="5" />
                  <rect x="246" y="206" width="26" height="14" rx="4" />
                  <path d="M238 258v14M316 258v14M316 218h14" />
                  <rect className="explore-ac" x="264" y="180" width="42" height="16" rx="4" />
                  <path className="explore-breeze" d="M270 202c-6 6-6 12 0 18M280 202c-3 7-3 12 0 18" />
                </g>

                <g className="explore-room explore-room-living">
                  <rect x="372" y="230" width="82" height="22" rx="7" />
                  <rect x="372" y="214" width="82" height="20" rx="7" />
                  <path d="M380 252v8M446 252v8" />
                  <rect x="468" y="228" width="58" height="30" rx="4" />
                  <path d="M495 258v8M468 246h58" />
                  <path className="explore-signal" d="M482 220c8-8 18-8 26 0" />
                </g>

                <g className="explore-room explore-room-kitchen">
                  <rect x="150" y="336" width="150" height="42" rx="5" />
                  <rect x="158" y="290" width="48" height="88" rx="5" />
                  <path d="M158 316h48M158 346h48" />
                  <rect x="222" y="302" width="58" height="34" rx="4" />
                  <circle cx="252" cy="318" r="9" />
                  <path d="M236 336v22M266 336v22" />
                  <path className="explore-steam" d="M248 294c-5-8 5-12 0-20M262 294c-5-8 5-12 0-20" />
                </g>

                <g className="explore-room explore-room-bathroom">
                  <rect x="388" y="290" width="56" height="88" rx="5" />
                  <path d="M388 320h56M388 352h56" />
                  <path d="M462 350h74M470 350v28M528 350v28" />
                  <path className="explore-water" d="M476 332c4-6 12-6 16 0M496 332c4-6 12-6 16 0" />
                </g>

                <g className="explore-lamp">
                  <path d="M344 158v26" />
                  <path d="M330 184h28l-5 13h-18Z" className="explore-lamp-shade" />
                  <path d="M336 197v8M352 197v8" />
                  <path className="explore-lamp-glow" d="M320 210c16 10 32 10 48 0" />
                </g>
              </g>

              <path className="explore-ground" d="M70 398h580" />
              <g className="explore-plant">
                <path d="M600 398v-42" />
                <path d="M600 374c-18-2-24-14-24-24 16 0 24 10 24 24Z" />
                <path d="M600 362c16-2 22-14 22-24-14 0-22 10-22 24Z" />
                <path d="M588 398h24l-4-18h-16Z" />
              </g>
              <g className="explore-plant small">
                <path d="M638 398v-28" />
                <path d="M638 382c-12-1-16-10-16-17 11 0 16 7 16 17Z" />
                <path d="M638 374c11-1 15-10 15-17-10 0-15 7-15 17Z" />
                <path d="M630 398h16l-3-12h-10Z" />
              </g>

              <g className="explore-glow-sweep" aria-hidden="true">
                <circle cx="344" cy="196" r="58" />
              </g>
            </svg>

            {model.areas.map((area) => {
              const position = AREA_POSITION[area.id];
              const isSelected = area.id === selected.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  className="explore-hotspot"
                  data-area={area.id}
                  style={{ left: position.left, top: position.top }}
                  aria-pressed={isSelected}
                  aria-controls={panelId}
                  onClick={() => setSelectedId(area.id)}
                >
                  <span className="explore-hotspot-icon">
                    <AreaIcon area={area.id} />
                  </span>
                  <span className="explore-hotspot-text">
                    <b>{area.label}</b>
                    <small>
                      {area.actions.length} {area.actions.length === 1 ? "action" : "actions"}
                    </small>
                  </span>
                  <span className="explore-hotspot-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          <div className="explore-room-list" role="group" aria-label="Rooms and lighting">
            {model.areas.map((area) => {
              const isSelected = area.id === selected.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  className="explore-room-button"
                  aria-pressed={isSelected}
                  aria-controls={panelId}
                  onClick={() => setSelectedId(area.id)}
                >
                  <span className="explore-room-button-icon">
                    <AreaIcon area={area.id} />
                  </span>
                  <span>
                    <b>{area.label}</b>
                    <small>{area.description}</small>
                  </span>
                  <span className="explore-room-count">
                    {area.actions.length}
                    <span className="sr-only"> actions</span>
                  </span>
                  <span className="explore-room-check" aria-hidden="true">
                    {isSelected ? "Selected" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="explore-details" id={panelId} role="region" aria-labelledby={`${panelId}-heading`}>
          <p className="sr-only" aria-live="polite">
            {statusText}
          </p>
          <div className="explore-details-head">
            <div>
              <span className="eyebrow">Selected area</span>
              <h3 id={`${panelId}-heading`}>{selected.label}</h3>
              <p>{selected.description}</p>
            </div>
            <span className="explore-details-icon" aria-hidden="true">
              <AreaIcon area={selected.id} />
            </span>
          </div>

          {selected.actions.length > 0 ? (
            <>
              <ul className="explore-action-list">
                {selected.actions.map((action) => (
                  <ExploreActionItem key={action.id} action={action} />
                ))}
              </ul>
              <p className="explore-savings-note">
                Ranges are estimated monthly savings from the versioned action catalog. They are not measured, and they
                are not added together here. The action plan combines them with the overlap discount and the 35%
                baseline cap.
              </p>
            </>
          ) : (
            <div className="explore-empty">
              <span className="explore-empty-icon" aria-hidden="true">
                <AreaIcon area={selected.id} />
              </span>
              <h4>{selected.emptyTitle}</h4>
              <p>{selected.emptyBody}</p>
            </div>
          )}

          <div className="explore-details-foot">
            <Link className="primary-button" href="/actions#action-plan">
              Open your ranked action plan
            </Link>
            {model.tailored ? (
              <Link className="explore-text-link" href="/questionnaire">
                Edit household profile
              </Link>
            ) : (
              <Link className="explore-text-link" href="/questionnaire">
                Complete household profile
              </Link>
            )}
          </div>
        </div>
      </div>

      <p className="explore-footnote">
        <strong>How this is modelled:</strong> a monthly bill records total kWh, not per-room use. These suggestions
        reuse the same ranked actions and evidence versions (
        {model.evidenceVersions.join(", ") || "current catalog"}) as your action plan, with the same{" "}
        {model.factorKgPerKwh.toFixed(3)} kg CO₂e per kWh factor ({model.factorId}). No room-level percentage or
        appliance consumption is shown as recorded data.
      </p>
    </section>
  );
}
