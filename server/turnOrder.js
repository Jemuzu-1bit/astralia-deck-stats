import { getPrintedCost } from "./cardStats.js";

function startingValues(player) {
  const initiative = getPrintedCost(player.protagonistId, "Protagonist");
  const personaCosts = player.personaCards?.map((id) => getPrintedCost(id, "Persona"));
  if (initiative === undefined || !personaCosts || personaCosts.some((cost) => cost === undefined)) {
    throw new Error("Both decks need valid Protagonist and Persona cards to start.");
  }
  return { initiative, personaTotal: personaCosts.reduce((sum, cost) => sum + cost, 0) };
}

export function startingPlayer(host, guest) {
  const a = startingValues(host);
  const b = startingValues(guest);
  if (a.initiative !== b.initiative) return a.initiative > b.initiative ? "host" : "guest";
  if (a.personaTotal !== b.personaTotal) return a.personaTotal > b.personaTotal ? "host" : "guest";
  return null;
}
