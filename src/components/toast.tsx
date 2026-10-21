"use client";

import { useEffect, useState } from "react";

type ToastDetail = { title: string; body: string };

export function useToast() {
  const [message, setMessage] = useState<ToastDetail | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3800);
    return () => window.clearTimeout(timer);
  }, [message]);

  return {
    show: (title: string, body: string) => setMessage({ title, body }),
    node: (
      <div className={`toast${message ? " show" : ""}`} role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <p>
          <strong>{message?.title ?? ""}</strong>
          <small>{message?.body ?? ""}</small>
        </p>
      </div>
    ),
  };
}
