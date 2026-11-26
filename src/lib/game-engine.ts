export type DistributionMode = "ELIMINATION_CONTRIBUTION" | "PRIZE_SPLIT";
export type RoundOutcome = "ANNOUNCER_WON" | "ANNOUNCER_LOST";

export const MAX_ANNOUNCED_SCORE = 5;
export const MIN_ANNOUNCED_SCORE = 0;

export interface DistributionSlot {
  /** 1 = 1st eliminated, 2 = 2nd eliminated, ..., 0 = Winner (used in PRIZE_SPLIT mode) */
  order: number;
  label: string;
  percentage: number;
}

export interface PlayerRoundState {
  gamePlayerId: string;
  playerId: string;
  name: string;
  seatOrder: number;
  totalScore: number;
  isEliminated: boolean;
  eliminationOrder: number | null;
  eliminatedInRound: number | null;
  isWinner: boolean;
}

export interface RoundScoreInput {
  gamePlayerId: string;
  announcedScore: number;
}

export interface EvaluatedRoundScoreRecord {
  gamePlayerId: string;
  announcedScore: number;
  isEvaluated: boolean;
  isRoundWinner: boolean;
  points: number;
  cumulativeScore: number;
  triggeredElimination: boolean;
}

export interface RoundEvaluationResult {
  evaluatedGamePlayerId: string;
  outcome: RoundOutcome;
  totalAnnounced: number;
  winnerGamePlayerIds: string[];
  winnerNames: string[];
  resultSummary: string;
  updatedPlayers: PlayerRoundState[];
  roundScoreRecords: EvaluatedRoundScoreRecord[];
  newlyEliminated: Array<{
    gamePlayerId: string;
    name: string;
    eliminationOrder: number;
    cumulativeScore: number;
  }>;
  isGameCompleted: boolean;
  winnerGamePlayerId: string | null;
}

