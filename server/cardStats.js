import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const cardDataPaths = [
  path.join(serverDir, "../client/public/data/cards.csv"),
  path.join(serverDir, "../client/dist/data/cards.csv"),
];

function printedStat(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const number = Number(value);
  return number <= 999 ? number : undefined;
}

const cardStats = new Map();
const cardDataPath = cardDataPaths.find(existsSync);
if (cardDataPath) {
  const rows = Papa.parse(readFileSync(cardDataPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
  for (const row of rows) {
    if (!row.id) continue;
    const face = Number(row.face);
    if (face !== 1 && face !== 2) continue;
    const key = row.id.toLowerCase();
    const faces = cardStats.get(key) || {};
    faces[face] = { atk: printedStat(row.atk), hp: printedStat(row.hp) };
    cardStats.set(key, faces);
  }
}

export function setPrintedStats(card) {
  const faces = cardStats.get(card.id.toLowerCase());
  const stats = faces?.[card.flipped ? 2 : 1] || faces?.[1] || faces?.[2];
  for (const stat of ["atk", "hp"]) {
    if (stats?.[stat] === undefined) delete card[stat];
    else card[stat] = stats[stat];
  }
}
