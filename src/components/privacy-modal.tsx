"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PRINCIPLES = [
  {
    heading: "You confirm the input.",
    body: "There is no OCR. A bill photo is a local reference only: it never leaves this device, is never read automatically, and is never stored. The kWh you type is the value CarbonPulse uses.",
  },
  {
    heading: "Aggregation is optional.",
    body: "Only consenting records contribute to zone statistics, and consent can be withdrawn any time. You can always read what the zone publishes, whether or not you share.",
  },
  {
    heading: "Small groups are hidden.",
    body: "A zone below 5 consenting households is suppressed everywhere, including map layers, the shared goal, and the similar-home comparison. Counts and kWh are rounded to 5.",
  },
  {
    heading: "No household on the map.",
    body: "The map shows zone shapes and public places only. No household coordinates are stored or drawn, at any zoom level.",
  },
];

export function PrivacyModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = () => {
      restoreRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    document.addEventListener("carbonpulse:privacy", handler);
    return () => document.removeEventListener("carbonpulse:privacy", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      restoreRef.current?.focus();
      return;
    }
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="privacyTitle">
      <button className="modal-backdrop" type="button" aria-label="Close privacy panel" onClick={close} />
      <div className="modal-card privacy-card" ref={dialogRef}>
        <button className="modal-close" type="button" onClick={close} aria-label="Close">
          ×
        </button>
        <span className="eyebrow">Privacy &amp; data</span>
        <h2 id="privacyTitle">Designed for consent, not surveillance.</h2>
        <div className="privacy-list">
          {PRINCIPLES.map((principle, index) => (
            <div key={principle.heading}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>
                <strong>{principle.heading}</strong>
                {principle.body}
              </p>
            </div>
          ))}
        </div>
        <button className="secondary-button full-button" type="button" onClick={close}>
          Got it
        </button>
      </div>
    </div>
  );
}