export interface PayoutResult {
  gamePlayerId: string;
  prizePercentage: number;
  payoutAmount: number;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ordinalLabel(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Generate default prize distribution percentages that sum strictly to 100%.
 * Matches the Pack Game spec:
 * - 4 players -> 1st eliminated: 50%, 2nd: 30%, 3rd: 20% (Winner takes 100% pool)
 */
export function generateDefaultDistribution(
  playerCount: number,
  mode: DistributionMode = "ELIMINATION_CONTRIBUTION"
): DistributionSlot[] {
  if (playerCount < 2) return [];

  if (mode === "PRIZE_SPLIT") {
    const slots: DistributionSlot[] = [
      { order: 0, label: "Winner (Last Remaining)", percentage: 100 },
    ];
    for (let i = 1; i <= playerCount - 1; i++) {
      slots.push({
        order: i,
        label: `${ordinalLabel(i)} Eliminated`,
        percentage: 0,
      });
    }
    return slots;
  }

  const eliminatedCount = playerCount - 1;
  const presets: Record<number, number[]> = {
    1: [100],
    2: [60, 40],
    3: [50, 30, 20],
    4: [40, 25, 20, 15],
    5: [35, 25, 18, 12, 10],
  };

  let percentages = presets[eliminatedCount];
  if (!percentages) {
    const weights = Array.from({ length: eliminatedCount }, (_, idx) => eliminatedCount - idx);
    const weightSum = weights.reduce((acc, w) => acc + w, 0);
    percentages = weights.map((w) => Math.floor((w / weightSum) * 100));
    const remainder = 100 - percentages.reduce((acc, p) => acc + p, 0);
    percentages[0] += remainder;
  }

  return percentages.map((percentage, idx) => ({
    order: idx + 1,
    label: `${ordinalLabel(idx + 1)} Eliminated`,
    percentage,
  }));
}

export function validatePrizeDistribution(
  distribution: DistributionSlot[],
  playerCount: number,
  mode: DistributionMode
): { valid: boolean; error?: string; totalPercentage: number } {
  const expectedSlots = mode === "ELIMINATION_CONTRIBUTION" ? playerCount - 1 : playerCount;

  if (!Array.isArray(distribution) || distribution.length !== expectedSlots) {
    return {
      valid: false,
      error: `Expected ${expectedSlots} distribution entries for ${playerCount} players.`,
      totalPercentage: 0,
    };
  }

  let total = 0;
  for (const slot of distribution) {
    if (typeof slot.percentage !== "number" || !Number.isFinite(slot.percentage)) {
      return { valid: false, error: "All percentages must be valid numbers.", totalPercentage: 0 };
    }
    if (slot.percentage < 0 || slot.percentage > 100) {
      return {
        valid: false,
        error: "Each percentage must be between 0% and 100%.",
        totalPercentage: 0,
      };
    }
    total += slot.percentage;
  }

  const roundedTotal = roundCurrency(total);
  if (Math.abs(roundedTotal - 100) > 0.01) {
    return {
      valid: false,
      error: `Prize distribution must total 100% (currently ${roundedTotal}%).`,
      totalPercentage: roundedTotal,
    };
  }

  return { valid: true, totalPercentage: roundedTotal };
}

/**
 * Evaluates a single round using the Pack Game Score-Announcement Rules:
 *
 * - One active player (`evaluatedGamePlayerId`) announces a score between 0 and 5.
 * - All other active players enter their actual round scores (any non-negative integer, no 5-pt cap).
 * - Scenario A (No other player has score <= announcer's score):
 *     Announcer wins the round -> receives 0 points.
 *     Every other active player receives their own round score.
 * - Scenario B (One or more other players have score <= announcer's score):
 *     The player(s) with the lowest score among other players win the round -> receive 0 points.
 *     Announcer loses the round -> receives the penalty sum of ALL active players' scores
 *     (including the announcer's own score, the lowest winner's score, and all other players' scores).
 *     Every other non-winning player receives their own round score.
 * - Calculated points are added to cumulative totals; any player reaching targetScore is eliminated.
 */
export function evaluateRound(
  players: PlayerRoundState[],
  scoresInput: RoundScoreInput[],
  evaluatedGamePlayerId: string,
  targetScore: number,
  nextRoundNumber: number
): RoundEvaluationResult {
  const activePlayers = players.filter((p) => !p.isEliminated);
  if (activePlayers.length <= 1) {
    throw new Error("Game already has a winner and cannot accept more rounds.");
  }

  const evaluatedPlayer = activePlayers.find((p) => p.gamePlayerId === evaluatedGamePlayerId);
  if (!evaluatedPlayer) {
    throw new Error("The selected announcer must be an active player in this round.");
  }

  const announcedMap = new Map<string, number>();
  for (const entry of scoresInput) {
    if (announcedMap.has(entry.gamePlayerId)) {
      throw new Error("Duplicate player score detected in submission.");
    }
    if (!Number.isInteger(entry.announcedScore) || entry.announcedScore < 0) {
      throw new Error("Player scores must be non-negative whole numbers.");
    }
    if (
      entry.gamePlayerId === evaluatedGamePlayerId &&
      (entry.announcedScore < MIN_ANNOUNCED_SCORE || entry.announcedScore > MAX_ANNOUNCED_SCORE)
    ) {
      throw new Error(
        `Announcer score must be between ${MIN_ANNOUNCED_SCORE} and ${MAX_ANNOUNCED_SCORE}.`
      );
    }
    announcedMap.set(entry.gamePlayerId, entry.announcedScore);
  }

  for (const active of activePlayers) {
    if (!announcedMap.has(active.gamePlayerId)) {
      throw new Error(`Missing score for active player: ${active.name}`);
    }
  }

  for (const player of players) {
    if (player.isEliminated && announcedMap.has(player.gamePlayerId)) {
      throw new Error(`Eliminated player ${player.name} cannot submit scores.`);
    }
  }

  const evaluatedAnnounced = announcedMap.get(evaluatedGamePlayerId)!;
  const totalAnnounced = activePlayers.reduce(
    (sum, p) => sum + announcedMap.get(p.gamePlayerId)!,
    0
  );

  // Special Rule: If the announcer announces 0, they ALWAYS win the round even if another player also has 0.
  // Otherwise, any other active player with score <= announcer's score challenges and defeats the announcer.
  const challengers =
    evaluatedAnnounced === 0
      ? []
      : activePlayers.filter(
          (p) =>
            p.gamePlayerId !== evaluatedGamePlayerId &&
            announcedMap.get(p.gamePlayerId)! <= evaluatedAnnounced
        );

  const outcome: RoundOutcome = challengers.length === 0 ? "ANNOUNCER_WON" : "ANNOUNCER_LOST";

  // In Scenario B, walking clockwise in circular seatOrder starting immediately after
  // the announcer, the FIRST player with score <= announcer's score is the sole Round Winner (0 pts).
  // Only the announcer receives the penalty (sum of all active players' scores);
  // all other non-winning players receive their own score.
  let winnerIds: Set<string>;
  if (outcome === "ANNOUNCER_WON") {
    winnerIds = new Set([evaluatedGamePlayerId]);
  } else {
    const orderedActive = [...activePlayers].sort((a, b) => a.seatOrder - b.seatOrder);
    const announcerIdx = orderedActive.findIndex(
      (p) => p.gamePlayerId === evaluatedGamePlayerId
    );
    const circularOthers = [
      ...orderedActive.slice(announcerIdx + 1),
      ...orderedActive.slice(0, announcerIdx),
    ];
    const firstChallengerWinner = circularOthers.find(
      (p) => announcedMap.get(p.gamePlayerId)! <= evaluatedAnnounced
    )!;
    winnerIds = new Set([firstChallengerWinner.gamePlayerId]);
  }

  const winnerNames = activePlayers
    .filter((p) => winnerIds.has(p.gamePlayerId))
    .map((p) => p.name);

  // Assign points per active player according to Scenario A / B
  const activeCandidates = activePlayers.map((p) => {
    const announcedScore = announcedMap.get(p.gamePlayerId)!;
    const isEvaluated = p.gamePlayerId === evaluatedGamePlayerId;
    const isRoundWinner = winnerIds.has(p.gamePlayerId);

    let assignedPoints = 0;
    if (isRoundWinner) {
      assignedPoints = 0;
    } else if (outcome === "ANNOUNCER_LOST" && isEvaluated) {
      assignedPoints = totalAnnounced;
    } else {
      assignedPoints = announcedScore;
    }

    return {
      ...p,
      announcedScore,
      isEvaluated,
      isRoundWinner,
      assignedPoints,
      newTotalScore: p.totalScore + assignedPoints,
    };
  });

  const existingEliminatedCount = players.filter((p) => p.isEliminated).length;

  // Players who reached or exceeded targetScore
  let crossedTarget = activeCandidates.filter((p) => p.newTotalScore >= targetScore);

  // Edge case: if every remaining active player crosses targetScore in the same round,
  // the player with the lowest cumulative score survives as Winner.
  if (crossedTarget.length === activeCandidates.length) {
    const sortedBySurvival = [...activeCandidates].sort((a, b) => {
      if (a.newTotalScore !== b.newTotalScore) return a.newTotalScore - b.newTotalScore;
      if (a.assignedPoints !== b.assignedPoints) return a.assignedPoints - b.assignedPoints;
      return a.seatOrder - b.seatOrder;
    });
    const survivorId = sortedBySurvival[0].gamePlayerId;
    crossedTarget = crossedTarget.filter((p) => p.gamePlayerId !== survivorId);
  }

  // Sort newly eliminated players: highest cumulative score eliminated first
  crossedTarget.sort((a, b) => {
    if (b.newTotalScore !== a.newTotalScore) return b.newTotalScore - a.newTotalScore;
    if (b.assignedPoints !== a.assignedPoints) return b.assignedPoints - a.assignedPoints;
    return a.seatOrder - b.seatOrder;
  });

  const eliminationOrderMap = new Map<string, number>();
  const newlyEliminated: RoundEvaluationResult["newlyEliminated"] = [];

  crossedTarget.forEach((p, idx) => {
    const order = existingEliminatedCount + idx + 1;
    eliminationOrderMap.set(p.gamePlayerId, order);
    newlyEliminated.push({
      gamePlayerId: p.gamePlayerId,
      name: p.name,
      eliminationOrder: order,
      cumulativeScore: p.newTotalScore,
    });
  });

  const candidateById = new Map(activeCandidates.map((c) => [c.gamePlayerId, c]));

  const updatedPlayers: PlayerRoundState[] = players.map((p) => {
    if (p.isEliminated) return { ...p };
    const cand = candidateById.get(p.gamePlayerId)!;
    const elimOrder = eliminationOrderMap.get(p.gamePlayerId) ?? null;
    const isNowEliminated = elimOrder !== null;
    return {
      ...p,
      totalScore: cand.newTotalScore,
      isEliminated: isNowEliminated,
      eliminationOrder: elimOrder,
      eliminatedInRound: isNowEliminated ? nextRoundNumber : null,
      isWinner: false,
    };
  });

  const survivors = updatedPlayers.filter((p) => !p.isEliminated);
  const isGameCompleted = survivors.length === 1;
  let winnerGamePlayerId: string | null = null;

  if (isGameCompleted) {
    survivors[0].isWinner = true;
    winnerGamePlayerId = survivors[0].gamePlayerId;
  }

  const roundScoreRecords: EvaluatedRoundScoreRecord[] = activeCandidates.map((c) => ({
    gamePlayerId: c.gamePlayerId,
    announcedScore: c.announcedScore,
    isEvaluated: c.isEvaluated,
    isRoundWinner: c.isRoundWinner,
    points: c.assignedPoints,
    cumulativeScore: c.newTotalScore,
    triggeredElimination: eliminationOrderMap.has(c.gamePlayerId),
  }));

  const resultSummary =
    outcome === "ANNOUNCER_WON"
      ? `${evaluatedPlayer.name} won the round (announced ${evaluatedAnnounced}, received 0 pts)`
      : `${evaluatedPlayer.name} lost the round (announced ${evaluatedAnnounced}, received +${totalAnnounced} pts). Round winner${winnerNames.length > 1 ? "s" : ""}: ${winnerNames.join(", ")}`;

  return {
    evaluatedGamePlayerId,
    outcome,
    totalAnnounced,
    winnerGamePlayerIds: Array.from(winnerIds),
    winnerNames,
    resultSummary,
    updatedPlayers,
    roundScoreRecords,
    newlyEliminated,
    isGameCompleted,
    winnerGamePlayerId,
  };
}

/**
 * Calculates final prize percentages and exact currency payouts for all players in a completed game.
 * Guarantees exact cent-level reconciliation to totalPrizePool.
 */
export function calculateFinalPayouts(
  players: PlayerRoundState[],
  totalPrizePool: number,
  distribution: DistributionSlot[],
  mode: DistributionMode
): PayoutResult[] {
  const pool = roundCurrency(totalPrizePool);
  const slotByOrder = new Map<number, DistributionSlot>();
  for (const slot of distribution) {
    slotByOrder.set(slot.order, slot);
  }

  if (mode === "ELIMINATION_CONTRIBUTION") {
    const eliminatedResults: PayoutResult[] = [];
    let winnerResult: PayoutResult | null = null;

    for (const p of players) {
      if (p.isWinner) {
        winnerResult = {
          gamePlayerId: p.gamePlayerId,
          prizePercentage: 0,
          payoutAmount: 0,
        };
      } else {
        const slot = p.eliminationOrder ? slotByOrder.get(p.eliminationOrder) : undefined;
        const pct = slot ? slot.percentage : 0;
        eliminatedResults.push({
          gamePlayerId: p.gamePlayerId,
          prizePercentage: pct,
          payoutAmount: roundCurrency((pool * pct) / 100),
        });
      }
    }

    if (eliminatedResults.length > 0) {
      const sumElim = roundCurrency(
        eliminatedResults.reduce((acc, r) => acc + r.payoutAmount, 0)
      );
      const diff = roundCurrency(pool - sumElim);
      if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.1) {
        eliminatedResults[0].payoutAmount = roundCurrency(
          eliminatedResults[0].payoutAmount + diff
        );
      }
    }

    return winnerResult ? [...eliminatedResults, winnerResult] : eliminatedResults;
  }

  const results: PayoutResult[] = players.map((p) => {
    const orderKey = p.isWinner ? 0 : (p.eliminationOrder ?? -1);
    const slot = slotByOrder.get(orderKey);
    const pct = slot ? slot.percentage : 0;
    return {
      gamePlayerId: p.gamePlayerId,
      prizePercentage: pct,
      payoutAmount: roundCurrency((pool * pct) / 100),
    };
  });

  if (results.length > 0) {
    const sum = roundCurrency(results.reduce((acc, r) => acc + r.payoutAmount, 0));
    const diff = roundCurrency(pool - sum);
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.1) {
      const largestIdx = results.reduce(
        (bestIdx, r, idx, arr) => (r.payoutAmount > arr[bestIdx].payoutAmount ? idx : bestIdx),
        0
      );
      results[largestIdx].payoutAmount = roundCurrency(results[largestIdx].payoutAmount + diff);
    }
  }

  return results;
}
