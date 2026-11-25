import test from "node:test";
import assert from "node:assert/strict";
import {
  generateDefaultDistribution,
  validatePrizeDistribution,
  evaluateRound,
  calculateFinalPayouts,
  type PlayerRoundState,
} from "../game-engine";

function makePlayers(): PlayerRoundState[] {
  return [
    { gamePlayerId: "gpA", playerId: "pA", name: "Player A", seatOrder: 1, totalScore: 0, isEliminated: false, eliminationOrder: null, eliminatedInRound: null, isWinner: false },
    { gamePlayerId: "gpB", playerId: "pB", name: "Player B", seatOrder: 2, totalScore: 0, isEliminated: false, eliminationOrder: null, eliminatedInRound: null, isWinner: false },
    { gamePlayerId: "gpC", playerId: "pC", name: "Player C", seatOrder: 3, totalScore: 0, isEliminated: false, eliminationOrder: null, eliminatedInRound: null, isWinner: false },
    { gamePlayerId: "gpD", playerId: "pD", name: "Player D", seatOrder: 4, totalScore: 0, isEliminated: false, eliminationOrder: null, eliminatedInRound: null, isWinner: false },
  ];
}

test("generateDefaultDistribution matches 4-player Pack Game spec (50/30/20)", () => {
  const dist = generateDefaultDistribution(4, "ELIMINATION_CONTRIBUTION");
  assert.equal(dist.length, 3);
  assert.deepEqual(
    dist.map((d) => d.percentage),
    [50, 30, 20]
  );
  const check = validatePrizeDistribution(dist, 4, "ELIMINATION_CONTRIBUTION");
  assert.equal(check.valid, true);
  assert.equal(check.totalPercentage, 100);
});

test("Scenario A: Announcer (0-5) beats all other players (including scores > 5) -> 0 pts for announcer, others get their scores", () => {
  const players = makePlayers();
  const res = evaluateRound(
    players,
    [
      { gamePlayerId: "gpA", announcedScore: 3 },
      { gamePlayerId: "gpB", announcedScore: 14 },
      { gamePlayerId: "gpC", announcedScore: 28 },
      { gamePlayerId: "gpD", announcedScore: 7 },
    ],
    "gpA",
    100,
    1
  );

  assert.equal(res.outcome, "ANNOUNCER_WON");
  assert.deepEqual(res.winnerGamePlayerIds, ["gpA"]);

  const recById = new Map(res.roundScoreRecords.map((r) => [r.gamePlayerId, r]));
  assert.equal(recById.get("gpA")?.points, 0);
  assert.equal(recById.get("gpA")?.isRoundWinner, true);
  assert.equal(recById.get("gpB")?.points, 14);
  assert.equal(recById.get("gpC")?.points, 28);
  assert.equal(recById.get("gpD")?.points, 7);
});

test("Scenario B: Lowest player wins (0 pts), announcer gets sum of ALL scores, other non-winners keep their own scores", () => {
  const players = makePlayers();
  const res = evaluateRound(
    players,
    [
      { gamePlayerId: "gpA", announcedScore: 4 },
      { gamePlayerId: "gpB", announcedScore: 2 },
      { gamePlayerId: "gpC", announcedScore: 25 },
      { gamePlayerId: "gpD", announcedScore: 3 },
    ],
    "gpA",
    100,
    1
  );

  assert.equal(res.outcome, "ANNOUNCER_LOST");
  assert.equal(res.totalAnnounced, 34); // 4 + 2 + 25 + 3
  assert.deepEqual(res.winnerGamePlayerIds, ["gpB"]); // Lowest score wins!

  const recById = new Map(res.roundScoreRecords.map((r) => [r.gamePlayerId, r]));
  assert.equal(recById.get("gpA")?.points, 34);
  assert.equal(recById.get("gpA")?.isRoundWinner, false);
  assert.equal(recById.get("gpB")?.points, 0);
  assert.equal(recById.get("gpB")?.isRoundWinner, true);
  assert.equal(recById.get("gpC")?.points, 25);
  assert.equal(recById.get("gpC")?.isRoundWinner, false);
  assert.equal(recById.get("gpD")?.points, 3);
  assert.equal(recById.get("gpD")?.isRoundWinner, false);
});

