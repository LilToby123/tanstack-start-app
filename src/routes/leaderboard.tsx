import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — FlipXRPL" },
      { name: "description", content: "Top FlipXRPL players by biggest win, total wagered, and total profit." },
    ],
  }),
  component: LeaderboardPage,
});

type Row = { address: string; value: number };

function shorten(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function dropsToXrp(d: number) {
  return (d / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Board({ title, rows, valueLabel, medal }: { title: string; rows: Row[]; valueLabel: string; medal: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
        <span className="text-xl">{medal}</span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No data yet — be the first!</p>
      ) : (
        <ol className="divide-y divide-border/40">
          {rows.map((row, i) => (
            <li key={row.address} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center text-sm font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <span className="font-mono text-sm">{shorten(row.address)}</span>
              </div>
              <span className="font-mono text-sm font-semibold">
                {dropsToXrp(row.value)} <span className="text-xs text-muted-foreground">{valueLabel}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LeaderboardPage() {
  const [biggestWins, setBiggestWins] = useState<Row[]>([]);
  const [mostWagered, setMostWagered] = useState<Row[]>([]);
  const [mostProfit, setMostProfit] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Biggest single win
        const { data: wins } = await supabase
          .from("bets")
          .select("profiles(xrpl_address), payout_drops, wager_drops")
          .eq("game", "coinflip")
          .gt("payout_drops", 0)
          .order("payout_drops", { ascending: false })
          .limit(10);

        if (wins) {
          setBiggestWins(
            wins.map((b: any) => ({
              address: b.profiles?.xrpl_address ?? "unknown",
              value: b.payout_drops - b.wager_drops,
            }))
          );
        }

        // Most wagered (aggregate by user)
        const { data: wagered } = await supabase
          .from("bets")
          .select("user_id, wager_drops, profiles(xrpl_address)")
          .eq("game", "coinflip");

        if (wagered) {
          const agg: Record<string, { address: string; total: number }> = {};
          wagered.forEach((b: any) => {
            if (!agg[b.user_id]) agg[b.user_id] = { address: b.profiles?.xrpl_address ?? "unknown", total: 0 };
            agg[b.user_id].total += Number(b.wager_drops);
          });
          setMostWagered(
            Object.values(agg)
              .sort((a, b) => b.total - a.total)
              .slice(0, 10)
              .map((r) => ({ address: r.address, value: r.total }))
          );
        }

        // Most profit (payout - wager aggregated)
        if (wagered) {
          const profit: Record<string, { address: string; total: number }> = {};
          wagered.forEach((b: any) => {
            if (!profit[b.user_id]) profit[b.user_id] = { address: b.profiles?.xrpl_address ?? "unknown", total: 0 };
          });
          const { data: payouts } = await supabase
            .from("bets")
            .select("user_id, wager_drops, payout_drops")
            .eq("game", "coinflip");
          if (payouts) {
            payouts.forEach((b: any) => {
              if (!profit[b.user_id]) profit[b.user_id] = { address: "unknown", total: 0 };
              profit[b.user_id].total += Number(b.payout_drops) - Number(b.wager_drops);
            });
            setMostProfit(
              Object.values(profit)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10)
                .map((r) => ({ address: r.address, value: r.total }))
            );
          }
        }

        setLastUpdated(new Date().toLocaleString());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/40 bg-gradient-gold shadow-gold">
            <Trophy className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Leaderboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Top FlipXRPL players · Shortened wallet addresses only</p>
          {lastUpdated && (
            <p className="mt-1 text-xs text-muted-foreground">Updated {lastUpdated}</p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <Board title="Biggest single win" rows={biggestWins} valueLabel="XRP" medal="🥇" />
            <Board title="Most wagered" rows={mostWagered} valueLabel="XRP" medal="🎲" />
            <Board title="Most profitable" rows={mostProfit} valueLabel="XRP" medal="💰" />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}