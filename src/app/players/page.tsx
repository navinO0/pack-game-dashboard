"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Trophy,
  Users,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
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

interface PlayerRecord {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  stats: {
    gamesPlayed: number;
    completedGames: number;
    wins: number;
    winRate: number;
    totalWinnings: number;
    totalContributed: number;
    netProfit: number;
    avgScore: number;
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerRecord | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState<PlayerRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/players${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load players");
      setPlayers(data.players || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(loadPlayers, 200);
    return () => clearTimeout(timer);
  }, [loadPlayers]);

  const openCreateModal = () => {
    setEditingPlayer(null);
    setFormName("");
    setFormNickname("");
    setFormPhone("");
    setFormNotes("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditModal = (player: PlayerRecord) => {
    setEditingPlayer(player);
    setFormName(player.name);
    setFormNickname(player.nickname || "");
    setFormPhone(player.phone || "");
    setFormNotes(player.notes || "");
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const url = editingPlayer ? `/api/players/${editingPlayer.id}` : "/api/players";
      const method = editingPlayer ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
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
        setFormError(data.error || "Failed to save player.");
        return;
      }
      setDialogOpen(false);
      await loadPlayers();
    } catch {
      setFormError("Network error while saving player.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPlayer || deletingBusy) return;
    setDeletingBusy(true);
    try {
      await fetch(`/api/players/${deletingPlayer.id}`, { method: "DELETE" });
      setDeletingPlayer(null);
      await loadPlayers();
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Player Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage your roster, track career win rates, and reuse players in new games.
            </p>
          </div>
          <Button size="sm" onClick={openCreateModal}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Player
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players by name or nickname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : players.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold">No players found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Add regular Pack Game players so they appear as instant suggestions.
              </p>
              <Button size="sm" onClick={openCreateModal}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add First Player
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Card key={player.id} className="transition-colors hover:border-foreground/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/players/${player.id}`}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <Avatar className="h-10 w-10 border">
                        <AvatarFallback className="text-xs font-semibold">
                          {initials(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold group-hover:underline">
                          {player.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {player.nickname
                            ? `"${player.nickname}"`
                            : player.phone || "Registered Player"}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditModal(player)}
                        aria-label="Edit player"
                      >
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingPlayer(player)}
                        aria-label="Remove player"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Games</p>
                      <p className="font-bold tabular-nums">{player.stats.gamesPlayed}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Wins</p>
                      <p className="flex items-center justify-center gap-1 font-bold text-emerald-600 tabular-nums">
                        <Trophy className="h-3 w-3" />
                        {player.stats.wins}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Win Rate</p>
                      <p className="font-bold tabular-nums">{player.stats.winRate}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Net:</span>
                      <Badge
                        variant={player.stats.netProfit >= 0 ? "secondary" : "destructive"}
                        className={
                          player.stats.netProfit >= 0
                            ? "font-mono bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            : "font-mono"
                        }
                      >
                        {player.stats.netProfit >= 0 ? "+" : ""}
                        {formatCurrency(player.stats.netProfit)}
                      </Badge>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/players/${player.id}`}>
                        Profile
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingPlayer ? `Edit Player: ${editingPlayer.name}` : "Register New Player"}
              </DialogTitle>
              <DialogDescription>
                Players saved here appear as instant suggestions when creating a new game.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="playerName">Player Name</Label>
                <Input
                  id="playerName"
                  placeholder="e.g. Vikram Singh"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playerNickname">Nickname (Optional)</Label>
                <Input
                  id="playerNickname"
                  placeholder="e.g. Ace"
                  value={formNickname}
                  onChange={(e) => setFormNickname(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playerPhone">Phone (Optional)</Label>
                <Input
                  id="playerPhone"
                  placeholder="e.g. +91 98765 43210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playerNotes">Notes (Optional)</Label>
                <Textarea
                  id="playerNotes"
                  rows={2}
                  placeholder="Preferred seat, payment handle, etc."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingPlayer ? "Save Changes" : "Add Player"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Player Dialog */}
      <Dialog
        open={Boolean(deletingPlayer)}
        onOpenChange={(open) => {
          if (!open) setDeletingPlayer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deletingPlayer && deletingPlayer.stats.gamesPlayed > 0
                ? "Archive Player?"
                : "Delete Player?"}
            </DialogTitle>
            <DialogDescription>
              {deletingPlayer && deletingPlayer.stats.gamesPlayed > 0
                ? `Archive ${deletingPlayer.name}? They will be hidden from active lists while preserving their ${deletingPlayer.stats.gamesPlayed} historical game records.`
                : `Permanently delete ${deletingPlayer?.name}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPlayer(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletingBusy} onClick={handleConfirmDelete}>
              {deletingBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deletingPlayer && deletingPlayer.stats.gamesPlayed > 0 ? "Archive" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
