import type { ReactNode } from "react";

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export type IconName =
  | "grid"
  | "bolt"
  | "bulb"
  | "city"
  | "info"
  | "upload"
  | "close"
  | "download"
  | "check"
  | "menu"
  | "arrow"
  | "clock"
  | "plug"
  | "thermometer"
  | "map"
  | "book"
  | "shield"
  | "warning";

const PATHS: Record<IconName, ReactNode> = {
  grid: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7V2Z" />,
  bulb: <path d="M9 18h6M10 22h4M8.3 14.2A7 7 0 1 1 16 14c-1 .8-1.4 1.5-1.5 2H9.4c-.2-.6-.5-1.2-1.1-1.8Z" />,
  city: <path d="M3 20V9l5-4 5 4v11M13 12l4-3 4 3v8M6 20v-5h4v5M16 20v-4h2v4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.2" />
    </>
  ),
  upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />,
  check: <path d="m5 13 4 4L19 7" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  arrow: <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V8m0 5 3 2M9 2h6" />
    </>
  ),
  plug: <path d="M8 3v6m8-6v6M6 9h12v2a6 6 0 0 1-6 6v4m-3 0h6" />,
  thermometer: <path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0ZM11 6v10" />,
  map: <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Zm6-2.5v13.5M15 6.5V20" />,
  book: <path d="M7 3h8l4 4v14H7V3Zm8 0v5h4M10 13h6M10 17h6" />,
  shield: <path d="M12 3 5 6v6c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6l-7-3Zm-2 9 2 2 4-4" />,
  warning: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4m0 3v.2" />
    </>
  ),
};

export function LeafMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <path d="M27.5 5.2C18 6.4 10.7 11.1 8.4 19.1c-1.3 4.4.2 8.3 4.1 10.2 4.7 2.4 9.9-.1 12.3-4.5 2.8-5 2.6-12.2 2.7-19.6Z" />
        <path d="M9.1 28.8c2.6-6.6 7.4-11.7 14.4-15.4" />
      </svg>
    </span>
  );
}
