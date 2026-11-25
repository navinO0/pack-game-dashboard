"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  Printer,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Crown,
  Edit3,
  Trash2,
  Loader2,
  Coins,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EditGameDialog } from "@/components/EditGameDialog";
import { FulfillBetDialog } from "@/components/FulfillBetDialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ordinalLabel } from "@/lib/game-engine";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ResultPlayer {
  id: string;
  playerId: string;
  name: string;
  nickname: string | null;
  seatOrder: number;
  totalScore: number;
  isEliminated: boolean;
  eliminationOrder: number | null;
  eliminatedInRound: number | null;
  isWinner: boolean;
  prizePercentage: number;
  payoutAmount: number;
}

interface ResultGame {
  id: string;
  title: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  targetScore: number;
  betDescription: string | null;
  totalPrizePool: number;
  isBetFulfilled: boolean;
  betFulfilledAt: string | null;
  currency: string;
  distributionMode: "ELIMINATION_CONTRIBUTION" | "PRIZE_SPLIT";
  currentRound: number;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  players: ResultPlayer[];
  rounds: Array<{
    id: string;
    roundNumber: number;
    outcome?: string;
    totalAnnounced?: number;
    resultSummary?: string | null;
    notes: string | null;
    scores: Array<{
      gamePlayerId: string;
      announcedScore?: number;
      isEvaluated?: boolean;
      isRoundWinner?: boolean;
      points: number;
      cumulativeScore: number;
      triggeredElimination: boolean;
    }>;
  }>;
}

