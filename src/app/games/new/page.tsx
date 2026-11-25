"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserPlus,
  Trash2,
  Trophy,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Play,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  generateDefaultDistribution,
  validatePrizeDistribution,
  type DistributionMode,
  type DistributionSlot,
} from "@/lib/game-engine";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RegisteredPlayer {
  id: string;
  name: string;
  nickname: string | null;
  stats: {
    gamesPlayed: number;
    wins: number;
  };
}

interface SelectedPlayer {
  id?: string;
  name: string;
}

function CreateGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rematchId = searchParams.get("rematch");

  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([]);
  const [title, setTitle] = useState(() => {
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `Pack Game — ${today}`;
  });
  const [targetScore, setTargetScore] = useState("25");
  const [betDescription, setBetDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [notes, setNotes] = useState("");
  const [distributionMode, setDistributionMode] = useState<DistributionMode>(
    "ELIMINATION_CONTRIBUTION"
  );

  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [playerInput, setPlayerInput] = useState("");
  const [distribution, setDistribution] = useState<DistributionSlot[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/players")
      .then((res) => (res.ok ? res.json() : { players: [] }))
      .then((data) => setRegisteredPlayers(data.players || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!rematchId) return;
    fetch(`/api/games/${rematchId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.game) return;
        const g = data.game;
        setTitle(`${g.title} (Rematch)`);
        setTargetScore(String(g.targetScore));
        setBetDescription(g.betDescription || "");
        setCurrency(g.currency || "INR");
        setDistributionMode(g.distributionMode);
        setSelectedPlayers(
          g.players.map((p: { playerId: string; name: string }) => ({
            id: p.playerId,
            name: p.name,
          }))
        );
        if (Array.isArray(g.prizeDistribution)) {
          setDistribution(g.prizeDistribution);
        }
      })
      .catch(() => {});
  }, [rematchId]);

  useEffect(() => {
    if (selectedPlayers.length >= 2) {
      const expectedSlots =
        distributionMode === "ELIMINATION_CONTRIBUTION"
          ? selectedPlayers.length - 1
          : selectedPlayers.length;
      if (distribution.length !== expectedSlots) {
        setDistribution(generateDefaultDistribution(selectedPlayers.length, distributionMode));
      }
    } else {
      setDistribution([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayers.length, distributionMode]);

  const suggestions = useMemo(() => {
    const selectedNorm = new Set(selectedPlayers.map((p) => p.name.trim().toLowerCase()));
    const q = playerInput.trim().toLowerCase();
    return registeredPlayers.filter((rp) => {
      if (selectedNorm.has(rp.name.trim().toLowerCase())) return false;
      if (!q) return true;
      return (
        rp.name.toLowerCase().includes(q) ||
        (rp.nickname && rp.nickname.toLowerCase().includes(q))
      );
    });
  }, [registeredPlayers, selectedPlayers, playerInput]);

  const addPlayerByName = (nameToAdd: string, id?: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (selectedPlayers.some((p) => p.name.trim().toLowerCase() === norm)) {
      setError(`"${trimmed}" is already added to this game.`);
      return;
    }
    if (selectedPlayers.length >= 20) {
      setError("Maximum 20 players per game.");
      return;
    }
    setError(null);
    const matched =
      id !== undefined
        ? { id, name: trimmed }
        : (() => {
            const found = registeredPlayers.find((rp) => rp.name.trim().toLowerCase() === norm);
            return found ? { id: found.id, name: found.name } : { name: trimmed };
          })();
    setSelectedPlayers((prev) => [...prev, matched]);
    setPlayerInput("");
  };

  const removePlayer = (index: number) => {
    setSelectedPlayers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateSlotPercentage = (index: number, rawValue: string) => {
    const val = rawValue === "" ? 0 : parseFloat(rawValue);
    setDistribution((prev) =>
      prev.map((slot, idx) =>
        idx === index ? { ...slot, percentage: Number.isFinite(val) ? val : 0 } : slot
      )
    );
  };

  const resetDistribution = () => {
    setDistribution(generateDefaultDistribution(selectedPlayers.length, distributionMode));
  };

  const distValidation = useMemo(() => {
    if (selectedPlayers.length < 2) {
      return { valid: false, totalPercentage: 0, error: "Add at least 2 players first." };
    }
    return validatePrizeDistribution(distribution, selectedPlayers.length, distributionMode);
  }, [distribution, selectedPlayers.length, distributionMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedPlayers.length < 2) {
      setError("Please add at least 2 players to start a game.");
      return;
    }
    if (!distValidation.valid) {
      setError(distValidation.error || "Prize distribution must equal 100%.");
      return;
    }

    const parsedTarget = parseInt(targetScore, 10);
    if (!Number.isInteger(parsedTarget) || parsedTarget < 10) {
      setError("Target score must be a whole number of at least 10.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          targetScore: parsedTarget,
          betDescription: betDescription.trim(),
          totalPrizePool: 0,
          currency,
          distributionMode,
          prizeDistribution: distribution,
          notes: notes.trim(),
          players: selectedPlayers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create game.");
        return;
      }

      router.push(`/games/${data.game.id}`);
    } catch {
      setError("Network error while creating game.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Create New Pack Game
          </h1>
          <p className="text-sm text-muted-foreground">
            Set what the bet is for, choose your players, and configure elimination percentages.
            You can finalize the actual bill price later from Game History.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Game Settings */}
          <Card>
            <CardHeader>
              <CardTitle>1. Game Settings</CardTitle>
              <CardDescription>
                Define session title, target score, and what the bet is for.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Game Session Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Saturday Night Pack"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetScore">Target Score</Label>
                <Input
                  id="targetScore"
                  type="number"
                  min={10}
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Eliminated upon reaching this score
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency (for later settlement)</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="betDescription">What is the Bet For?</Label>
                <Input
                  id="betDescription"
                  placeholder="e.g. Dinner Party, Biryani Treat, Movie Tickets..."
                  value={betDescription}
                  onChange={(e) => setBetDescription(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Percentages are shown at game end; actual price can be finalized later in History.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Session Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="House rules, table location, or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 2. Participants */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>2. Participants ({selectedPlayers.length})</CardTitle>
                <CardDescription>
                  Add new players by name or click a suggested player below.
                </CardDescription>
              </div>
              <Badge variant={selectedPlayers.length >= 2 ? "default" : "secondary"}>
                {selectedPlayers.length >= 2 ? "Ready" : "Need at least 2 players"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex gap-2">
                <Input
                  placeholder="Type player name to search or add..."
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPlayerByName(playerInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addPlayerByName(playerInput)}
                  disabled={!playerInput.trim()}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggested Players (click to add)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 12).map((rp) => (
                      <Button
                        key={rp.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addPlayerByName(rp.name, rp.id)}
                        className="h-8"
                      >
                        <span>{rp.name}</span>
                        {rp.nickname && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({rp.nickname})
                          </span>
                        )}
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          {rp.stats.gamesPlayed}G
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPlayers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Selected Table Order
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {selectedPlayers.map((p, idx) => (
                      <div
                        key={`${p.name}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                            {idx + 1}
                          </span>
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          {!p.id && (
                            <Badge variant="outline" className="text-[10px]">
                              New
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removePlayer(idx)}
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Percentage Share Rules */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle>3. Bet Share Percentages</CardTitle>
                <CardDescription>
                  Percentages by elimination order must total exactly 100%. Final amounts are
                  calculated when the bet is fulfilled.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Select
                  value={distributionMode}
                  onValueChange={(val) => {
                    const nextMode = val as DistributionMode;
                    setDistributionMode(nextMode);
                    if (selectedPlayers.length >= 2) {
                      setDistribution(generateDefaultDistribution(selectedPlayers.length, nextMode));
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ELIMINATION_CONTRIBUTION">
                      Pack Standard (Eliminated Share → Winner)
                    </SelectItem>
                    <SelectItem value="PRIZE_SPLIT">
                      Custom Share Split (All Positions)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetDistribution}
                  disabled={selectedPlayers.length < 2}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPlayers.length < 2 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Add at least 2 players above to configure elimination share percentages.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Total Percentage Allocation</span>
                      <span
                        className={`flex items-center gap-1 font-semibold tabular-nums ${
                          distValidation.valid ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {distValidation.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {distValidation.totalPercentage}% / 100%
                      </span>
                    </div>
                    <Progress value={Math.min(100, distValidation.totalPercentage)} className="h-2" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {distribution.map((slot, idx) => (
                      <div
                        key={`${slot.order}-${idx}`}
                        className="rounded-lg border bg-muted/20 p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{slot.label}</span>
                          <Badge variant="secondary" className="font-mono">
                            {slot.percentage}%
                          </Badge>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            value={String(slot.percentage)}
                            onChange={(e) => updateSlotPercentage(idx, e.target.value)}
                            className="pr-8 font-mono"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    ))}

                    {distributionMode === "ELIMINATION_CONTRIBUTION" && (
                      <div className="flex flex-col justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                          <Trophy className="h-4 w-4 text-emerald-600" />
                          Last Remaining (Winner)
                        </div>
                        <div className="mt-2">
                          <p className="text-base font-bold text-emerald-700">Winner</p>
                          <p className="text-xs text-emerald-700/80">
                            {betDescription.trim()
                              ? `Wins: ${betDescription.trim()}`
                              : "Wins the bet (0% to pay)"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || selectedPlayers.length < 2 || !distValidation.valid}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Game Session
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default function CreateGamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CreateGameForm />
    </Suspense>
  );
}
