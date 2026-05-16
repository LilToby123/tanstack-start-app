import { Link } from "@tanstack/react-router";
import { Coins, Menu, X } from "lucide-react";
import { useState } from "react";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-gold shadow-gold">
            <Coins className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            Flip<span className="text-gradient-gold">XRPL</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 text-sm md:flex">
          <Link to="/games/coinflip" className="text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Play
          </Link>
          <Link to="/leaderboard" className="text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Leaderboard
          </Link>
          <Link to="/verify" className="text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Verify
          </Link>
          <Link to="/wallet" className="text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Wallet
          </Link>
        </nav>

        {/* Desktop CTA */}
        <Link
          to="/auth"
          className="hidden md:inline-flex items-center justify-center rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90"
        >
          Connect Xaman
        </Link>

        {/* Mobile menu toggle */}
        <button
          className="flex md:hidden items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {[
              { to: "/games/coinflip", label: "Play" },
              { to: "/leaderboard", label: "Leaderboard" },
              { to: "/verify", label: "Verify" },
              { to: "/wallet", label: "Wallet" },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground transition"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/auth"
              className="mt-2 rounded-md bg-gradient-gold px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-gold"
              onClick={() => setMenuOpen(false)}
            >
              Connect Xaman
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p>© {new Date().getFullYear()} FlipXRPL. Provably fair coin flip on the XRP Ledger.</p>
          <p className="text-xs">18+ only. Play responsibly. Built on XRPL.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <Link to="/verify" className="hover:text-foreground transition">Verify</Link>
          <Link to="/leaderboard" className="hover:text-foreground transition">Leaderboard</Link>
          <a href="https://twitter.com/FlipXRPL" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">@FlipXRPL</a>
          <span>flipxrpl.xyz</span>
        </div>
      </div>
    </footer>
  );
}
