"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LeafMark } from "@/components/icons";

const ITEMS = [
  {
    href: "/",
    label: "Overview",
    icon: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />,
  },
  {
    href: "/energy",
    label: "My energy",
    icon: <path d="m13 2-9 12h7l-1 8 10-13h-7V2Z" />,
  },
  {
    href: "/actions",
    label: "Action plan",
    icon: <path d="M9 18h6M10 22h4M8.3 14.2A7 7 0 1 1 16 14c-1 .8-1.4 1.5-1.5 2H9.4c-.2-.6-.5-1.2-1.1-1.8Z" />,
  },
  {
    href: "/community",
    label: "Precinct pulse",
    icon: <path d="M3 20V9l5-4 5 4v11M13 12l4-3 4 3v8M6 20v-5h4v5M16 20v-4h2v4" />,
  },
  {
    href: "/learn",
    label: "How it works",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.2" />
      </>
    ),
  },
] as const;

export function Sidebar({ remainingActions }: { remainingActions: number }) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const button = document.getElementById("menuButton");
    if (!sidebar || !button) return;
    const close = () => {
      sidebar.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    };
    button.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
    });
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const button = document.getElementById("menuButton");
    sidebar?.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <aside className="sidebar" id="sidebar" ref={sidebarRef}>
      <Link className="brand" href="/" aria-label="CarbonPulse home">
        <LeafMark />
        <span>
          Carbon<span>Pulse</span>
        </span>
      </Link>

      <nav aria-label="Main navigation">
        <ul className="nav-list">
          {ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  className={`nav-item${active ? " active" : ""}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {item.label}
                  {item.href === "/actions" ? (
                    <span className="nav-count" aria-label={`${remainingActions} actions remaining`}>
                      {remainingActions}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-foot">
        <div className="mini-pulse" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <p>
          Small actions.
          <br />
          <strong>Visible progress.</strong>
        </p>
        <button
          className="text-button"
          type="button"
          data-privacy-open
          onClick={() => document.dispatchEvent(new CustomEvent("carbonpulse:privacy"))}
        >
          Privacy &amp; data
        </button>
      </div>
    </aside>
  );
}
