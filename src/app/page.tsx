"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Trophy,
  Users,
  Gamepad2,
  Coins,
  ArrowRight,
  Play,
  Award,
  AlertCircle,
  Flame,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getScoreRiskStyle } from "@/lib/score-colors";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardData {
  stats: {
    totalGames: number;
    activeGames: number;
    completedGames: number;
    totalPlayers: number;
    totalPrizeDistributed: number;
  };
  recentGames: Array<{
    id: string;
    title: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    targetScore: number;
    betDescription: string | null;
    totalPrizePool: number;
    isBetFulfilled: boolean;
    currency: string;
    playerCount: number;
    activePlayerCount: number;
    roundCount: number;
    winnerName: string | null;
    createdAt: string;
  }>;
  activeGameWatchlist: Array<{
    id: string;
    title: string;
    targetScore: number;
    betDescription: string | null;
    roundCount: number;
    players: Array<{
      id: string;
      playerId: string;
      name: string;
      totalScore: number;
      isEliminated: boolean;
      eliminationOrder: number | null;
      isWinner: boolean;
    }>;
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    nickname: string | null;
    gamesPlayed: number;
    wins: number;
    winRate: number;
    totalWinnings: number;
  }>;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load dashboard");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of Pack Game sessions, active tables, and top winners.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/players">
                <Users className="mr-2 h-4 w-4" />
                Manage Players
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/games/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Game
              </Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-3 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </div>
            <Button size="sm" variant="outline" onClick={loadDashboard}>
              Retry
            </Button>
          </Alert>
        ) : data ? (
          <>
            {/* KPI Metric Grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Games
                  </CardTitle>
                  <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">{data.stats.activeGames}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.stats.totalGames} total sessions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed Games
                  </CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {data.stats.completedGames}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">With verified payouts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Registered Players
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {data.stats.totalPlayers}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ready for quick select</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Prize Pool Settled
                  </CardTitle>
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {formatCurrency(data.stats.totalPrizeDistributed)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Across completed games</p>
                </CardContent>
              </Card>
            </div>

            {/* Active Games — Elimination Watch (Sorted by closest to elimination first) */}
            {data.activeGameWatchlist && data.activeGameWatchlist.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Flame className="h-5 w-5 text-red-500" />
                      Active Games — Elimination Watch
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Sorted by players closest to elimination first. Players near target score are highlighted.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {data.activeGameWatchlist.map((ag) => (
                    <Card key={ag.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{ag.title}</CardTitle>
                          <CardDescription className="text-xs">
                            Target: {ag.targetScore} pts &bull; {ag.roundCount} rounds
                            {ag.betDescription ? ` • Bet: ${ag.betDescription}` : ""}
                          </CardDescription>
                        </div>
                        <Button asChild size="sm" className="shrink-0">
                          <Link href={`/games/${ag.id}`}>
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                            Resume
                          </Link>
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        {ag.players.map((p) => {
                          const risk = getScoreRiskStyle(
                            p.totalScore,
                            ag.targetScore,
                            p.isEliminated,
                            p.isWinner
                          );
                          return (
                            <div
                              key={p.id}
                              className={`rounded-lg border p-3 space-y-1.5 transition-all ${risk.cardHighlightClass}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link
                                    href={`/players/${p.playerId}`}
                                    className="text-sm font-semibold truncate hover:underline"
                                  >
                                    {p.name}
                                  </Link>
                                  {p.isEliminated ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5">
                                      {ordinalLabel(p.eliminationOrder || 0)} Out
                                    </Badge>
                                  ) : risk.isNearElimination ? (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px] px-1.5 animate-pulse"
                                    >
                                      Near Elimination
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="flex items-baseline gap-1 font-mono shrink-0">
                                  <span
                                    className={`text-base font-extrabold tabular-nums ${risk.scoreTextClass}`}
                                  >
                                    {p.totalScore}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    /{ag.targetScore}
                                  </span>
                                </div>
                              </div>
                              <Progress
                                value={risk.pct}
                                indicatorClassName={risk.indicatorClass}
                                className="h-2"
                              />
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{risk.pct}% of target</span>
                                <span>
                                  {p.isEliminated
                                    ? "Eliminated"
                                    : `${risk.remaining} pts left`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Main 2-Column Content */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Recent Games Table */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle>Recent Game Sessions</CardTitle>
                    <CardDescription>
                      Resume active tables or inspect completed settlements.
                    </CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/games">
                      View All
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recentGames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                      <Gamepad2 className="h-9 w-9 text-muted-foreground/50 mb-3" />
                      <h3 className="text-sm font-semibold">No games created yet</h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
                        Start your first Pack Game session to track rounds, eliminations, and prize payouts.
                      </p>
                      <Button asChild size="sm">
                        <Link href="/games/new">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Create First Game
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Card List */}
                      <div className="space-y-3 sm:hidden">
                        {data.recentGames.map((game) => (
                          <div
                            key={game.id}
                            className="rounded-lg border p-3.5 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={
                                  game.status === "COMPLETED"
                                    ? `/games/${game.id}/results`
                                    : `/games/${game.id}`
                                }
                                className="font-semibold text-sm hover:underline leading-snug"
                              >
                                {game.title}
                              </Link>
                              <Badge
                                variant={
                                  game.status === "ACTIVE"
                                    ? "default"
                                    : game.status === "COMPLETED"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="shrink-0 text-[10px]"
                              >
                                {game.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {game.playerCount} players &bull; {game.roundCount} rounds &bull;{" "}
                              {formatShortDate(game.createdAt)}
                              {game.winnerName ? ` • Won by ${game.winnerName}` : ""}
                            </p>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-xs font-medium">
                                {game.isBetFulfilled ? (
                                  <span className="font-mono text-emerald-700">
                                    {formatCurrency(game.totalPrizePool, game.currency)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {game.betDescription || "Pending (%)"}
                                  </span>
                                )}
                              </span>
                              {game.status === "ACTIVE" ? (
                                <Button asChild size="sm" className="h-8">
                                  <Link href={`/games/${game.id}`}>
                                    <Play className="mr-1 h-3.5 w-3.5" />
                                    Resume
                                  </Link>
                                </Button>
                              ) : (
                                <Button asChild size="sm" variant="outline" className="h-8">
                                  <Link href={`/games/${game.id}/results`}>
                                    <Trophy className="mr-1 h-3.5 w-3.5" />
                                    Results
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Session</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Bet / Price</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.recentGames.map((game) => (
                            <TableRow key={game.id}>
                              <TableCell>
                                <Link
                                  href={
                                    game.status === "COMPLETED"
                                      ? `/games/${game.id}/results`
                                      : `/games/${game.id}`
                                  }
                                  className="font-medium hover:underline"
                                >
                                  {game.title}
                                </Link>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {game.playerCount} players &bull; {game.roundCount} rounds &bull;{" "}
                                  {formatShortDate(game.createdAt)}
                                  {game.winnerName ? ` • Won by ${game.winnerName}` : ""}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    game.status === "ACTIVE"
                                      ? "default"
                                      : game.status === "COMPLETED"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {game.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {game.isBetFulfilled ? (
                                  <span className="font-mono tabular-nums text-emerald-700">
                                    {formatCurrency(game.totalPrizePool, game.currency)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {game.betDescription || "Pending (%)"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {game.status === "ACTIVE" ? (
                                  <Button asChild size="sm" variant="default">
                                    <Link href={`/games/${game.id}`}>
                                      <Play className="mr-1.5 h-3.5 w-3.5" />
                                      Resume
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/games/${game.id}/results`}>
                                      <Trophy className="mr-1.5 h-3.5 w-3.5" />
                                      Results
                                    </Link>
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Top Winners Leaderboard */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle>Top Winners</CardTitle>
                    <CardDescription>Ranked by wins &amp; payouts</CardDescription>
                  </div>
                  <Award className="h-5 w-5 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {data.leaderboard.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                      <Trophy className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Complete a game to populate the leaderboard.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.leaderboard.map((player, idx) => (
                        <Link
                          key={player.id}
                          href={`/players/${player.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                              {idx + 1}
                            </span>
                            <Avatar className="h-8 w-8 border">
                              <AvatarFallback className="text-xs font-medium">
                                {initials(player.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium leading-none">
                                {player.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {player.wins}W / {player.gamesPlayed}G ({player.winRate}%)
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold font-mono text-emerald-600 tabular-nums">
                              {formatCurrency(player.totalWinnings)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">won</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
