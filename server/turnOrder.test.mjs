import assert from "node:assert/strict";
import test from "node:test";
import { startingPlayer } from "./turnOrder.js";

const player = (protagonistId, personaCards = []) => ({ protagonistId, personaCards });

test("higher Protagonist initiative starts before Persona cost is considered", () => {
  assert.equal(startingPlayer(player("dcs_02_002ex"), player("dcs_02_001ex", ["dcs_01_004ex"])), "host");
});

test("equal Protagonists use the higher total Persona cost", () => {
  assert.equal(startingPlayer(player("dcs_02_002ex", ["dcs_01_004ex"]), player("dcs_02_002ex", ["dcs_01_003ex"])), "host");
});

test("a complete tie waits for player agreement", () => {
  assert.equal(startingPlayer(player("dcs_02_002ex", ["dcs_01_004ex"]), player("dcs_02_002ex", ["dcs_01_004ex"])), null);
});
