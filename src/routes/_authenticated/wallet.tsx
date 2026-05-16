import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, LogOut, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { getMyVault, requestWithdraw } from "@/lib/wallet.functions";
import { dropsToXrp, xrpToDrops, isLikelyXrplAddress } from "@/lib/xrpl";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — RippleFlip" }] }),
  component: WalletPage,
});

function WalletPage() {
  const router = useRouter();
  const fetchVault = useServerFn(getMyVault);
  const withdrawFn = useServerFn(requestWithdraw);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["vault"],
    queryFn: () => fetchVault(),
    refetchInterval: 15_000,
  });

  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawXrp, setWithdrawXrp] = useState(1);
  const [withdrawing, setWithdrawing] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  async function doWithdraw() {
    if (!isLikelyXrplAddress(withdrawTo)) {
      toast.error("Invalid XRPL address");
      return;
    }
    if (withdrawXrp < 1) {
      toast.error("Minimum withdrawal is 1 XRP");
      return;
    }
    setWithdrawing(true);
    try {
      const res = await withdrawFn({
        data: { to_address: withdrawTo, drops: xrpToDrops(withdrawXrp) },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Sent! Tx: ${res.tx_hash.slice(0, 12)}…`);
      setWithdrawTo("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Toaster theme="dark" />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">Your vault</p>
            <h1 className="mt-2 font-display text-4xl font-bold">Wallet</h1>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-card">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {isLoading || !data ? (
          <div className="mt-12 h-40 animate-pulse rounded-2xl border border-border/60 bg-card/40" />
        ) : (
          <>
            <div className="mt-10 rounded-2xl border border-gold bg-gradient-hero p-10 shadow-gold">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Available balance</p>
              <p className="mt-3 font-display text-6xl font-bold text-gradient-gold">
                {dropsToXrp(data.drops)} <span className="text-2xl text-foreground/70">XRP</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/games/coinflip" className="rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-gold">
                  Play coin flip
                </Link>
              </div>
            </div>

            <section className="mt-10 grid gap-6 md:grid-cols-2">
              {/* Deposit */}
              <div className="rounded-xl border border-border/60 bg-card p-6">
                <h2 className="flex items-center gap-2 font-semibold"><ArrowDownToLine className="h-4 w-4 text-accent" /> Deposit XRP</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Send XRP to the house wallet <strong>with the destination tag</strong>. Credited automatically.
                </p>
                <Field label="Network" value={data.network} />
                <Field label="House address" value={data.houseAddress || "(not configured)"} mono onCopy={() => copy(data.houseAddress, "Address")} />
                <Field label="Destination tag" value={String(data.profile?.destination_tag ?? "—")} mono onCopy={() => copy(String(data.profile?.destination_tag ?? ""), "Tag")} />
                <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                  Without the destination tag your deposit cannot be credited.
                </p>
              </div>

              {/* Withdraw */}
              <div className="rounded-xl border border-border/60 bg-card p-6">
                <h2 className="flex items-center gap-2 font-semibold"><ArrowUpFromLine className="h-4 w-4 text-accent" /> Withdraw XRP</h2>
                <p className="mt-2 text-sm text-muted-foreground">Sent on-chain from the vault. Min 1 XRP. Network fee ~0.000012 XRP.</p>
                <div className="mt-4">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Destination address</label>
                  <input
                    value={withdrawTo}
                    onChange={(e) => setWithdrawTo(e.target.value.trim())}
                    placeholder={data.profile?.xrpl_address ?? "r..."}
                    className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => setWithdrawTo(data.profile?.xrpl_address ?? "")}
                    className="mt-1 text-xs text-accent hover:underline"
                  >
                    Use my XRPL address
                  </button>
                </div>
                <div className="mt-3">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (XRP)</label>
                  <input
                    type="number"
                    min={1}
                    step={0.1}
                    value={withdrawXrp}
                    onChange={(e) => setWithdrawXrp(Math.max(1, Number(e.target.value)))}
                    className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={doWithdraw}
                  disabled={withdrawing || data.drops < xrpToDrops(withdrawXrp)}
                  className="mt-5 w-full rounded-md bg-gradient-gold py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-gold transition hover:opacity-90 disabled:opacity-60"
                >
                  {withdrawing ? "Sending on-chain…" : `Withdraw ${withdrawXrp} XRP`}
                </button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Identity address: <span className="font-mono">{data.profile?.xrpl_address ?? "—"}</span>
                </p>
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
        <span className={mono ? "truncate font-mono text-sm" : "text-sm"}>{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}
