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

test("Announce 0 special rule: Announcer with 0 ALWAYS wins even if another player also has 0; others keep their own scores", () => {
  const players = makePlayers();
  const res = evaluateRound(
    players,
    [
      { gamePlayerId: "gpA", announcedScore: 0 },
      { gamePlayerId: "gpB", announcedScore: 0 },
      { gamePlayerId: "gpC", announcedScore: 15 },
      { gamePlayerId: "gpD", announcedScore: 8 },
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
  assert.equal(recById.get("gpB")?.points, 0);
  assert.equal(recById.get("gpB")?.isRoundWinner, false);
  assert.equal(recById.get("gpC")?.points, 15);
  assert.equal(recById.get("gpD")?.points, 8);
});

test("Position tie-break: When announcer announces 1 and two others also have 1, first player after announcer in seatOrder wins (with wrap-around)", () => {
  // Seat order: A(1), B(2), C(3), D(4)
  // Case 1: B(2) announces 1; A(1)=1, C(3)=1, D(4)=10 -> C(3) comes first after B(2) -> C wins (0), A keeps 1, D keeps 10, B gets penalty 13
  const players1 = makePlayers();
  const res1 = evaluateRound(
    players1,
    [
      { gamePlayerId: "gpA", announcedScore: 1 },
      { gamePlayerId: "gpB", announcedScore: 1 },
      { gamePlayerId: "gpC", announcedScore: 1 },
      { gamePlayerId: "gpD", announcedScore: 10 },
    ],
    "gpB",
    100,
    1
  );
  assert.equal(res1.outcome, "ANNOUNCER_LOST");
  assert.deepEqual(res1.winnerGamePlayerIds, ["gpC"]);
  const r1Map = new Map(res1.roundScoreRecords.map((r) => [r.gamePlayerId, r]));
  assert.equal(r1Map.get("gpC")?.points, 0);
  assert.equal(r1Map.get("gpA")?.points, 1);
  assert.equal(r1Map.get("gpD")?.points, 10);
  assert.equal(r1Map.get("gpB")?.points, 13);

  // Case 2 (Wrap-around): C(3) announces 1; A(1)=1, B(2)=1, D(4)=8 -> order after C is D(4) -> A(1) -> B(2), so A(1) wins!
  const players2 = makePlayers();
  const res2 = evaluateRound(
    players2,
    [
      { gamePlayerId: "gpA", announcedScore: 1 },
      { gamePlayerId: "gpB", announcedScore: 1 },
      { gamePlayerId: "gpC", announcedScore: 1 },
      { gamePlayerId: "gpD", announcedScore: 8 },
    ],
    "gpC",
    100,
    1
  );
  assert.equal(res2.outcome, "ANNOUNCER_LOST");
  assert.deepEqual(res2.winnerGamePlayerIds, ["gpA"]);
  const r2Map = new Map(res2.roundScoreRecords.map((r) => [r.gamePlayerId, r]));
  assert.equal(r2Map.get("gpA")?.points, 0);
  assert.equal(r2Map.get("gpB")?.points, 1);
  assert.equal(r2Map.get("gpD")?.points, 8);
  assert.equal(r2Map.get("gpC")?.points, 11);
});

test("Next-in-order challenger wins: A(1) announces 4, B(2)=3 and C(3)=1 -> B(2) is next after A with <=4 so B wins (0), only A gets penalty (28), C keeps 1, D keeps 20", () => {
  const players = makePlayers();
  const res = evaluateRound(
    players,
    [
      { gamePlayerId: "gpA", announcedScore: 4 },
      { gamePlayerId: "gpB", announcedScore: 3 },
      { gamePlayerId: "gpC", announcedScore: 1 },
      { gamePlayerId: "gpD", announcedScore: 20 },
    ],
    "gpA",
    100,
    1
  );
  assert.equal(res.outcome, "ANNOUNCER_LOST");
  assert.deepEqual(res.winnerGamePlayerIds, ["gpB"]);
  const map = new Map(res.roundScoreRecords.map((r) => [r.gamePlayerId, r]));
  assert.equal(map.get("gpA")?.points, 28); // Only announcer gets penalty (4+3+1+20)
  assert.equal(map.get("gpB")?.points, 0);  // Next player with <= 4 wins (0 pts)
  assert.equal(map.get("gpC")?.points, 1);  // Keeps own score
  assert.equal(map.get("gpD")?.points, 20); // Keeps own score
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
