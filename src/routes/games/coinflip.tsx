import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, ShieldCheck, RotateCw, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { ActivityFeed } from "@/components/activity-feed";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dropsToXrp, xrpToDrops } from "@/lib/xrpl";
import { placeCoinFlip, getActiveSeedHash, rotateSeed } from "@/lib/games.functions";
import { getMyVault } from "@/lib/wallet.functions";

export const Route = createFileRoute("/games/coinflip")({
  head: () => ({
    meta: [
      { title: "Coin Flip — FlipXRPL" },
      { name: "description", content: "Provably fair XRP coin flip — 1.99× payout, 1% house edge. Try demo mode free." },
    ],
  }),
  component: CoinFlip,
});

type ServerResult = Awaited<ReturnType<typeof placeCoinFlip>>;
type FlipResult = {
  win: boolean;
  result_side: "heads" | "tails";
  payout_drops: number;
  wager_drops: number;
  demo: boolean;
};

const DEMO_KEY = "flipxrpl_demo_balance";
const DEMO_START = 100_000_000;   // 100 XRP play-money
const DEMO_MAX_BET = 10_000_000;  // 10 XRP demo cap
const REAL_MIN_BET = 1_000_000;   // 1 XRP
const REAL_MAX_BET = 100_000_000; // 100 XRP hard cap

function clampBet(xrp: number, isDemo: boolean): number {
  const min = 1;
  const max = isDemo ? 10 : 100;
  return Math.min(max, Math.max(min, xrp));
}

