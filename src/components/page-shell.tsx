import { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "./site-header";

export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12">
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
          )}
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{title}</h1>
          {description && (
            <p className="mt-4 max-w-2xl text-muted-foreground">{description}</p>
          )}
        </header>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function ComingSoon({ note }: { note?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
      <p className="font-display text-2xl text-gradient-gold">Coming next</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {note ?? "This surface is wired to the design system and will be built out in the next iteration."}
      </p>
    </div>
  );
}