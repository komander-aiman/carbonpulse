import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE } from "@/lib/config";
import { Sidebar } from "@/components/sidebar";
import { PrivacyModal } from "@/components/privacy-modal";
import { LeafMark } from "@/components/icons";
import { currentHousehold } from "@/lib/current-household";
import { buildActionsViewModel } from "@/lib/view-model";

export const metadata: Metadata = {
  title: {
    default: "CarbonPulse · Household electricity, made legible",
    template: "%s · CarbonPulse",
  },
  description:
    "CarbonPulse turns monthly electricity use into clear, practical household actions and privacy-safe township insights.",
  applicationName: "CarbonPulse",
  metadataBase: new URL(SITE.appUrl),
};

export const viewport: Viewport = {
  themeColor: "#143d35",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await currentHousehold();
  const actions = buildActionsViewModel(data);

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="app-shell">
          <Sidebar remainingActions={actions.remainingCount} />
          <div className="page-wrap">
            <header className="topbar">
              <button
                className="icon-button menu-button"
                id="menuButton"
                aria-label="Open menu"
                aria-expanded="false"
                aria-controls="sidebar"
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <div className="location-pill">
                <span className="location-dot" aria-hidden="true" />
                City of Elmina · {data.household.isDemo ? "Demo household" : "Your household"}
              </div>
              <div className="top-actions">
                <span className="evidence-tag demo">{data.household.isDemo ? "Demo" : "Your data"}</span>
                <span className="sr-only">
                  <LeafMark />
                </span>
                <div className="avatar" aria-hidden="true">
                  {data.household.displayName.slice(0, 2).toUpperCase()}
                </div>
              </div>
            </header>
            <main id="main">{children}</main>
          </div>
        </div>
        <PrivacyModal />
      </body>
    </html>
  );
}
