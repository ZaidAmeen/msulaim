import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

function NavItem({
  to,
  label,
  glyph,
}: {
  to: string;
  label: string;
  glyph: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 px-1 py-1.5 ${
        active ? "text-brand" : "text-inkmuted"
      }`}
    >
      <span className="text-[16px]">{glyph}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="appbg min-h-screen w-full font-body text-ink antialiased relative">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="glass sticky top-0 z-20 border-b border-white/40">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-[10px] bg-brand grid place-items-center text-[11px] font-display font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--brand)]">
                MS
              </div>
              <div className="leading-tight">
                <div className="font-display text-[15px] font-semibold tracking-tight">
                  M Sulaim
                </div>
                <div className="text-[10px] text-inkmuted -mt-0.5">{subtitle ?? "Dyeing & Processing Services"}</div>
              </div>
            </div>
            <Link
              to="/history"
              aria-label="Statement history"
              className="h-9 px-3 rounded-full glass grid place-items-center text-[11px] font-semibold text-brand"
            >
              History
            </Link>
          </div>
        </header>

        <main className="px-5 pt-5 pb-32 space-y-5">
          <h1 className="font-display text-[26px] font-bold tracking-tight leading-none">
            {title}
          </h1>
          {children}
        </main>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-5 pt-3">
          <div className="glass rounded-full border border-white/50 shadow-[0_18px_40px_-16px_#0e224455] flex items-center justify-around py-2">
            <NavItem to="/" label="Board" glyph="■" />
            <NavItem to="/vouchers" label="Vouchers" glyph="☰" />
            <Link
              to="/new"
              className="size-12 -mt-6 rounded-full bg-brand grid place-items-center text-primary-foreground text-[22px] font-light shadow-[0_10px_24px_-8px_var(--brand)]"
            >
              +
            </Link>
            <NavItem to="/reports" label="Reports" glyph="▤" />
            <NavItem to="/deliveries" label="Delivery" glyph="●" />
            <NavItem to="/outsourcing" label="Outsource" glyph="⇄" />
            <NavItem to="/transport" label="Transport" glyph="▣" />
          </div>
        </div>
      </div>
    </div>
  );
}
