"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateActionState } from "@/app/actions/state-actions";

/**
 * Marks the recommended next action complete from the journey card. It calls the
 * same authenticated server action as the plan, so ownership and persistence are
 * identical; completion remains user-reported and can be undone on the plan.
 */
export function NextStepCompleteButton({ actionId }: { actionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const complete = () => {
    startTransition(async () => {
      const result = await updateActionState({ actionId, state: "done" });
      if (!result.ok) {
        setError(result.message ?? "That action could not be saved.");
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  return (
    <span className="journey-next-complete">
      <button className="secondary-button small-button" type="button" onClick={complete} disabled={pending}>
        {pending ? "Saving…" : "Mark as done"}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
