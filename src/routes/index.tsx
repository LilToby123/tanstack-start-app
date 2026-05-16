import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Coins, Wallet, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { ActivityFeed } from "@/components/activity-feed";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlipXRPL — Provably Fair XRP Coin Flip" },
      { name: "description", content: "Flip a coin, double your XRP. Provably fair, settled on the XRP Ledger in under 4 seconds. Free demo mode — no signup needed." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,oklch(0.82_0.16_85_/_0.15)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-16 pb-20 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-12">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-gold bg-card/40 px-4 py-1.5 text-xs font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Provably fair · Live on XRPL
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 font-display text-4xl font-bold leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Flip a coin.<br />
              <span className="text-gradient-gold">Double your XRP.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
            >
              50/50 odds, 1% house edge, settled on the XRP Ledger in seconds. Try it free in demo mode — no wallet needed.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/games/coinflip"
                className="rounded-md bg-gradient-gold px-6 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90 active:scale-95"
              >
                Try free demo
              </Link>
              <Link
                to="/auth"
                className="rounded-md border border-border bg-card/60 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-card active:scale-95"
              >
                Connect Xaman & play
              </Link>
            </motion.div>
            <div className="mt-10 grid max-w-xs grid-cols-3 gap-3 text-left sm:max-w-md sm:gap-4">
              {[
                { k: "1%", v: "House edge" },
                { k: "<4s", v: "XRPL settle" },
                { k: "100%", v: "Auditable" },
              ].map((s) => (
                <div key={s.v} className="rounded-lg border border-border/60 bg-card/40 p-3 sm:p-4">
                  <div className="font-display text-xl font-bold text-gradient-gold sm:text-2xl">{s.k}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px]">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live feed preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl border border-gold/60 bg-card/60 p-5 shadow-gold backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Live flips</h2>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                realtime
              </span>
            </div>
            <ActivityFeed limit={8} compact />
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 text-center sm:mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">From wallet to win in three steps.</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          {[
            { icon: Wallet, t: "Connect Xaman", d: "Sign in with your Xaman wallet — no passwords, no seed phrases. Your XRPL address is your identity." },
            { icon: Coins, t: "Deposit XRP", d: "Send XRP to the house wallet with your unique destination tag. Balance is credited automatically." },
            { icon: ShieldCheck, t: "Flip & withdraw", d: "Every round commits a server-seed hash before you bet. Withdraw to any XRPL address, any time." },
          ].map((s, i) => (
            <div key={s.t} className="relative rounded-xl border border-border/60 bg-card p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-gradient-gold px-3 py-0.5 text-xs font-bold text-primary-foreground">
                Step {i + 1}
              </div>
              <s.icon className="mt-2 h-7 w-7 text-primary" />
              <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="overflow-hidden rounded-2xl border border-gold bg-gradient-hero p-8 text-center shadow-glow sm:p-12">
          <h2 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Ready to flip?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Try the demo right now, then connect your Xaman wallet when you're ready to play for real.
          </p>
          <Link
            to="/games/coinflip"
            className="mt-8 inline-flex rounded-md bg-gradient-gold px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90 active:scale-95"
          >
            Flip a coin
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}