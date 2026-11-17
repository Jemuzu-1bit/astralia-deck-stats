import type { CSSProperties } from "react";

const paths = {
  user: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  edit: "m16 3 5 5-12 12-6 1 1-6z M14 5l5 5",
  logout: "M9 4H3v16h6 M9 12h12 m-5-5 5 5-5 5",
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  cards: "M8 3h11v15H8z M5 6H3v15h11v-1",
  decks: "m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 m-6-6 6 6-6 6",
  close: "m6 6 12 12 M6 18 18 6",
  book: "M12 5v16 M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1",
  play: "m8 4 13 8-13 8z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  check: "m5 12 4 4L19 6",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
} as const;

export default function ArchiveIcon({ name, size = 20, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
