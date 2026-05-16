import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { ShieldCheck, Search } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify — FlipXRPL" },
      { name: "description", content: "Verify any FlipXRPL flip result. Enter a transaction hash to see the full provably fair proof." },
    ],
  }),
  component: VerifyPage,
});

type VerifyResult = {
  tx_hash: string;
  game: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  combined_hash: string;
  roll: number;
  picked: string;
  result_side: string;
  win: boolean;
  wager_drops: number;
  payout_drops: number;
  created_at: string;
};

function VerifyPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const hash = input.trim();
    if (!hash) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/verify?tx=${encodeURIComponent(hash)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Verification failed");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      toast.error(err.message ?? "Could not verify");
    } finally {
      setLoading(false);
    }
  }

  const dropsToXrp = (d: number) => (d / 1_000_000).toFixed(6);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Toaster theme="dark" />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/40 bg-accent/10">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Provably Fair Verify</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Enter any FlipXRPL transaction hash to independently verify the outcome was fair.
            No login required.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={verify} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter transaction hash…"
            className="flex-1 rounded-md border border-border bg-input px-4 py-3 font-mono text-sm outline-none focus:border-primary placeholder:font-sans placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90 disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {loading ? "Checking…" : "Verify"}
          </button>
        </form>

        {/* Not found */}
        {notFound && (
          <div className="mt-8 rounded-xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
            No flip found for that transaction hash. Check the hash and try again.
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-8 space-y-4">
            {/* Outcome banner */}
            <div className={`rounded-xl border p-5 text-center ${result.win ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"}`}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Outcome</p>
              <p className={`font-display text-3xl font-bold ${result.win ? "text-gradient-gold" : "text-muted-foreground"}`}>
                {result.win ? "WIN" : "LOSS"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Picked <span className="font-semibold text-foreground capitalize">{result.picked}</span> · Landed <span className="font-semibold text-foreground capitalize">{result.result_side}</span>
              </p>
              <div className="mt-3 flex justify-center gap-6 text-xs">
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider">Wagered</p>
                  <p className="font-mono font-semibold">{dropsToXrp(result.wager_drops)} XRP</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider">Payout</p>
                  <p className="font-mono font-semibold">{dropsToXrp(result.payout_drops)} XRP</p>
                </div>
              </div>
            </div>

            {/* Proof breakdown */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> Full proof
              </h2>
              {[
                { label: "TX Hash", value: result.tx_hash },
                { label: "Server seed (revealed)", value: result.server_seed },
                { label: "Server seed hash (SHA-256)", value: result.server_seed_hash },
                { label: "Client seed", value: result.client_seed },
                { label: "Nonce", value: String(result.nonce) },
                { label: "Combined hash (HMAC-SHA256)", value: result.combined_hash },
                { label: "Roll (0–1)", value: result.roll.toFixed(8) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-0.5 break-all font-mono text-xs">{value}</p>
                </div>
              ))}
            </div>

            {/* Formula explanation */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground text-sm">How the outcome was derived</p>
              <p>1. Server seed is generated and SHA-256 hashed before your bet. The hash is shown to you as the commitment.</p>
              <p>2. After the bet, the server seed is combined with your client seed and nonce using HMAC-SHA256.</p>
              <p>3. The resulting hash is converted to a float between 0 and 1 (the roll).</p>
              <p>4. If you picked <strong>Heads</strong>: win if roll &lt; 0.495. If <strong>Tails</strong>: win if roll ≥ 0.505.</p>
              <p>5. This gives a 49.5% win chance per side — a 1% house edge.</p>
              <p className="pt-1">You can verify step 2–4 yourself using any SHA-256 HMAC tool.</p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Flip occurred at {new Date(result.created_at).toLocaleString()}
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}