test("Scenario B tie: Equal score causes announcer to lose and receive sum of all scores", () => {
  const players = makePlayers();
  const res = evaluateRound(
    players,
    [
      { gamePlayerId: "gpA", announcedScore: 3 },
      { gamePlayerId: "gpB", announcedScore: 3 },
      { gamePlayerId: "gpC", announcedScore: 15 },
      { gamePlayerId: "gpD", announcedScore: 20 },
    ],
    "gpA",
    40,
    1
  );

  assert.equal(res.outcome, "ANNOUNCER_LOST");
  assert.equal(res.totalAnnounced, 41);
  assert.deepEqual(res.winnerGamePlayerIds, ["gpB"]);
  assert.equal(res.newlyEliminated.length, 1);
  assert.equal(res.newlyEliminated[0].gamePlayerId, "gpA");
  assert.equal(res.newlyEliminated[0].cumulativeScore, 41);
});

test("Rejects announcer score > 5 while allowing other players to have scores > 5", () => {
  const players = makePlayers();
  assert.throws(() =>
    evaluateRound(
      players,
      [
        { gamePlayerId: "gpA", announcedScore: 6 },
        { gamePlayerId: "gpB", announcedScore: 12 },
        { gamePlayerId: "gpC", announcedScore: 20 },
        { gamePlayerId: "gpD", announcedScore: 8 },
      ],
      "gpA",
      100,
      1
    )
  );
});

test("Full game progression to winner and exact 50/30/20 prize distribution", () => {
  let players = makePlayers();
  const r1 = evaluateRound(
    players,
    [
      { gamePlayerId: "gpA", announcedScore: 4 },
      { gamePlayerId: "gpB", announcedScore: 2 },
      { gamePlayerId: "gpC", announcedScore: 25 },
      { gamePlayerId: "gpD", announcedScore: 19 },
    ],
    "gpA",
    50,
    1
  );
  assert.equal(r1.newlyEliminated[0].gamePlayerId, "gpA"); // 50 pts -> 1st eliminated
  players = r1.updatedPlayers;

  const r2 = evaluateRound(
    players,
    [
      { gamePlayerId: "gpB", announcedScore: 5 },
      { gamePlayerId: "gpC", announcedScore: 4 },
      { gamePlayerId: "gpD", announcedScore: 20 },
    ],
    "gpB",
    50,
    2
  );
  // B gets 5+4+20=29 (total 29), C wins (0, total 25), D gets +20 (total 39)
  assert.equal(r2.isGameCompleted, false);
  players = r2.updatedPlayers;

  const r3 = evaluateRound(
    players,
    [
      { gamePlayerId: "gpB", announcedScore: 5 },
      { gamePlayerId: "gpC", announcedScore: 4 },
      { gamePlayerId: "gpD", announcedScore: 15 },
    ],
    "gpB",
    50,
    3
  );
  // B gets 24 (total 53 -> 2nd eliminated), D gets +15 (total 54 -> 3rd? Wait: D=54 > B=53 so D=2nd, B=3rd -> C wins!)
  assert.equal(r3.isGameCompleted, true);
  assert.equal(r3.winnerGamePlayerId, "gpC");

  const dist = generateDefaultDistribution(4, "ELIMINATION_CONTRIBUTION");
  const payouts = calculateFinalPayouts(r3.updatedPlayers, 1000, dist, "ELIMINATION_CONTRIBUTION");
  const byId = new Map(payouts.map((p) => [p.gamePlayerId, p]));
  assert.equal(byId.get("gpA")?.payoutAmount, 500);
  assert.equal(byId.get("gpD")?.payoutAmount, 300);
  assert.equal(byId.get("gpB")?.payoutAmount, 200);
  assert.equal(byId.get("gpC")?.payoutAmount, 0);
  assert.equal(byId.get("gpC")?.prizePercentage, 0);
});
