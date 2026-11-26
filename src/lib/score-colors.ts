export interface ScoreRiskStyle {
  pct: number;
  remaining: number;
  level: "winner" | "eliminated" | "danger" | "warning" | "safe";
  isNearElimination: boolean;
  indicatorClass: string;
  scoreTextClass: string;
  cardHighlightClass: string;
  badgeText: string | null;
}

/**
 * Computes consistent color-coded progress bar classes & near-elimination highlight
 * based on a player's cumulative score vs the game's targetScore.
 */
export function getScoreRiskStyle(
  totalScore: number,
  targetScore: number,
  isEliminated: boolean,
  isWinner: boolean
): ScoreRiskStyle {
  const safeTarget = Math.max(1, targetScore);
  const pct = Math.min(100, Math.round((totalScore / safeTarget) * 100));
  const remaining = Math.max(0, targetScore - totalScore);

  if (isWinner) {
    return {
      pct,
      remaining,
      level: "winner",
      isNearElimination: false,
      indicatorClass: "bg-emerald-600",
      scoreTextClass: "text-emerald-700",
      cardHighlightClass: "border-emerald-300 bg-emerald-50/70",
      badgeText: "Winner",
    };
  }

  if (isEliminated) {
    return {
      pct: 100,
      remaining: 0,
      level: "eliminated",
      isNearElimination: false,
      indicatorClass: "bg-destructive/75",
      scoreTextClass: "text-destructive",
      cardHighlightClass: "border-destructive/30 bg-destructive/5 opacity-75",
      badgeText: "Eliminated",
    };
  }

  // Near elimination: >= 75% of target score OR <= 10 points left (when target >= 20)
  const isNearElimination = pct >= 75 || (targetScore >= 20 && remaining <= 10);

  if (isNearElimination) {
    return {
      pct,
      remaining,
      level: "danger",
      isNearElimination: true,
      indicatorClass: "bg-red-500",
      scoreTextClass: "text-red-600",
      cardHighlightClass:
        "border-red-400 bg-red-50/80 ring-2 ring-red-500/25 shadow-sm",
      badgeText: "Near Out",
    };
  }

  if (pct >= 50) {
    return {
      pct,
      remaining,
      level: "warning",
      isNearElimination: false,
      indicatorClass: "bg-amber-500",
      scoreTextClass: "text-amber-700",
      cardHighlightClass: "border-amber-200 bg-amber-50/30",
      badgeText: null,
    };
  }

  return {
    pct,
    remaining,
    level: "safe",
    isNearElimination: false,
    indicatorClass: "bg-emerald-500",
    scoreTextClass: "text-foreground",
    cardHighlightClass: "bg-card",
    badgeText: null,
  };
}