function CoinFlip() {
  const placeFn = useServerFn(placeCoinFlip);
  const seedFn = useServerFn(getActiveSeedHash);
  const rotateFn = useServerFn(rotateSeed);
  const vaultFn = useServerFn(getMyVault);
  const qc = useQueryClient();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [realDrops, setRealDrops] = useState(0);
  const [demoDrops, setDemoDrops] = useState(DEMO_START);
  const [bet, setBet] = useState(1); // XRP
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [clientSeed, setClientSeed] = useState(() => Math.random().toString(36).slice(2, 10));
  const [seedHash, setSeedHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<FlipResult | null>(null);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? Number(localStorage.getItem(DEMO_KEY)) : 0;
    if (saved > 0) setDemoDrops(saved);
    supabase.auth.getSession().then(async ({ data }) => {
      const isAuthed = !!data.session;
      setAuthed(isAuthed);
      if (isAuthed) {
        setDemoMode(false);
        const v = await vaultFn();
        setRealDrops(v.drops);
        const s = await seedFn();
        setSeedHash(s.seed_hash);
      }
    });
  }, [seedFn, vaultFn]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(DEMO_KEY, String(demoDrops));
  }, [demoDrops]);

  const balanceDrops = demoMode ? demoDrops : realDrops;
  const maxBetXrp = demoMode ? 10 : 100;
  const minBetXrp = 1;

  function setBetClamped(xrp: number) {
    setBet(clampBet(xrp, demoMode));
  }

  function doDouble() { setBetClamped(bet * 2); }
  function doHalf() { setBetClamped(Math.max(1, bet / 2)); }

  function flipDemo() {
    const wager = xrpToDrops(bet);
    if (wager > DEMO_MAX_BET) {
      toast.error("Demo bets are capped at 10 XRP");
      return;
    }
    if (wager > demoDrops) {
      toast.error("Demo balance too low — reset it below");
      return;
    }
    setBusy(true);
    setFlipping(true);
    const roll = Math.random();
    const win = side === "heads" ? roll < 0.495 : roll >= 0.505;
    const result_side: "heads" | "tails" = roll < 0.5 ? "heads" : "tails";
    setTimeout(() => {
      const payout = win ? Math.floor(wager * 1.99) : 0;
      setDemoDrops((d) => d - wager + payout);
      setLast({ win, result_side, payout_drops: payout, wager_drops: wager, demo: true });
      setBusy(false);
      setFlipping(false);
      if (win) toast.success(`Demo win — +${dropsToXrp(payout - wager)} XRP`);
      else toast(`Demo loss — landed on ${result_side}`);
    }, 1400);
  }

  async function flipReal() {
    if (!authed) {
      toast.error("Connect your Xaman wallet to play with real XRP");
      return;
    }
    const wager = xrpToDrops(bet);
    if (wager < REAL_MIN_BET) { toast.error("Minimum bet is 1 XRP"); return; }
    if (wager > REAL_MAX_BET) { toast.error("Maximum bet is 100 XRP"); return; }
    if (wager > realDrops) { toast.error("Insufficient balance — deposit XRP first"); return; }
    setBusy(true);
    setFlipping(true);
    try {
      const res: ServerResult = await placeFn({ data: { side, wager_drops: wager, client_seed: clientSeed } });
      await new Promise((r) => setTimeout(r, 1400));
      if (!res.ok) { toast.error(res.error); return; }
      setLast({
        win: res.win,
        result_side: res.result_side as "heads" | "tails",
        payout_drops: res.payout_drops,
        wager_drops: wager,
        demo: false,
      });
      setRealDrops(res.new_balance_drops);
      qc.invalidateQueries({ queryKey: ["vault"] });
      if (res.win) toast.success(`You won ${dropsToXrp(res.payout_drops - wager)} XRP`);
      else toast(`House wins — landed on ${res.result_side}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bet failed";
      toast.error(msg);
    } finally {
      setBusy(false);
      setFlipping(false);
    }
  }

  function flip() {
    if (demoMode) flipDemo();
    else flipReal();
  }

  async function rotate() {
    if (!authed) return;
    const r = await rotateFn();
    setSeedHash(r.new_seed_hash);
    if (r.revealed) toast.success("Previous seed revealed — verify any past bet");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Toaster theme="dark" />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1fr_340px] lg:gap-10">

        {/* GAME PANEL */}
        <section>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">Game · 1% house edge</p>
              <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Coin Flip</h1>
            </div>
            {/* Demo / Real toggle */}
            <div className="inline-flex rounded-md border border-border bg-card/40 p-1 text-xs font-semibold">
              <button
                onClick={() => setDemoMode(true)}
                className={`rounded px-3 py-1.5 transition ${demoMode ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
              >
                <Sparkles className="mr-1 inline h-3 w-3" /> Demo
              </button>
              <button
< truncated lines 192-196 >
              >
                Real XRP
              </button>
            </div>
          </div>

          {/* DEMO WATERMARK BANNER */}
          {demoMode && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Demo mode — play money only, no real XRP
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          )}

          {/* COIN + RESULT */}
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 p-8 sm:p-10 relative overflow-hidden">
            {/* Subtle DEMO watermark overlay */}
            {demoMode && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04] select-none">
                <span className="font-display text-[120px] font-black uppercase tracking-widest text-foreground rotate-[-30deg]">DEMO</span>
              </div>
            )}

            {/* Coin */}
            <div className="relative h-40 w-40 [perspective:800px] sm:h-48 sm:w-48">
              <AnimatePresence mode="wait">
                <motion.div
                  key={(last?.result_side ?? "rest") + (flipping ? "-flipping" : "")}
                  initial={flipping ? { rotateY: 0 } : { scale: 0.6, opacity: 0 }}
                  animate={flipping ? { rotateY: 1800 } : { scale: 1, opacity: 1 }}
                  transition={flipping ? { duration: 1.4, ease: "easeOut" } : { duration: 0.3 }}
                  className="flex h-full w-full items-center justify-center rounded-full bg-gradient-gold text-primary-foreground shadow-gold [transform-style:preserve-3d]"
                >
                  <Coins className="h-16 w-16 sm:h-20 sm:w-20" />
                  <span className="absolute bottom-3 font-display text-sm font-bold uppercase">
                    {flipping ? "…" : last ? last.result_side : side}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Result */}
            {last && !flipping && (
              <p className={`mt-5 font-display text-xl font-bold sm:text-2xl ${last.win ? "text-gradient-gold" : "text-muted-foreground"}`}>
                {last.win
                  ? `+${dropsToXrp(last.payout_drops - last.wager_drops)} XRP`
                  : `−${dropsToXrp(last.wager_drops)} XRP`}
                {last.demo && <span className="ml-2 text-xs uppercase tracking-wider text-accent">demo</span>}
              </p>
            )}

            {/* Heads / Tails */}
            <div className="mt-6 flex gap-3">
              {(["heads", "tails"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`rounded-md border px-6 py-2.5 text-sm font-semibold uppercase tracking-wider transition active:scale-95 ${
                    side === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Wager input */}
            <div className="mt-6 w-full max-w-sm">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Wager (XRP)</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={minBetXrp}
                  max={maxBetXrp}
                  step={1}
                  value={bet}
                  onChange={(e) => setBetClamped(Number(e.target.value))}
                  className="flex-1 rounded-md border border-border bg-input px-4 py-2.5 text-sm font-mono outline-none focus:border-primary"
                />
              </div>

              {/* Quick bet buttons */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 5, 25, 50, 100].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBetClamped(n)}
                    disabled={n > maxBetXrp}
                    className="rounded border border-border px-2.5 py-1 text-xs font-medium hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-95"
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={doHalf}
                  className="rounded border border-border px-2.5 py-1 text-xs font-medium hover:bg-card transition active:scale-95"
                >
                  ½
                </button>
                <button
                  onClick={doDouble}
                  className="rounded border border-border px-2.5 py-1 text-xs font-medium hover:bg-card transition active:scale-95"
                >
                  2×
                </button>
              </div>

              {/* Balance row */}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{demoMode ? "Demo balance" : "Balance"}: {dropsToXrp(balanceDrops)} XRP</span>
                {demoMode && (
                  <button
                    onClick={() => setDemoDrops(DEMO_START)}
                    className="text-accent hover:underline"
                  >
                    Reset demo
                  </button>
                )}
              </div>
              {demoMode && (
                <p className="mt-1 text-[10px] text-muted-foreground">Demo bets capped at 10 XRP · Resets to 100 XRP</p>
              )}
            </div>

            {/* Flip button — large tap target */}
            <button
              onClick={flip}
              disabled={busy}
              className="mt-7 w-full max-w-sm rounded-md bg-gradient-gold py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-gold transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60 text-base sm:text-sm"
            >
              {busy ? "Flipping…" : `Flip ${bet} XRP${demoMode ? " (demo)" : ""}`}
            </button>
          </div>
        </section>

        {/* SIDEBAR */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* Live activity */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Live activity</h3>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                realtime
              </span>
            </div>
            <ActivityFeed limit={12} compact />
          </div>

          {/* Provably fair */}
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-accent" /> Provably fair
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Server seed is committed via SHA-256 hash before your bet. Reveal it any time to verify on the{" "}
              <a href="/verify" className="text-accent hover:underline">Verify page</a>.
            </p>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="uppercase tracking-wider text-muted-foreground">Server seed hash</p>
                <p className="mt-1 truncate font-mono text-[11px]">
                  {seedHash ?? (authed ? "—" : "Sign in to see")}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wider text-muted-foreground">Client seed</p>
                <input
                  value={clientSeed}
                  onChange={(e) => setClientSeed(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-input px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>
            {authed && (
              <button onClick={rotate} className="mt-3 inline-flex items-center gap-2 text-xs text-accent hover:underline">
                <RotateCw className="h-3 w-3" /> Reveal & rotate seed
              </button>
            )}
          </div>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}