"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  AlertCircle,
  CheckCircle2,
  Skull,
  Undo2,
  Send,
  ShieldAlert,
  ArrowRight,
  Ban,
  Hash,
  Megaphone,
  Award,
  Loader2,
  Edit3,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EditGameDialog } from "@/components/EditGameDialog";
import { formatCurrency } from "@/lib/format";
import { getScoreRiskStyle } from "@/lib/score-colors";
import {
  evaluateRound,
  ordinalLabel,
  type PlayerRoundState,
  type RoundOutcome,
} from "@/lib/game-engine";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GamePlayerDTO {
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

interface RoundScoreDTO {
  id: string;
  gamePlayerId: string;
  announcedScore: number;
  isEvaluated: boolean;
  isRoundWinner: boolean;
  points: number;
  cumulativeScore: number;
  triggeredElimination: boolean;
}

interface RoundDTO {
  id: string;
  roundNumber: number;
  evaluatedGamePlayerId: string | null;
  outcome: RoundOutcome;
  totalAnnounced: number;
  resultSummary: string | null;
  notes: string | null;
  createdAt: string;
  scores: RoundScoreDTO[];
}

interface GameDetailDTO {
  id: string;
  title: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  targetScore: number;
  betDescription: string | null;
  totalPrizePool: number;
  isBetFulfilled: boolean;
  currency: string;
  distributionMode: "ELIMINATION_CONTRIBUTION" | "PRIZE_SPLIT";
  currentRound: number;
  version: number;
  notes: string | null;
  players: GamePlayerDTO[];
  rounds: RoundDTO[];
}

const ANNOUNCE_OPTIONS = [0, 1, 2, 3, 4, 5];

function generateIdempotencyKey(gameId: string, roundNumber: number): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${gameId}-r${roundNumber}-${rand}`;
}

export default function ActiveGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = String(params.id);

  const [game, setGame] = useState<GameDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Modal state triggered when clicking a 0-5 announce button on any player
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [announcerId, setAnnouncerId] = useState<string>("");
  const [announcerScore, setAnnouncerScore] = useState<number>(1);
  const [otherScores, setOtherScores] = useState<Record<string, string>>({});
  const [roundNotes, setRoundNotes] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Game Edit & Delete dialogs
  const [editGameOpen, setEditGameOpen] = useState(false);
  const [deleteGameOpen, setDeleteGameOpen] = useState(false);
  const [deletingGame, setDeletingGame] = useState(false);

  // Round Edit & Delete dialogs
  const [editingRound, setEditingRound] = useState<RoundDTO | null>(null);
  const [editRoundAnnouncerId, setEditRoundAnnouncerId] = useState("");
  const [editRoundScores, setEditRoundScores] = useState<Record<string, string>>({});
  const [editRoundNotes, setEditRoundNotes] = useState("");
  const [editRoundError, setEditRoundError] = useState<string | null>(null);
  const [savingRound, setSavingRound] = useState(false);

  const [deletingRound, setDeletingRound] = useState<RoundDTO | null>(null);
  const [deletingRoundBusy, setDeletingRoundBusy] = useState(false);

  // Drag & drop seat reordering
  const [dragPlayerId, setDragPlayerId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const scoreInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const editScoreInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load game");
      const loaded: GameDetailDTO = data.game;
      setGame(loaded);
      setIdempotencyKey(generateIdempotencyKey(loaded.id, loaded.currentRound + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  const activePlayers = useMemo(
    () => (game ? game.players.filter((p) => !p.isEliminated) : []),
    [game]
  );

  const eliminatedPlayers = useMemo(
    () =>
      game
        ? game.players
            .filter((p) => p.isEliminated)
            .sort((a, b) => (a.eliminationOrder ?? 999) - (b.eliminationOrder ?? 999))
        : [],
    [game]
  );

  const announcerPlayer = useMemo(
    () => activePlayers.find((p) => p.id === announcerId) || null,
    [activePlayers, announcerId]
  );

  const otherActivePlayers = useMemo(
    () => activePlayers.filter((p) => p.id !== announcerId),
    [activePlayers, announcerId]
  );

  // Triggered when user clicks 0..5 on a player row
  const handleAnnounceClick = (playerId: string, score: number) => {
    setAnnouncerId(playerId);
    setAnnouncerScore(score);
    const initOthers: Record<string, string> = {};
    activePlayers
      .filter((p) => p.id !== playerId)
      .forEach((p) => {
        initOthers[p.id] = "";
      });
    setOtherScores(initOthers);
    setRoundNotes("");
    setModalError(null);
    setScoreModalOpen(true);
  };

  // Live preview inside the modal as other players' scores are typed
  const livePreview = useMemo(() => {
    if (!game || !scoreModalOpen || !announcerId || activePlayers.length < 2) {
      return null;
    }

    const inputs: Array<{ gamePlayerId: string; announcedScore: number }> = [
      { gamePlayerId: announcerId, announcedScore: announcerScore },
    ];

    for (const p of otherActivePlayers) {
      const raw = otherScores[p.id];
      if (raw === undefined || raw.trim() === "") return null;
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 0) return null;
      inputs.push({ gamePlayerId: p.id, announcedScore: num });
    }

    try {
      const states: PlayerRoundState[] = game.players.map((gp) => ({
        gamePlayerId: gp.id,
        playerId: gp.playerId,
        name: gp.name,
        seatOrder: gp.seatOrder,
        totalScore: gp.totalScore,
        isEliminated: gp.isEliminated,
        eliminationOrder: gp.eliminationOrder,
        eliminatedInRound: gp.eliminatedInRound,
        isWinner: gp.isWinner,
      }));
      return evaluateRound(
        states,
        inputs,
        announcerId,
        game.targetScore,
        game.currentRound + 1
      );
    } catch {
      return null;
    }
  }, [game, scoreModalOpen, announcerId, announcerScore, activePlayers, otherActivePlayers, otherScores]);

  const previewByPlayerId = useMemo(() => {
    if (!livePreview) return new Map();
    return new Map(livePreview.roundScoreRecords.map((r) => [r.gamePlayerId, r]));
  }, [livePreview]);

  const handleRoundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || submitting) return;
    setModalError(null);
    setError(null);
    setBanner(null);

    const scoresPayload: Array<{ gamePlayerId: string; announcedScore: number }> = [
      { gamePlayerId: announcerId, announcedScore: announcerScore },
    ];

    for (const p of otherActivePlayers) {
      const raw = otherScores[p.id];
      if (raw === undefined || raw.trim() === "") {
        setModalError(`Please enter ${p.name}'s score.`);
        return;
      }
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 0) {
        setModalError(`${p.name}'s score must be a non-negative whole number.`);
        return;
      }
      scoresPayload.push({ gamePlayerId: p.id, announcedScore: num });
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/${game.id}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: game.version,
          idempotencyKey,
          evaluatedGamePlayerId: announcerId,
          notes: roundNotes.trim(),
          scores: scoresPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to record round scores.");
        if (res.status === 409) {
          await fetchGame();
        }
        return;
      }

      setScoreModalOpen(false);
      setRoundNotes("");
      if (data.isGameCompleted) {
        router.push(`/games/${game.id}/results`);
        return;
      }

      let msg = data.resultSummary || `Round ${data.roundNumber} recorded.`;
      if (data.newlyEliminated?.length > 0) {
        const elimNames = data.newlyEliminated
          .map(
            (el: { name: string; eliminationOrder: number }) =>
              `${el.name} (${ordinalLabel(el.eliminationOrder)} Eliminated)`
          )
          .join(", ");
        msg += ` • Eliminated: ${elimNames}`;
      }
      setBanner(msg);
      await fetchGame();
    } catch {
      setModalError("Network error submitting round. Your scores were not duplicated—please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoLastRound = async () => {
    if (!game || undoing) return;
    setError(null);
    setBanner(null);
    setUndoing(true);
    try {
      const res = await fetch(`/api/games/${game.id}/rounds`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to undo last round.");
        return;
      }
      setBanner(`Round ${data.undoneRoundNumber} has been undone.`);
      await fetchGame();
    } catch {
      setError("Network error while undoing round.");
    } finally {
      setUndoing(false);
    }
  };

  const handleCancelGame = async () => {
    if (!game) return;
    await fetch(`/api/games/${game.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    setCancelOpen(false);
    await fetchGame();
  };

  const handleDeleteGame = async () => {
    if (!game || deletingGame) return;
    setDeletingGame(true);
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/games");
      }
    } finally {
      setDeletingGame(false);
    }
  };

  const openEditRoundModal = (round: RoundDTO) => {
    setEditingRound(round);
    setEditRoundAnnouncerId(round.evaluatedGamePlayerId || round.scores[0]?.gamePlayerId || "");
    const scoresMap: Record<string, string> = {};
    round.scores.forEach((s) => {
      scoresMap[s.gamePlayerId] = String(s.announcedScore);
    });
    setEditRoundScores(scoresMap);
    setEditRoundNotes(round.notes || "");
    setEditRoundError(null);
  };

  const handleSaveEditedRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game || !editingRound || savingRound) return;
    setEditRoundError(null);

    const scoresPayload: Array<{ gamePlayerId: string; announcedScore: number }> = [];
    for (const sc of editingRound.scores) {
      const raw = editRoundScores[sc.gamePlayerId];
      if (raw === undefined || raw.trim() === "") {
        setEditRoundError("Please fill in scores for all participating players.");
        return;
      }
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 0) {
        setEditRoundError("Scores must be non-negative whole numbers.");
        return;
      }
      if (sc.gamePlayerId === editRoundAnnouncerId && num > 5) {
        setEditRoundError("Announcer's score must be between 0 and 5.");
        return;
      }
      scoresPayload.push({ gamePlayerId: sc.gamePlayerId, announcedScore: num });
    }

    setSavingRound(true);
    try {
      const res = await fetch(`/api/games/${game.id}/rounds/${editingRound.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluatedGamePlayerId: editRoundAnnouncerId,
          notes: editRoundNotes.trim(),
          scores: scoresPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditRoundError(data.error || "Failed to update round.");
        return;
      }
      setEditingRound(null);
      setBanner(`Round ${editingRound.roundNumber} updated and game scores recalculated.`);
      await fetchGame();
    } catch {
      setEditRoundError("Network error while updating round.");
    } finally {
      setSavingRound(false);
    }
  };

  const handleConfirmDeleteRound = async () => {
    if (!game || !deletingRound || deletingRoundBusy) return;
    setDeletingRoundBusy(true);
    try {
      const res = await fetch(`/api/games/${game.id}/rounds/${deletingRound.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete round.");
      } else {
        setBanner(`Round ${deletingRound.roundNumber} deleted and scores recalculated.`);
        await fetchGame();
      }
      setDeletingRound(null);
    } finally {
      setDeletingRoundBusy(false);
    }
  };

  const handleReorderPlayers = async (fromId: string, toId: string) => {
    if (!game || reordering || fromId === toId) return;
    const current = [...game.players];
    const fromIdx = current.findIndex((p) => p.id === fromId);
    const toIdx = current.findIndex((p) => p.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    const reordered = current.map((p, i) => ({ ...p, seatOrder: i + 1 }));

    // Optimistic UI update
    setGame({ ...game, players: reordered });
    setReordering(true);
    try {
      const res = await fetch(`/api/games/${game.id}/players/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedGamePlayerIds: reordered.map((p) => p.id),
        }),
      });
      if (!res.ok) {
        await fetchGame();
      }
    } catch {
      await fetchGame();
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-12 w-72" />
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 lg:col-span-2 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!game) {
    return (
      <AppShell>
        <Card className="mx-auto mt-10 max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-bold">Game Not Found</h2>
            <p className="text-sm text-muted-foreground">
              {error || "Unable to find this game session."}
            </p>
            <Button asChild>
              <Link href="/games">Back to Game History</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const nextRoundNumber = game.currentRound + 1;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Session Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{game.title}</h1>
              <Badge
                variant={
                  game.status === "ACTIVE"
                    ? "default"
                    : game.status === "COMPLETED"
                      ? "secondary"
                      : "destructive"
                }
              >
                {game.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                Target: <strong className="text-foreground">{game.targetScore} pts</strong>
              </span>
              {game.betDescription && (
                <span>
                  Bet: <strong className="text-foreground">{game.betDescription}</strong>
                </span>
              )}
              {game.isBetFulfilled && (
                <span>
                  Final Price:{" "}
                  <strong className="font-mono text-emerald-700">
                    {formatCurrency(game.totalPrizePool, game.currency)}
                  </strong>
                </span>
              )}
              <span>
                Rounds: <strong className="text-foreground">{game.currentRound}</strong>
              </span>
              <span>
                Active:{" "}
                <strong className="text-foreground">
                  {activePlayers.length} / {game.players.length}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditGameOpen(true)}
            >
              <Edit3 className="mr-1.5 h-4 w-4" />
              Edit Game
            </Button>
            {game.rounds.length > 0 && game.status !== "CANCELLED" && (
              <Button
                variant="outline"
                size="sm"
                disabled={undoing}
                onClick={handleUndoLastRound}
              >
                {undoing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-1.5 h-4 w-4" />
                )}
                Undo R{game.currentRound}
              </Button>
            )}
            {game.status === "COMPLETED" && (
              <Button asChild size="sm">
                <Link href={`/games/${game.id}/results`}>
                  Results
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
            {game.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteGameOpen(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Feedback Banners */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {banner && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription>{banner}</AlertDescription>
          </Alert>
        )}

        {/* Completed Banner */}
        {game.status === "COMPLETED" && (
          <Card className="border-emerald-200 bg-emerald-50/70">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Game Completed
                  </p>
                  <h2 className="text-lg font-bold text-emerald-950">
                    Winner: {game.players.find((p) => p.isWinner)?.name || "Declared"}
                  </h2>
                </div>
              </div>
              <Button asChild>
                <Link href={`/games/${game.id}/results`}>
                  Open Prize Distribution
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Top Live Scoreboard — Large Player Names & Color-Coded Scores (Drag to Set Positions) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Live Scoreboard</span>
            <span>Drag cards or use arrows to set player positions</span>
          </div>
          <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {game.players.map((player, idx) => {
              const risk = getScoreRiskStyle(
                player.totalScore,
                game.targetScore,
                player.isEliminated,
                player.isWinner
              );
              const lowestActiveScore =
                activePlayers.length > 0
                  ? Math.min(...activePlayers.map((p) => p.totalScore))
                  : null;
              const isLeading =
                !player.isEliminated &&
                !risk.isNearElimination &&
                game.status === "ACTIVE" &&
                game.currentRound > 0 &&
                player.totalScore === lowestActiveScore;

              return (
                <Card
                  key={player.id}
                  draggable
                  onDragStart={() => setDragPlayerId(player.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragPlayerId && dragPlayerId !== player.id) {
                      handleReorderPlayers(dragPlayerId, player.id);
                    }
                    setDragPlayerId(null);
                  }}
                  onDragEnd={() => setDragPlayerId(null)}
                  className={`cursor-grab active:cursor-grabbing transition-all ${risk.cardHighlightClass} ${
                    dragPlayerId === player.id ? "opacity-50 scale-[0.98]" : ""
                  }`}
                >
                  <CardContent className="p-3 sm:p-5 space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <Link
                          href={`/players/${player.playerId}`}
                          className="text-sm sm:text-lg font-bold tracking-tight truncate hover:underline"
                        >
                          {player.name}
                        </Link>
                      </div>
                      {player.isWinner ? (
                        <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600 text-[10px] px-1.5">
                          Winner
                        </Badge>
                      ) : player.isEliminated ? (
                        <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5">
                          {ordinalLabel(player.eliminationOrder || 0)} Out
                        </Badge>
                      ) : risk.isNearElimination ? (
                        <Badge
                          variant="destructive"
                          className="shrink-0 text-[10px] px-1.5 animate-pulse"
                        >
                          Near Out
                        </Badge>
                      ) : isLeading ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5">
                          Lead
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl sm:text-4xl font-extrabold font-mono tracking-tight tabular-nums ${risk.scoreTextClass}`}
                        >
                          {player.totalScore}
                        </span>
                        <span className="text-[11px] sm:text-sm font-mono text-muted-foreground">
                          /{game.targetScore}
                        </span>
                      </div>
                      {!player.isEliminated && (
                        <span
                          className={`text-[11px] sm:text-xs font-medium tabular-nums ${
                            risk.isNearElimination ? "text-red-600 font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {risk.remaining} left
                        </span>
                      )}
                    </div>

                    <Progress
                      value={risk.pct}
                      indicatorClassName={risk.indicatorClass}
                      className="h-2"
                    />

                    <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground">
                      <span>Seat #{idx + 1}</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0 || reordering}
                          onClick={() => handleReorderPlayers(player.id, game.players[idx - 1].id)}
                          className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          aria-label={`Move ${player.name} earlier`}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === game.players.length - 1 || reordering}
                          onClick={() => handleReorderPlayers(player.id, game.players[idx + 1].id)}
                          className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                          aria-label={`Move ${player.name} later`}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left 2 Columns: Announce Trigger + Scorecard */}
          <div className="space-y-6 lg:col-span-2">
            {game.status === "ACTIVE" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                      R{nextRoundNumber}
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg">
                        Round {nextRoundNumber} — Announce Score
                      </CardTitle>
                      <CardDescription>
                        Tap a player&apos;s announced score (0–5) to enter all other players&apos; scores in the modal.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    <Megaphone className="mr-1 h-3 w-3" />
                    Announce 0–5
                  </Badge>
                </CardHeader>

                <CardContent className="pt-5 space-y-3">
                  {activePlayers.map((player) => {
                    const risk = getScoreRiskStyle(
                      player.totalScore,
                      game.targetScore,
                      player.isEliminated,
                      player.isWinner
                    );
                    return (
                      <div
                        key={player.id}
                        className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${risk.cardHighlightClass}`}
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                            <span className="text-sm font-semibold truncate">{player.name}</span>
                            <span
                              className={`font-mono text-xs tabular-nums ${
                                risk.isNearElimination
                                  ? "text-red-600 font-bold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {player.totalScore} / {game.targetScore} pts ({risk.remaining} left)
                            </span>
                          </div>
                          <Progress
                            value={risk.pct}
                            indicatorClassName={risk.indicatorClass}
                            className="h-1.5 max-w-xs"
                          />
                        </div>

                        <div className="grid grid-cols-6 gap-1.5 w-full sm:flex sm:w-auto sm:items-center shrink-0">
                          <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">
                            Announce:
                          </span>
                          {ANNOUNCE_OPTIONS.map((scoreVal) => (
                            <Button
                              key={scoreVal}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-10 sm:h-9 sm:w-9 w-full p-0 font-mono font-semibold text-base sm:text-sm hover:bg-primary hover:text-primary-foreground active:scale-95 transition-transform"
                              onClick={() => handleAnnounceClick(player.id, scoreVal)}
                            >
                              {scoreVal}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Round-by-Round Scorecard */}
            <Card>
              <CardHeader>
                <CardTitle>Round-by-Round Scorecard</CardTitle>
                <CardDescription>
                  Announced scores, all players&apos; hand scores, winners, and assigned points.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {game.rounds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    <Hash className="h-7 w-7 opacity-40 mb-2" />
                    No rounds recorded yet. Tap a player&apos;s announced score (0–5) above to begin.
                  </div>
                ) : (
                  <>
                    {/* Mobile Stacked Round Cards */}
                    <div className="space-y-3 sm:hidden">
                      {game.rounds.map((round) => {
                        const scoreMap = new Map(round.scores.map((s) => [s.gamePlayerId, s]));
                        return (
                          <div key={round.id} className="rounded-lg border p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-sm font-bold">
                                  Round {round.roundNumber}
                                </span>
                                <Badge
                                  variant={
                                    round.outcome === "ANNOUNCER_WON" ? "secondary" : "destructive"
                                  }
                                  className="text-[10px]"
                                >
                                  {round.outcome === "ANNOUNCER_WON" ? "Win" : "Penalty"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditRoundModal(round)}
                                  aria-label={`Edit Round ${round.roundNumber}`}
                                >
                                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeletingRound(round)}
                                  aria-label={`Delete Round ${round.roundNumber}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
                                  <div
                                    key={p.id}
                                    className="rounded-md border bg-muted/20 px-2.5 py-2 text-xs"
                                  >
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
                                        <span className="font-mono text-muted-foreground/50">
                                          OUT
                                        </span>
                                      )}
                                    </div>
                                    {sc && (
                                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                                        <span>
                                          Score:{sc.announcedScore}
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

                    {/* Desktop Scorecard Table */}
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
                          <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {game.rounds.map((round) => {
                          const scoreMap = new Map(round.scores.map((s) => [s.gamePlayerId, s]));
                          return (
                            <TableRow key={round.id}>
                              <TableCell className="align-top">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-semibold">
                                    R{round.roundNumber}
                                  </span>
                                  <Badge
                                    variant={
                                      round.outcome === "ANNOUNCER_WON" ? "secondary" : "destructive"
                                    }
                                    className="text-[10px]"
                                  >
                                    {round.outcome === "ANNOUNCER_WON" ? "Win" : "Penalty"}
                                  </Badge>
                                </div>
                                {round.resultSummary && (
                                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
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
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`font-semibold ${
                                          sc.points > 0 ? "text-destructive" : "text-emerald-600"
                                        }`}
                                      >
                                        +{sc.points}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        ({sc.cumulativeScore})
                                      </span>
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <span>Score:{sc.announcedScore}</span>
                                      {sc.isEvaluated && (
                                        <span className="font-semibold text-foreground">[Ann]</span>
                                      )}
                                      {sc.isRoundWinner && (
                                        <span className="font-semibold text-emerald-600">[W]</span>
                                      )}
                                      {sc.triggeredElimination && (
                                        <span className="font-semibold text-destructive">[OUT]</span>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="align-top text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEditRoundModal(round)}
                                    title={`Edit Round ${round.roundNumber}`}
                                  >
                                    <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeletingRound(round)}
                                    title={`Delete Round ${round.roundNumber}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell>Cumulative Total</TableCell>
                          {game.players.map((p) => (
                            <TableCell
                              key={p.id}
                              className={`font-mono tabular-nums ${
                                p.isWinner
                                  ? "text-emerald-700"
                                  : p.isEliminated
                                    ? "text-destructive"
                                    : ""
                              }`}
                            >
                              {p.totalScore}
                            </TableCell>
                          ))}
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Standings + Elimination Order */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Elimination Risk Order</CardTitle>
                <CardDescription>Sorted by who is closest to elimination first</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...activePlayers]
                  .sort((a, b) => b.totalScore - a.totalScore)
                  .map((p) => {
                    const risk = getScoreRiskStyle(
                      p.totalScore,
                      game.targetScore,
                      p.isEliminated,
                      p.isWinner
                    );
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border p-3 space-y-2 ${risk.cardHighlightClass}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Link
                              href={`/players/${p.playerId}`}
                              className="text-sm font-medium hover:underline truncate"
                            >
                              {p.name}
                            </Link>
                            {risk.isNearElimination && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 animate-pulse"
                              >
                                Near Out
                              </Badge>
                            )}
                          </div>
                          <span
                            className={`font-mono text-sm font-bold tabular-nums ${risk.scoreTextClass}`}
                          >
                            {p.totalScore} pts
                          </span>
                        </div>
                        <Progress
                          value={risk.pct}
                          indicatorClassName={risk.indicatorClass}
                          className="h-2"
                        />
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{risk.pct}% of target</span>
                          <span className={risk.isNearElimination ? "text-red-600 font-semibold" : ""}>
                            {risk.remaining} pts left
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>Elimination Order</CardTitle>
                  <CardDescription>Recorded as players cross target</CardDescription>
                </div>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                {eliminatedPlayers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No players eliminated yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {eliminatedPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Badge variant="destructive" className="shrink-0">
                            {ordinalLabel(p.eliminationOrder || 0)}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Out in Round {p.eliminatedInRound}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-semibold text-destructive tabular-nums">
                          {p.totalScore} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Round Score Entry Modal (Opened on 0-5 Announce Click) */}
      <Dialog open={scoreModalOpen} onOpenChange={setScoreModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleRoundSubmit}>
            <DialogHeader>
              <DialogTitle>
                Round {nextRoundNumber} — Enter Other Players&apos; Scores
              </DialogTitle>
              <DialogDescription>
                <strong>{announcerPlayer?.name}</strong> announced{" "}
                <strong className="font-mono text-foreground">{announcerScore}</strong>. Enter each
                other player&apos;s actual hand score (can be any number &ge; 0).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {modalError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{modalError}</AlertDescription>
                </Alert>
              )}

              {/* Announcer Summary + Quick Adjust */}
              <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Announcer</Badge>
                    <span className="text-sm font-semibold">{announcerPlayer?.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Current: {announcerPlayer?.totalScore ?? 0} pts
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Announced Score (0–5):</span>
                  <div className="flex items-center gap-1">
                    {ANNOUNCE_OPTIONS.map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={announcerScore === v ? "default" : "outline"}
                        className="h-7 w-7 p-0 font-mono text-xs"
                        onClick={() => setAnnouncerScore(v)}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Other Active Players' Scores (Unlimited integer >= 0) */}
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Other Active Players&apos; Scores
                </Label>
                {otherActivePlayers.map((player, idx) => {
                  const previewRec = previewByPlayerId.get(player.id);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label htmlFor={`score-${player.id}`} className="text-sm font-medium">
                            {player.name}
                          </Label>
                          {previewRec?.isRoundWinner && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                              <Award className="mr-1 h-3 w-3" />
                              Round Winner (0 pts)
                            </Badge>
                          )}
                          {previewRec?.triggeredElimination && (
                            <Badge variant="destructive" className="text-[10px]">
                              <Skull className="mr-1 h-3 w-3" />
                              Eliminated
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Current: {player.totalScore} pts
                          {previewRec ? ` → ${previewRec.cumulativeScore} pts` : ""}
                        </p>
                      </div>
                      <Input
                        ref={(el) => {
                          scoreInputRefs.current[idx] = el;
                        }}
                        id={`score-${player.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Score"
                        autoFocus={idx === 0}
                        enterKeyHint={idx < otherActivePlayers.length - 1 ? "next" : "done"}
                        value={otherScores[player.id] ?? ""}
                        onChange={(e) =>
                          setOtherScores((prev) => ({ ...prev, [player.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && idx < otherActivePlayers.length - 1) {
                            e.preventDefault();
                            const nextInput = scoreInputRefs.current[idx + 1];
                            nextInput?.focus();
                            nextInput?.select();
                          }
                        }}
                        required
                        className="w-28 font-mono font-semibold text-right"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Live Outcome Preview */}
              {livePreview && (
                <Alert
                  className={
                    livePreview.outcome === "ANNOUNCER_WON"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }
                >
                  {livePreview.outcome === "ANNOUNCER_WON" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <AlertTitle className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {livePreview.outcome === "ANNOUNCER_WON"
                        ? "Announcer Wins Round"
                        : "Penalty to Announcer"}
                    </span>
                    <span className="font-mono text-xs">
                      Sum: {livePreview.totalAnnounced} pts
                    </span>
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {livePreview.resultSummary}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="roundNotes" className="text-xs text-muted-foreground">
                  Round Note (Optional)
                </Label>
                <Input
                  id="roundNotes"
                  placeholder="Optional note..."
                  value={roundNotes}
                  onChange={(e) => setRoundNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScoreModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !livePreview}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit Round {nextRoundNumber}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Game Session?</DialogTitle>
            <DialogDescription>
              Cancelling <strong>{game.title}</strong> will stop score entry and mark this session as
              cancelled. No final prize distribution will be generated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Playing
            </Button>
            <Button variant="destructive" onClick={handleCancelGame}>
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Game Settings Dialog */}
      <EditGameDialog
        game={game}
        open={editGameOpen}
        onOpenChange={setEditGameOpen}
        onSaved={fetchGame}
      />

      {/* Delete Game Confirmation Dialog */}
      <Dialog open={deleteGameOpen} onOpenChange={setDeleteGameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Game Session?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{game.title}</strong> and all of its rounds and
              score records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGameOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletingGame} onClick={handleDeleteGame}>
              {deletingGame && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Round Dialog */}
      <Dialog
        open={Boolean(editingRound)}
        onOpenChange={(open) => {
          if (!open) setEditingRound(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          {editingRound && (
            <form onSubmit={handleSaveEditedRound}>
              <DialogHeader>
                <DialogTitle>Edit Round {editingRound.roundNumber}</DialogTitle>
                <DialogDescription>
                  Update the announcer or any player&apos;s score. All subsequent rounds, totals,
                  eliminations, and payouts will automatically recalculate.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {editRoundError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{editRoundError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Announcer (0–5 pts)
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {editingRound.scores.map((sc) => {
                      const pl = game.players.find((p) => p.id === sc.gamePlayerId);
                      const isSel = editRoundAnnouncerId === sc.gamePlayerId;
                      return (
                        <Button
                          key={sc.gamePlayerId}
                          type="button"
                          size="sm"
                          variant={isSel ? "default" : "outline"}
                          onClick={() => setEditRoundAnnouncerId(sc.gamePlayerId)}
                        >
                          {pl?.name || "Player"}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Player Scores
                  </Label>
                  {editingRound.scores.map((sc, idx) => {
                    const pl = game.players.find((p) => p.id === sc.gamePlayerId);
                    const isAnn = editRoundAnnouncerId === sc.gamePlayerId;
                    return (
                      <div
                        key={sc.gamePlayerId}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {pl?.name || "Player"}
                          </span>
                          {isAnn && <Badge variant="default">Announcer (0–5)</Badge>}
                        </div>
                        <Input
                          ref={(el) => {
                            editScoreInputRefs.current[idx] = el;
                          }}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={isAnn ? 5 : 100000}
                          autoFocus={idx === 0}
                          enterKeyHint={idx < editingRound.scores.length - 1 ? "next" : "done"}
                          value={editRoundScores[sc.gamePlayerId] ?? ""}
                          onChange={(e) =>
                            setEditRoundScores((prev) => ({
                              ...prev,
                              [sc.gamePlayerId]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && idx < editingRound.scores.length - 1) {
                              e.preventDefault();
                              const nextInput = editScoreInputRefs.current[idx + 1];
                              nextInput?.focus();
                              nextInput?.select();
                            }
                          }}
                          required
                          className="w-28 font-mono font-semibold text-right"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-round-notes">Round Note (Optional)</Label>
                  <Input
                    id="edit-round-notes"
                    value={editRoundNotes}
                    onChange={(e) => setEditRoundNotes(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingRound(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingRound}>
                  {savingRound && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save &amp; Recalculate
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Round Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingRound)}
        onOpenChange={(open) => {
          if (!open) setDeletingRound(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Round {deletingRound?.roundNumber}?</DialogTitle>
            <DialogDescription>
              Deleting this round will renumber remaining rounds and automatically recalculate all
              player totals, eliminations, and payouts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRound(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingRoundBusy}
              onClick={handleConfirmDeleteRound}
            >
              {deletingRoundBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
