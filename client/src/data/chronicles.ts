import green from "../assets/decks/green_banner.png";
import red from "../assets/decks/red_banner.png";
import blue from "../assets/decks/blue_banner.png";
import pink from "../assets/decks/pink_banner.png";
import purple from "../assets/decks/purple_banner.png";
export const CHRONICLES: Record<string, { name: string; image: string; color: string }> = {
  green: { name: "Heroes", image: green, color: "#81be92" },
  red: { name: "Twilight", image: red, color: "#dd827c" },
  blue: { name: "Progress", image: blue, color: "#7eacd9" },
  pink: { name: "Surveillance", image: pink, color: "#dba0c0" },
  purple: { name: "Catastrophe", image: purple, color: "#ae95d7" },
};
