"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  TrendingUp,
  Skull,
  AlertCircle,
  ExternalLink,
  Edit3,
  Trash2,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { ordinalLabel } from "@/lib/game-engine";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface PlayerProfileDTO {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  stats: {
    gamesPlayed: number;
    completedGames: number;
    activeGames: number;
    wins: number;
    winRate: number;
    totalWinnings: number;
    totalContributed: number;
    netProfit: number;
    avgScore: number;
    firstEliminations: number;
  };
  history: Array<{
    gameId: string;
    gameTitle: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    targetScore: number;
    betDescription: string | null;
    totalPrizePool: number;
    isBetFulfilled: boolean;
    currency: string;
    distributionMode: "ELIMINATION_CONTRIBUTION" | "PRIZE_SPLIT";
    playerCount: number;
    roundCount: number;
    totalScore: number;
    isEliminated: boolean;
    eliminationOrder: number | null;
    eliminatedInRound: number | null;
    isWinner: boolean;
    prizePercentage: number;
    payoutAmount: number;
    startedAt: string;
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

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const playerId = String(params.id);

  const [player, setPlayer] = useState<PlayerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPlayer = useCallback(async () => {
    try {
      const res = await fetch(`/api/players/${playerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Player not found");
      setPlayer(data.player);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadPlayer();
  }, [loadPlayer]);

  const openEditDialog = () => {
    if (!player) return;
    setFormName(player.name);
    setFormNickname(player.nickname || "");
    setFormPhone(player.phone || "");
    setFormNotes(player.notes || "");
    setFormError(null);
    setEditOpen(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || saving) return;
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          nickname: formNickname.trim(),
          phone: formPhone.trim(),
          notes: formNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to update player.");
        return;
      }
      setEditOpen(false);
      await loadPlayer();
    } catch {
      setFormError("Network error while updating player.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (!player || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/players/${player.id}`, { method: "DELETE" });
      if (res.ok) router.push("/players");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (!player || error) {
    return (
      <AppShell>
        <Card className="mx-auto mt-10 max-w-lg">
          <CardContent className="flex flex-col items-center p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-bold">Player Not Found</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild>
              <Link href="/players">Back to Players</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href="/players">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Players
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Edit3 className="mr-1.5 h-4 w-4" />
              Edit Player
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {player.stats.gamesPlayed > 0 ? "Archive" : "Delete"}
            </Button>
          </div>
        </div>

        {/* Header Card */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border text-lg">
                <AvatarFallback className="font-bold">{initials(player.name)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
                  {player.nickname && <Badge variant="secondary">&ldquo;{player.nickname}&rdquo;</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Member since {formatShortDate(player.createdAt)}
                  {player.phone ? ` • ${player.phone}` : ""}
                </p>
                {player.notes && (
                  <p className="text-xs text-muted-foreground">{player.notes}</p>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Net Career Balance
              </p>
              <p
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  player.stats.netProfit >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {player.stats.netProfit >= 0 ? "+" : ""}
                {formatCurrency(player.stats.netProfit)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Career Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Games Played
              </CardTitle>
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{player.stats.gamesPlayed}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {player.stats.completedGames} completed, {player.stats.activeGames} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Wins &amp; Win Rate
              </CardTitle>
              <Trophy className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                {player.stats.wins}{" "}
                <span className="text-base font-medium text-muted-foreground">
                  ({player.stats.winRate}%)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Won {formatCurrency(player.stats.totalWinnings)} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Final Score
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{player.stats.avgScore} pts</div>
              <p className="text-xs text-muted-foreground mt-1">Lower is better in Pack Game</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                1st Eliminations
              </CardTitle>
              <Skull className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive tabular-nums">
                {player.stats.firstEliminations}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Shares paid: {formatCurrency(player.stats.totalContributed)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Game History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Game History</CardTitle>
            <CardDescription>
              Every Pack Game session {player.name} has participated in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {player.history.length === 0 ? (
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                {player.name} has not played in any games yet.
              </div>
            ) : (
              <>
              <div className="space-y-3 sm:hidden">
                {player.history.map((item) => (
                  <div key={item.gameId} className="rounded-lg border p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{item.gameTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(item.startedAt)} &bull; {item.playerCount}P &bull;{" "}
                          {item.roundCount}R
                        </p>
                      </div>
                      {item.isWinner ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] shrink-0">
                          Winner
                        </Badge>
                      ) : item.isEliminated ? (
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          {ordinalLabel(item.eliminationOrder || 0)} Out
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t text-xs">
                      <span className="font-mono font-medium">
                        {item.totalScore} pts{" "}
                        {item.status === "COMPLETED" && (
                          <span className="ml-1.5 text-muted-foreground">
                            &bull;{" "}
                            {!item.isBetFulfilled
                              ? item.isWinner
                                ? "0%"
                                : `${item.prizePercentage}%`
                              : item.isWinner
                                ? `${formatCurrency(0, item.currency)} (Free)`
                                : formatCurrency(item.payoutAmount, item.currency)}
                          </span>
                        )}
                      </span>
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                        <Link
                          href={
                            item.status === "COMPLETED"
                              ? `/games/${item.gameId}/results`
                              : `/games/${item.gameId}`
                          }
                        >
                          View
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Game Session</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Settlement</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {player.history.map((item) => (
                      <TableRow key={item.gameId}>
                        <TableCell>
                          <p className="font-medium">{item.gameTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.playerCount} players &bull; {item.roundCount} rounds &bull;
                            Target {item.targetScore}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatShortDate(item.startedAt)}
                        </TableCell>
                        <TableCell>
                          {item.isWinner ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">Winner</Badge>
                          ) : item.isEliminated ? (
                            <Badge variant="destructive">
                              {ordinalLabel(item.eliminationOrder || 0)} Eliminated (R
                              {item.eliminatedInRound})
                            </Badge>
                          ) : (
                            <Badge variant="outline">{item.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium tabular-nums">
                          {item.totalScore} pts
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                          {item.status !== "COMPLETED" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : !item.isBetFulfilled ? (
                            item.isWinner ? (
                              <span className="text-emerald-600">Winner</span>
                            ) : (
                              <span className="text-amber-700">{item.prizePercentage}% (Pending)</span>
                            )
                          ) : item.isWinner ? (
                            <span className="text-emerald-600">
                              {formatCurrency(0, item.currency)} (Winner)
                            </span>
                          ) : item.distributionMode === "ELIMINATION_CONTRIBUTION" ? (
                            <span className="text-destructive">
                              Paid {formatCurrency(item.payoutAmount, item.currency)} (
                              {item.prizePercentage}%)
                            </span>
                          ) : (
                            <span>
                              +{formatCurrency(item.payoutAmount, item.currency)} (
                              {item.prizePercentage}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              href={
                                item.status === "COMPLETED"
                                  ? `/games/${item.gameId}/results`
                                  : `/games/${item.gameId}`
                              }
                            >
                              View
                              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
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
      </div>

      {/* Edit Player Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleSavePlayer}>
            <DialogHeader>
              <DialogTitle>Edit Player: {player.name}</DialogTitle>
              <DialogDescription>Update player contact details and profile info.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="prof-name">Player Name</Label>
                <Input
                  id="prof-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof-nick">Nickname</Label>
                <Input
                  id="prof-nick"
                  value={formNickname}
                  onChange={(e) => setFormNickname(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof-phone">Phone</Label>
                <Input
                  id="prof-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof-notes">Notes</Label>
                <Textarea
                  id="prof-notes"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {player.stats.gamesPlayed > 0 ? "Archive Player?" : "Delete Player?"}
            </DialogTitle>
            <DialogDescription>
              {player.stats.gamesPlayed > 0
                ? `Archive ${player.name}? Their ${player.stats.gamesPlayed} historical game records will be preserved.`
                : `Permanently delete ${player.name}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDeletePlayer}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {player.stats.gamesPlayed > 0 ? "Archive" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