export default function GameResultsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = String(params.id);

  const [game, setGame] = useState<ResultGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load game results");
      setGame(data.game);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const handleDeleteGame = async () => {
    if (!game || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: "DELETE" });
      if (res.ok) router.push("/games");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (!game || error) {
    return (
      <AppShell>
        <Card className="mx-auto mt-10 max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-bold">Unable to load results</h2>
            <p className="text-sm text-muted-foreground">{error || "Game not found."}</p>
            <Button asChild>
              <Link href="/games">Back to Game History</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const winner = game.players.find((p) => p.isWinner);
  const eliminatedOrdered = [...game.players]
    .filter((p) => p.isEliminated)
    .sort((a, b) => (a.eliminationOrder ?? 999) - (b.eliminationOrder ?? 999));

  const orderedRows = [...eliminatedOrdered, ...(winner ? [winner] : [])];
  const activeFallback = game.players.filter((p) => !p.isEliminated && !p.isWinner);
  const displayRows = [...orderedRows, ...activeFallback];

  const totalDistributionPct =
    game.distributionMode === "ELIMINATION_CONTRIBUTION"
      ? eliminatedOrdered.reduce((sum, p) => sum + p.prizePercentage, 0)
      : game.players.reduce((sum, p) => sum + p.prizePercentage, 0);

  const totalDistributedAmount =
    game.distributionMode === "ELIMINATION_CONTRIBUTION"
      ? eliminatedOrdered.reduce((sum, p) => sum + p.payoutAmount, 0)
      : game.players.reduce((sum, p) => sum + p.payoutAmount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between no-print">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/games">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Game History
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {game.status === "COMPLETED" && (
              <Button
                variant={game.isBetFulfilled ? "outline" : "default"}
                size="sm"
                onClick={() => setFulfillOpen(true)}
              >
                <Coins className="mr-1.5 h-4 w-4" />
                {game.isBetFulfilled ? "Update Final Price" : "Fulfill Bet"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit3 className="mr-1.5 h-4 w-4" />
              Edit Game
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/games/${game.id}`}>Edit Rounds</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/games/new?rematch=${game.id}`}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Rematch
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Winner Spotlight Card */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{game.status}</Badge>
                {game.status === "COMPLETED" && (
                  <Badge
                    variant="outline"
                    className={
                      game.isBetFulfilled
                        ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                        : "border-amber-300/40 bg-amber-500/20 text-amber-100"
                    }
                  >
                    {game.isBetFulfilled ? "Bet Fulfilled" : "Bet Pending Fulfillment"}
                  </Badge>
                )}
                <span className="text-xs text-primary-foreground/75">
                  {formatDateTime(game.completedAt || game.startedAt)}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{game.title}</h1>
              {game.betDescription && (
                <p className="text-sm font-medium text-amber-200">
                  Bet For: {game.betDescription}
                </p>
              )}
              <p className="text-sm text-primary-foreground/80">
                Target: <strong>{game.targetScore} pts</strong> &bull;{" "}
                <strong>{game.currentRound}</strong> rounds &bull;{" "}
                <strong>{game.players.length}</strong> players
              </p>
            </div>

            {winner && (
              <div className="w-full sm:w-auto sm:min-w-[240px] rounded-xl border border-white/15 bg-white/10 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                  <Crown className="h-4 w-4" />
                  Champion (Last Remaining)
                </div>
                <p className="mt-1 text-2xl font-bold">{winner.name}</p>
                <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-2.5">
                  <span className="text-xs text-primary-foreground/75">
                    Final Score: {winner.totalScore}
                  </span>
                  {game.isBetFulfilled ? (
                    <span className="font-mono text-base font-bold text-emerald-300 tabular-nums">
                      Pays {formatCurrency(0, game.currency)}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-emerald-300">
                      Pays 0% (Winner)
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prize Distribution Table */}
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>
                {game.isBetFulfilled
                  ? "Elimination Order & Final Price Settlement"
                  : "Elimination Order & Bet Share (%)"}
              </CardTitle>
              <CardDescription>
                {game.isBetFulfilled
                  ? `Bet fulfilled on ${formatDateTime(game.betFulfilledAt)}. Percentages converted to final prices.`
                  : "Percentages are recorded now. Once the bet is fulfilled, click 'Fulfill Bet' (here or in Game History) to replace percentages with the final price."}
              </CardDescription>
            </div>
            {game.isBetFulfilled ? (
              <Badge
                variant="outline"
                className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 font-mono"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Final Bill: {formatCurrency(game.totalPrizePool, game.currency)}
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setFulfillOpen(true)}>
                <Coins className="mr-1.5 h-3.5 w-3.5" />
                Finalize Price
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Mobile Stacked Cards */}
            <div className="space-y-2.5 sm:hidden">
              {displayRows.map((player) => (
                <div
                  key={player.id}
                  className={`rounded-lg border p-3.5 space-y-2 ${
                    player.isWinner ? "border-emerald-200 bg-emerald-50/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/players/${player.playerId}`}
                      className="flex items-center gap-1.5 font-semibold text-sm hover:underline truncate"
                    >
                      {player.isWinner && <Trophy className="h-4 w-4 text-amber-500 shrink-0" />}
                      {player.name}
                    </Link>
                    {player.isWinner ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                        Winner
                      </Badge>
                    ) : player.isEliminated ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {ordinalLabel(player.eliminationOrder || 0)} Out (R{player.eliminatedInRound})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-1 border-t">
                    <span className="text-muted-foreground">Score: {player.totalScore} pts</span>
                    <div className="flex items-center gap-2 font-bold">
                      <span>
                        {player.isWinner && game.distributionMode === "ELIMINATION_CONTRIBUTION"
                          ? "0%"
                          : `${player.prizePercentage}%`}
                      </span>
                      {game.isBetFulfilled && (
                        <span
                          className={
                            player.isWinner ? "text-emerald-700" : "text-destructive"
                          }
                        >
                          {player.isWinner && game.distributionMode === "ELIMINATION_CONTRIBUTION"
                            ? `${formatCurrency(0, game.currency)} (Free)`
                            : formatCurrency(player.payoutAmount, game.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Elimination Status</TableHead>
                    <TableHead className="text-right">Final Score</TableHead>
                    <TableHead className="text-right">
                      {game.isBetFulfilled ? "Share (%)" : "Bet Share (%)"}
                    </TableHead>
                    {game.isBetFulfilled && (
                      <TableHead className="text-right">Amount to Pay</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((player) => (
                    <TableRow
                      key={player.id}
                      className={player.isWinner ? "bg-emerald-50/60 hover:bg-emerald-50" : ""}
                    >
                      <TableCell>
                        <Link
                          href={`/players/${player.playerId}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          {player.isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
                          {player.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {player.isWinner ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">
                            Last Remaining (Winner)
                          </Badge>
                        ) : player.isEliminated ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">
                              {ordinalLabel(player.eliminationOrder || 0)} Eliminated
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Round {player.eliminatedInRound}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium tabular-nums">
                        {player.totalScore} pts
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold tabular-nums">
                        {player.isWinner && game.distributionMode === "ELIMINATION_CONTRIBUTION" ? (
                          <span className="text-emerald-700 font-semibold">0% (Winner)</span>
                        ) : (
                          `${player.prizePercentage}%`
                        )}
                      </TableCell>
                      {game.isBetFulfilled && (
                        <TableCell className="text-right font-mono font-bold tabular-nums">
                          {player.isWinner && game.distributionMode === "ELIMINATION_CONTRIBUTION" ? (
                            <span className="text-emerald-700">
                              {formatCurrency(0, game.currency)} (Free)
                            </span>
                          ) : game.distributionMode === "ELIMINATION_CONTRIBUTION" ? (
                            <span className="text-destructive">
                              {formatCurrency(player.payoutAmount, game.currency)}
                            </span>
                          ) : (
                            <span>{formatCurrency(player.payoutAmount, game.currency)}</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                {game.status === "COMPLETED" && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3}>Total Distribution Verified</TableCell>
                      <TableCell className="text-right font-mono text-emerald-700 tabular-nums">
                        {Math.round(totalDistributionPct * 100) / 100}%
                      </TableCell>
                      {game.isBetFulfilled && (
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCurrency(totalDistributedAmount, game.currency)}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Round-by-Round Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Round-by-Round Score Breakdown</CardTitle>
            <CardDescription>
              Complete scoring audit for all {game.rounds.length} rounds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mobile Round Breakdown Cards */}
            <div className="space-y-3 sm:hidden">
              {game.rounds.map((round) => {
                const scoreMap = new Map(round.scores.map((s) => [s.gamePlayerId, s]));
                return (
                  <div key={round.id} className="rounded-lg border p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold">Round {round.roundNumber}</span>
                    </div>
                    {round.resultSummary && (
                      <p className="text-xs text-muted-foreground leading-snug">
                        {round.resultSummary}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {game.players.map((p) => {
                        const sc = scoreMap.get(p.id);
                        return (
                          <div key={p.id} className="rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium truncate">{p.name}</span>
                              {sc ? (
                                <span
                                  className={`font-mono font-bold ${
                                    sc.points > 0 ? "text-destructive" : "text-emerald-600"
                                  }`}
                                >
                                  +{sc.points}
                                </span>
                              ) : (
                                <span className="font-mono text-muted-foreground/50">OUT</span>
                              )}
                            </div>
                            {sc && (
                              <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                <span>
                                  Score:{sc.announcedScore ?? 0}
                                  {sc.isEvaluated ? " [Ann]" : ""}
                                  {sc.isRoundWinner ? " [W]" : ""}
                                </span>
                                <span>Tot:{sc.cumulativeScore}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Round &amp; Outcome</TableHead>
                    {game.players.map((p) => (
                      <TableHead key={p.id} className="whitespace-nowrap">
                        {p.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {game.rounds.map((round) => {
                    const scoreMap = new Map(round.scores.map((s) => [s.gamePlayerId, s]));
                    return (
                      <TableRow key={round.id}>
                        <TableCell className="align-top">
                          <span className="font-mono font-semibold">Round {round.roundNumber}</span>
                          {round.resultSummary && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                              {round.resultSummary}
                            </p>
                          )}
                        </TableCell>
                        {game.players.map((p) => {
                          const sc = scoreMap.get(p.id);
                          if (!sc) {
                            return (
                              <TableCell
                                key={p.id}
                                className="font-mono text-xs text-muted-foreground/40"
                              >
                                OUT
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={p.id} className="align-top font-mono whitespace-nowrap">
                              <div>
                                <span
                                  className={`font-semibold ${
                                    sc.points > 0 ? "text-destructive" : "text-emerald-600"
                                  }`}
                                >
                                  +{sc.points}
                                </span>
                                <span
                                  className={`ml-1.5 text-xs ${
                                    sc.triggeredElimination
                                      ? "font-bold text-destructive"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  ({sc.cumulativeScore})
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span>Ann:{sc.announcedScore ?? 0}</span>
                                {sc.isEvaluated && (
                                  <span className="font-semibold text-foreground">[Eval]</span>
                                )}
                                {sc.isRoundWinner && (
                                  <span className="font-semibold text-emerald-600">[W]</span>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditGameDialog
        game={game}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={loadGame}
      />

      <FulfillBetDialog
        game={game}
        open={fulfillOpen}
        onOpenChange={setFulfillOpen}
        onFulfilled={loadGame}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Game Session?</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{game.title}</strong> and all of its recorded rounds and
              results? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteGame}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
