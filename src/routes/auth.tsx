import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Coins, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FlipXRPL" }] }),
  component: AuthPage,
});

// ─── Xaman Sign-In ───────────────────────────────────────────────────────────
// Xaman uses a sign-in payload flow:
// 1. POST to your backend → creates a SignIn payload via Xaman API
// 2. Show the QR / deeplink to user
// 3. Poll until signed → backend verifies → creates Supabase session
//
// The button below kicks off that flow via /api/xaman/signin
// which you implement as a Supabase Edge Function or TanStack server fn.

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"xaman" | "email">("xaman");

  // Email/password fields (fallback)
  const [emailMode, setEmailMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Xaman state
  const [xamanQr, setXamanQr] = useState<string | null>(null);
  const [xamanDeeplink, setXamanDeeplink] = useState<string | null>(null);
  const [xamanPolling, setXamanPolling] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/wallet" });
    });
  }, [navigate]);

  // ── Xaman sign-in flow ──
  async function startXamanSignIn() {
    setBusy(true);
    try {
      // Call your backend endpoint that creates a Xaman SignIn payload
      const res = await fetch("/api/xaman/signin", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create Xaman sign-in request");
      const data = await res.json();
      // data: { uuid, qr_png, next_url, deeplink }
      setXamanQr(data.qr_png);
      setXamanDeeplink(data.deeplink ?? data.next_url);
      pollXaman(data.uuid);
    } catch (err: any) {
      toast.error(err.message ?? "Xaman sign-in failed");
      setBusy(false);
    }
  }

  function pollXaman(uuid: string) {
    setXamanPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/xaman/signin/status?uuid=${uuid}`);
        const data = await res.json();
        if (data.signed) {
          clearInterval(interval);
          setXamanPolling(false);
          setXamanQr(null);
          // Backend should have created a Supabase session by now
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            toast.success("Signed in with Xaman!");
            navigate({ to: "/wallet" });
          } else {
            toast.error("Session not found — try again");
          }
          setBusy(false);
        } else if (data.expired) {
          clearInterval(interval);
          setXamanPolling(false);
          setXamanQr(null);
          toast.error("Sign-in request expired — try again");
          setBusy(false);
        }
      } catch {
        // keep polling
      }
    }, 2500);
    // Timeout after 3 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (xamanPolling) {
        setXamanPolling(false);
        setXamanQr(null);
        setBusy(false);
        toast.error("Sign-in timed out — try again");
      }
    }, 180_000);
  }

  // ── Email/password fallback ──
  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (emailMode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=signin`,
        });
        if (error) throw error;
        toast.success("Password reset email sent — check your inbox");
        setEmailMode("signin");
        setBusy(false);
        return;
      }
      if (emailMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/wallet` },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/wallet" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Toaster theme="dark" />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
            <Coins className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">FlipXRPL</h1>
          <p className="mt-2 text-sm text-muted-foreground">Connect your wallet to play with real XRP</p>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-lg border border-border bg-card/40 p-1">
          <button
            onClick={() => setMode("xaman")}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${mode === "xaman" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Xaman wallet
          </button>
          <button
            onClick={() => setMode("email")}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${mode === "email" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Email
          </button>
        </div>

        {/* ── XAMAN PANEL ── */}
        {mode === "xaman" && (
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
            {!xamanQr ? (
              <>
                <p className="text-sm text-muted-foreground mb-6">
                  Sign in with your Xaman wallet — no password needed. Your XRPL address is your identity.
                </p>
                <button
                  onClick={startXamanSignIn}
                  disabled={busy}
                  className="w-full rounded-md bg-gradient-gold py-3.5 text-sm font-bold text-primary-foreground shadow-gold transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? "Opening Xaman…" : "Sign in with Xaman"}
                </button>
                <p className="mt-4 text-xs text-muted-foreground">
                  Don't have Xaman?{" "}
                  <a href="https://xaman.app" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                    Download free <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium mb-4">
                  {xamanPolling ? "Waiting for Xaman approval…" : "Scan with Xaman"}
                </p>
                {/* QR code image returned from Xaman API */}
                <img src={xamanQr} alt="Xaman QR code" className="mx-auto h-48 w-48 rounded-lg border border-border" />
                {xamanDeeplink && (
                  <a
                    href={xamanDeeplink}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-card/60 transition"
                  >
                    Open in Xaman app <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => { setXamanQr(null); setXamanPolling(false); setBusy(false); }}
                  className="mt-4 block w-full text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* ── EMAIL PANEL ── */}
        {mode === "email" && (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            {emailMode === "reset" ? (
              <>
                <h2 className="font-display text-xl font-bold mb-1">Reset password</h2>
                <p className="text-xs text-muted-foreground mb-6">Enter your email and we'll send a reset link.</p>
                <form onSubmit={submitEmail} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full rounded-md border border-border bg-input px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-md bg-gradient-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                  <button type="button" onClick={() => setEmailMode("signin")} className="w-full text-xs text-muted-foreground hover:text-foreground mt-2">
                    ← Back to sign in
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold mb-6">
                  {emailMode === "signup" ? "Create account" : "Welcome back"}
                </h2>
                <form onSubmit={submitEmail} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full rounded-md border border-border bg-input px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-2 w-full rounded-md border border-border bg-input px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                    {emailMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setEmailMode("reset")}
                        className="mt-1.5 block text-xs text-accent hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-2 w-full rounded-md bg-gradient-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Working…" : emailMode === "signup" ? "Create account" : "Sign in"}
                  </button>
                </form>
                <button
                  onClick={() => setEmailMode(emailMode === "signup" ? "signin" : "signup")}
                  className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {emailMode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
                </button>
              </>
            )}
          </div>
        )}

        <Link to="/" className="mt-8 text-center text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
      </main>
      <SiteFooter />
    </div>
  );
}