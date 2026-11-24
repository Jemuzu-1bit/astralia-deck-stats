import green from "../assets/decks/green_banner.png";
import red from "../assets/decks/red_banner.png";
import blue from "../assets/decks/blue_banner.png";
import pink from "../assets/decks/pink_banner.png";
import purple from "../assets/decks/purple_banner.png";
export type Chronicle = { name: string; image: string; color: string; factionLabel: string };

export const CHRONICLES: Record<string, Chronicle> = {
  green: { name: "Heroes", image: green, color: "#81be92", factionLabel: "Green faction" },
  red: { name: "Twilight", image: red, color: "#dd827c", factionLabel: "Red faction" },
  blue: { name: "Progress", image: blue, color: "#7eacd9", factionLabel: "Blue faction" },
  pink: { name: "Surveillance", image: pink, color: "#dba0c0", factionLabel: "Pink faction" },
  purple: { name: "Catastrophe", image: purple, color: "#ae95d7", factionLabel: "Purple faction" },
};

export function getChronicle(faction: string): Chronicle | undefined {
  const key = faction.toLowerCase();
  return Object.hasOwn(CHRONICLES, key) ? CHRONICLES[key] : undefined;
}
