"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EditableGameData {
  id: string;
  title: string;
  targetScore: number;
  betDescription?: string | null;
  totalPrizePool: number;
  isBetFulfilled?: boolean;
  currency: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
}

interface EditGameDialogProps {
  game: EditableGameData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}

export function EditGameDialog({
  game,
  open,
  onOpenChange,
  onSaved,
}: EditGameDialogProps) {
  const [title, setTitle] = useState("");
  const [targetScore, setTargetScore] = useState("25");
  const [betDescription, setBetDescription] = useState("");
  const [totalPrizePool, setTotalPrizePool] = useState("0");
  const [isBetFulfilled, setIsBetFulfilled] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [notes, setNotes] = useState("");
  const [reopenIfCancelled, setReopenIfCancelled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (game && open) {
      setTitle(game.title);
      setTargetScore(String(game.targetScore));
      setBetDescription(game.betDescription || "");
      setTotalPrizePool(String(game.totalPrizePool || 0));
      setIsBetFulfilled(Boolean(game.isBetFulfilled));
      setCurrency(game.currency || "INR");
      setNotes(game.notes || "");
      setReopenIfCancelled(false);
      setError(null);
    }
  }, [game, open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game) return;
    setError(null);

    const parsedTarget = parseInt(targetScore, 10);
    const parsedPool = parseFloat(totalPrizePool);

    if (!Number.isInteger(parsedTarget) || parsedTarget < 10) {
      setError("Target score must be a whole number of at least 10.");
      return;
    }
    if (!Number.isFinite(parsedPool) || parsedPool < 0) {
      setError("Total prize pool must be 0 or greater.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          targetScore: parsedTarget,
          betDescription: betDescription.trim(),
          totalPrizePool: isBetFulfilled ? parsedPool : 0,
          isBetFulfilled,
          currency,
          notes: notes.trim(),
          ...(reopenIfCancelled ? { status: "ACTIVE" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update game.");
        return;
      }
      onOpenChange(false);
      await onSaved();
    } catch {
      setError("Network error while updating game.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit Game Settings</DialogTitle>
            <DialogDescription>
              Changing target score or prize pool automatically recalculates eliminations and
              payouts across all recorded rounds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-game-title">Game Title</Label>
              <Input
                id="edit-game-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-target-score">Target Score</Label>
                <Input
                  id="edit-target-score"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="edit-currency">
                    <SelectValue />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bet-desc">What is the Bet For?</Label>
              <Input
                id="edit-bet-desc"
                placeholder="e.g. Dinner Party, Biryani Treat, Movie Tickets"
                value={betDescription}
                onChange={(e) => setBetDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBetFulfilled}
                  onChange={(e) => setIsBetFulfilled(e.target.checked)}
                  className="rounded border-input"
                />
                <span>Bet fulfilled (enter finalized price)</span>
              </label>
              {isBetFulfilled && (
                <Input
                  id="edit-prize-pool"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="Final bill / price"
                  value={totalPrizePool}
                  onChange={(e) => setTotalPrizePool(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (Optional)</Label>
              <Textarea
                id="edit-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {game?.status === "CANCELLED" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={reopenIfCancelled}
                  onChange={(e) => setReopenIfCancelled(e.target.checked)}
                  className="rounded border-input"
                />
                <span>Re-open this cancelled game session</span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}

