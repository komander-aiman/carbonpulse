"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const KWH_KEY = "carbonpulse-kwh";
const ACTIONS_KEY = "carbonpulse-actions";

/**
 * One-time import of the prototype's localStorage keys. The keys are cleared
 * only after the server accepts the migrated value, so a failed request never
 * loses the resident's number. Runs once per browser, not per navigation.
 */
export function LegacyMigration() {
  const router = useRouter();

  useEffect(() => {
    const marker = "carbonpulse-migrated";
    if (window.localStorage.getItem(marker) === "1") return;

    const rawKwh = window.localStorage.getItem(KWH_KEY);
    const rawActions = window.localStorage.getItem(ACTIONS_KEY);
    if (rawKwh === null && rawActions === null) {
      window.localStorage.setItem(marker, "1");
      return;
    }

    const kwh = Number(rawKwh);
    let actions: string[] = [];
    try {
      const parsed = JSON.parse(rawActions ?? "[]");
      if (Array.isArray(parsed)) actions = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      actions = [];
    }

    (async () => {
      try {
        if (Number.isFinite(kwh) && kwh >= 1 && kwh <= 3000) {
          const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1));
          const periodEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
          const response = await fetch("/api/usage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kwh,
              periodStart: periodStart.toISOString().slice(0, 10),
              periodEnd: periodEnd.toISOString().slice(0, 10),
              source: "manual",
            }),
          });
          if (!response.ok) return;
        }

        for (const actionId of actions) {
          await fetch("/api/actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ actionId, state: "done" }),
          });
        }

        window.localStorage.removeItem(KWH_KEY);
        window.localStorage.removeItem(ACTIONS_KEY);
        window.localStorage.setItem(marker, "1");
        router.refresh();
      } catch {
        // Leave the keys in place so the next visit can retry.
      }
    })();
  }, [router]);

  return null;
}
