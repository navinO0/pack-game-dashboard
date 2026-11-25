"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  PlusCircle,
  Trophy,
  Play,
  Gamepad2,
  Calendar,
  Users,
  Edit3,
  Trash2,
  Loader2,
  Coins,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EditGameDialog, type EditableGameData } from "@/components/EditGameDialog";
import { FulfillBetDialog, type FulfillableGame } from "@/components/FulfillBetDialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GameSummary {
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
  roundCount: number;
  startedAt: string;
  completedAt: string | null;
  winner: {
    playerId: string;
    name: string;
    payoutAmount: number;
  } | null;
  players: Array<{
    id: string;
    playerId: string;
    name: string;
    totalScore: number;
    isEliminated: boolean;
    eliminationOrder: number | null;
    isWinner: boolean;
    prizePercentage: number;
    payoutAmount: number;
  }>;
}

export default function GameHistoryPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<EditableGameData | null>(null);
  const [fulfillingGame, setFulfillingGame] = useState<FulfillableGame | null>(null);
  const [deletingGame, setDeletingGame] = useState<GameSummary | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingGame || deletingBusy) return;
    setDeletingBusy(true);
    try {
      await fetch(`/api/games/${deletingGame.id}`, { method: "DELETE" });
      setDeletingGame(null);
      await loadGames();
    } finally {
      setDeletingBusy(false);
    }
  };

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/games?${params.toString()}`);
      const data = await res.json();
      setGames(data.games || []);
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(loadGames, 200);
    return () => clearTimeout(timer);
  }, [loadGames]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Game History</h1>
            <p className="text-sm text-muted-foreground">
              Browse active tables, review completed sessions, and inspect payout records.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/games/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Game
            </Link>
          </Button>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-4 md:inline-flex md:w-auto">
              <TabsTrigger value="ALL" className="text-xs sm:text-sm">All</TabsTrigger>
              <TabsTrigger value="ACTIVE" className="text-xs sm:text-sm">Active</TabsTrigger>
              <TabsTrigger value="COMPLETED" className="text-xs sm:text-sm">Done</TabsTrigger>
              <TabsTrigger value="CANCELLED" className="text-xs sm:text-sm">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by game title or player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Games List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Gamepad2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold">No games found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Try adjusting your filters or start a brand new Pack Game session.
              </p>
              <Button asChild size="sm">
                <Link href="/games/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Game
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <Card key={game.id} className="transition-colors hover:border-foreground/20">
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={
                          game.status === "COMPLETED"
                            ? `/games/${game.id}/results`
                            : `/games/${game.id}`
                        }
                        className="text-base font-semibold hover:underline"
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
                      >
                        {game.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(game.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {game.players.length} players
                      </span>
                      <span>Target: {game.targetScore} pts</span>
                      <span>{game.roundCount} rounds</span>
                      {game.betDescription && (
                        <span className="font-medium text-foreground">
                          Bet: {game.betDescription}
                        </span>
                      )}
                      {game.isBetFulfilled ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 font-mono text-[10px]"
                        >
                          Fulfilled: {formatCurrency(game.totalPrizePool, game.currency)}
                        </Badge>
                      ) : game.status === "COMPLETED" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-800 text-[10px]"
                        >
                          Pending Fulfillment (%)
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {game.players.map((p) => (
                        <Badge
                          key={p.id}
                          variant={p.isWinner ? "default" : "outline"}
                          className={
                            p.isWinner ? "bg-emerald-600 hover:bg-emerald-600" : "font-normal"
                          }
                        >
                          {p.isWinner ? "🏆 " : ""}
                          {p.name} ({p.totalScore}
                          {game.status === "COMPLETED" && !p.isWinner
                            ? game.isBetFulfilled
                              ? ` • ${formatCurrency(p.payoutAmount, game.currency)}`
                              : ` • ${p.prizePercentage}%`
                            : ""}
                          )
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {game.status === "ACTIVE" ? (
                      <Button asChild size="sm">
                        <Link href={`/games/${game.id}`}>
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Resume
                        </Link>
                      </Button>
                    ) : (
                      <>
                        {game.status === "COMPLETED" && (
                          <Button
                            size="sm"
                            variant={game.isBetFulfilled ? "outline" : "default"}
                            onClick={() => setFulfillingGame(game)}
                          >
                            <Coins className="mr-1.5 h-3.5 w-3.5" />
                            {game.isBetFulfilled ? "Update Price" : "Fulfill Bet"}
                          </Button>
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/games/${game.id}`}>Scorecard</Link>
                        </Button>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/games/${game.id}/results`}>
                            <Trophy className="mr-1.5 h-3.5 w-3.5" />
                            Results
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setEditingGame({
                          id: game.id,
                          title: game.title,
                          targetScore: game.targetScore,
                          betDescription: game.betDescription,
                          totalPrizePool: game.totalPrizePool,
                          isBetFulfilled: game.isBetFulfilled,
                          currency: game.currency,
                          status: game.status,
                        })
                      }
                      title="Edit game"
                    >
                      <Edit3 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingGame(game)}
                      title="Delete game"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditGameDialog
        game={editingGame}
        open={Boolean(editingGame)}
        onOpenChange={(open) => {
          if (!open) setEditingGame(null);
        }}
        onSaved={loadGames}
      />

      <FulfillBetDialog
        game={fulfillingGame}
        open={Boolean(fulfillingGame)}
        onOpenChange={(open) => {
          if (!open) setFulfillingGame(null);
        }}
        onFulfilled={loadGames}
      />

      <Dialog
        open={Boolean(deletingGame)}
        onOpenChange={(open) => {
          if (!open) setDeletingGame(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Game Session?</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deletingGame?.title}</strong> and all of its recorded
              rounds and scores? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingGame(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletingBusy} onClick={handleConfirmDelete}>
              {deletingBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
