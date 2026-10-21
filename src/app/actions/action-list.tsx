"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { ActionView } from "@/lib/view-model";
import { updateActionState } from "./state-actions";
import type { HouseholdActionState } from "@/domain/actions";

const ICON: Record<string, string> = {
  cooling: "temp",
  standby: "plug",
  lighting: "lighting",
  hot_water: "hot_water",
  appliance_scheduling: "appliance_scheduling",
};

const ICON_PATH: Record<string, React.ReactNode> = {
  cooling: <path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0ZM11 6v10" />,
  standby: <path d="M8 3v6m8-6v6M6 9h12v2a6 6 0 0 1-6 6v4m-3 0h6" />,
  lighting: (
    <>
      <path d="M9 18h6M10 22h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1 .9 1.6h5.2c0-.6.3-1.2.9-1.6A6 6 0 0 0 12 3Z" />
    </>
  ),
  hot_water: <path d="M6 4h12v6a6 6 0 0 1-12 0V4Zm6 12v4" />,
  appliance_scheduling: <path d="M4 5h16v6H4V5Zm0 8h16v6H4v-6Zm4-5h.01M8 16h.01" />,
};

export function ActionList({ actions }: { actions: readonly ActionView[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    actions,
    (current, update: { id: string; state: HouseholdActionState }) =>
      current.map((action) => (action.id === update.id ? { ...action, state: update.state } : action)),
  );
  const [openTips, setOpenTips] = useState<Record<string, boolean>>({});

  const apply = (id: string, state: HouseholdActionState) => {
    startTransition(async () => {
      setOptimistic({ id, state });
      await updateActionState({ actionId: id, state });
    });
  };

  return (
    <div className="action-list">
      {optimistic.map((action) => {
        const done = action.state === "done";
        const iconKey = ICON[action.category] ?? "temp";
        return (
          <article key={action.id} className={`plan-card${done ? " completed" : ""}`}>
            <button
              className="action-check"
              type="button"
              onClick={() => apply(action.id, done ? "suggested" : "done")}
              aria-pressed={done}
              aria-label={`${done ? "Mark incomplete" : "Mark complete"}: ${action.title}`}
            >
              {done ? "\u2713" : ""}
            </button>

            <div className={`plan-icon ${iconKey}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">{ICON_PATH[action.category]}</svg>
            </div>

            <div className="plan-copy">
              <div className="plan-meta">
                <span className={`impact-pill ${action.effort === 1 ? "" : action.effort === 2 ? "medium" : "easy"}`}>
                  {action.effort === 1 ? "High impact" : action.effort === 2 ? "Medium impact" : "Easy win"}
                </span>
                <span>{action.category.replaceAll("_", " ")}</span>
                <span aria-hidden="true">&middot;</span>
                <span>Effort {action.effort}/3</span>
                <span aria-hidden="true">&middot;</span>
                <span>Rank {action.rank}</span>
                {done ? <span className="evidence-tag recorded">Done</span> : null}
                {action.state === "snoozed" ? <span className="evidence-tag cached">Snoozed</span> : null}
              </div>
              <h2>{action.title}</h2>
              <p>{action.description}</p>
              <button
                className="tip-toggle"
                type="button"
                aria-expanded={Boolean(openTips[action.id])}
                onClick={() => setOpenTips((current) => ({ ...current, [action.id]: !current[action.id] }))}
              >
                Why this fits your home <span aria-hidden="true">+</span>
              </button>
              {openTips[action.id] ? (
                <div className="tip-detail">
                  {action.tip} {action.reason} Evidence version <span className="mono">{action.evidenceVersion}</span>,
                  confidence {action.confidence}. Source: {action.source}.
                </div>
              ) : null}
              <div className="button-row" style={{ marginTop: 10 }}>
                <button
                  className="secondary-button small-button"
                  type="button"
                  onClick={() => apply(action.id, action.state === "snoozed" ? "suggested" : "snoozed")}
                >
                  {action.state === "snoozed" ? "Bring back" : "Snooze"}
                </button>
                <button
                  className="secondary-button small-button"
                  type="button"
                  onClick={() => apply(action.id, action.state === "dismissed" ? "suggested" : "dismissed")}
                >
                  {action.state === "dismissed" ? "Restore" : "Not for me"}
                </button>
              </div>
            </div>

            <div className="plan-saving">
              <span>Potential</span>
              <strong>
                {action.kwhLow}&ndash;{action.kwhHigh}
              </strong>
              <small>kWh / month</small>
              <span className="kg-range">
                {action.kgLow.toFixed(1)}&ndash;{action.kgHigh.toFixed(1)} kg CO&#8322;e
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
