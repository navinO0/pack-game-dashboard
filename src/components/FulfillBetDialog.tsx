"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Trophy } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { ordinalLabel, roundCurrency } from "@/lib/game-engine";

export interface FulfillableGame {
  id: string;
  title: string;
  betDescription?: string | null;
  totalPrizePool: number;
  isBetFulfilled?: boolean;
  currency: string;
  distributionMode?: "ELIMINATION_CONTRIBUTION" | "PRIZE_SPLIT";
  players: Array<{
    id: string;
    name: string;
    isEliminated: boolean;
    eliminationOrder: number | null;
    isWinner: boolean;
    prizePercentage?: number;
  }>;
}

interface FulfillBetDialogProps {
  game: FulfillableGame | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFulfilled: () => void | Promise<void>;
}

export function FulfillBetDialog({
  game,
  open,
  onOpenChange,
  onFulfilled,
}: FulfillBetDialogProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (game && open) {
      setAmount(game.isBetFulfilled && game.totalPrizePool > 0 ? String(game.totalPrizePool) : "");
      setCurrency(game.currency || "INR");
      setError(null);
    }
  }, [game, open]);

  const numericAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game) return;
    setError(null);

    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Please enter a valid final amount greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrizePool: roundCurrency(parsed),
          currency,
          isBetFulfilled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to finalize bet amount.");
        return;
      }
      onOpenChange(false);
      await onFulfilled();
    } catch {
      setError("Network error while finalizing bet.");
    } finally {
      setSaving(false);
    }
  };

  const orderedPlayers = game
    ? [
        ...game.players
          .filter((p) => p.isEliminated)
          .sort((a, b) => (a.eliminationOrder ?? 999) - (b.eliminationOrder ?? 999)),
        ...game.players.filter((p) => p.isWinner),
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Fulfill Bet &amp; Finalize Price</DialogTitle>
            <DialogDescription>
              {game?.betDescription ? (
                <>
                  Bet: <strong className="text-foreground">{game.betDescription}</strong>. Enter the
                  final bill/price to replace percentages with exact amounts.
                </>
              ) : (
                <>Enter the final bill/price for <strong>{game?.title}</strong> to convert percentages into exact amounts.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="fulfill-amount">Final Bet Price / Amount</Label>
                <Input
                  id="fulfill-amount"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                  className="font-mono font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fulfill-currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="fulfill-currency">
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

            {numericAmount > 0 && orderedPlayers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Calculated Split Preview
                </Label>
                <div className="rounded-lg border divide-y">
                  {orderedPlayers.map((p) => {
                    const pct = p.prizePercentage ?? 0;
                    const calcAmt = p.isWinner
                      ? 0
                      : roundCurrency((numericAmount * pct) / 100);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {p.isWinner ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] shrink-0">
                              <Trophy className="mr-1 h-3 w-3" />
                              Winner (0%)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {ordinalLabel(p.eliminationOrder || 0)} ({pct}%)
                            </Badge>
                          )}
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                        <span
                          className={`font-mono font-semibold tabular-nums shrink-0 ${
                            p.isWinner ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {p.isWinner
                            ? `${formatCurrency(0, currency)} (Free)`
                            : formatCurrency(calcAmt, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || numericAmount <= 0}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Finalize &amp; Save Price
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

