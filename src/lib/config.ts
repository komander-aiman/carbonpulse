export const SITE = {
  name: "CarbonPulse",
  locale: "en-MY",
  townshipSlug: "elmina",
  townshipName: "City of Elmina",
  region: "Peninsular Malaysia",
  timeZone: "Asia/Kuala_Lumpur",
  demoHouseholdName: "Aiman",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const CONSENT_POLICY_VERSION = "2026-10-01";

export const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";

export const FRESHNESS = {
  liveHours: 48,
  cachedDays: 45,
} as const;
