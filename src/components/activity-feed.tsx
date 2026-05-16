import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dropsToXrp } from "@/lib/xrpl";

type Bet = {
  id: string;
  user_id: string;
  wager_drops: number;
  payout_drops: number;
  outcome: { picked?: string; result_side?: string; win?: boolean } | null;
  created_at: string;
  display_name?: string | null;
  xrpl_address?: string | null;
};

function shortAddr(a?: string | null) {
  if (!a) return "anon";
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function ActivityFeed({ limit = 25, compact = false }: { limit?: number; compact?: boolean }) {
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: rows } = await supabase
        .from("bets")
        .select("id, user_id, wager_drops, payout_drops, outcome, created_at")
        .eq("game", "coinflip")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!rows || cancelled) return;
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, xrpl_address")
        .in("id", userIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      setBets(
        rows.map((r) => ({
          ...r,
          wager_drops: Number(r.wager_drops),
          payout_drops: Number(r.payout_drops),
          outcome: r.outcome as Bet["outcome"],
          display_name: byId.get(r.user_id)?.display_name ?? null,
          xrpl_address: byId.get(r.user_id)?.xrpl_address ?? null,
        })),
      );
    }
    load();

    const channel = supabase
      .channel("bets-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bets" }, async (payload) => {
        const r = payload.new as { id: string; user_id: string; game: string; wager_drops: number; payout_drops: number; outcome: Bet["outcome"]; created_at: string };
        if (r.game !== "coinflip") return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, xrpl_address")
          .eq("id", r.user_id)
          .maybeSingle();
        setBets((prev) => [
          {
            id: r.id,
            user_id: r.user_id,
            wager_drops: Number(r.wager_drops),
            payout_drops: Number(r.payout_drops),
            outcome: r.outcome,
            created_at: r.created_at,
            display_name: prof?.display_name ?? null,
            xrpl_address: prof?.xrpl_address ?? null,
          },
          ...prev,
        ].slice(0, limit));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {bets.map((b) => {
          const win = !!b.outcome?.win;
          const profit = win ? b.payout_drops - b.wager_drops : -b.wager_drops;
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center justify-between gap-3 rounded-lg border bg-card/40 px-3 py-2 ${
                win ? "border-primary/40" : "border-border/60"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  win ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {win ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {b.display_name || shortAddr(b.xrpl_address)}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      bet {dropsToXrp(b.wager_drops)} on {b.outcome?.picked ?? "?"}
                    </span>
                  </p>
                  {!compact && (
                    <p className="text-xs text-muted-foreground">
                      Landed {b.outcome?.result_side ?? "?"} · {timeAgo(b.created_at)} ago
                    </p>
                  )}
                </div>
              </div>
              <div className={`shrink-0 font-mono text-sm font-bold ${win ? "text-primary" : "text-muted-foreground"}`}>
                {win ? "+" : ""}{dropsToXrp(profit)}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {bets.length === 0 && (
        <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No flips yet — be the first.
        </p>
      )}
    </div>
  );
}
