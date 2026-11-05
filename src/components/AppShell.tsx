import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { boardQuery } from "@/lib/voucher-queries";
import { BUSINESS } from "@/lib/brand";

const DRAWER_ITEMS = [
  { to: "/deliveries", label: "Delivery vouchers", glyph: "●" },
  { to: "/outsourcing", label: "Outsourcing", glyph: "⇄" },
  { to: "/transport", label: "Transport", glyph: "▣" },
  { to: "/reports", label: "Reports", glyph: "▤" },
  { to: "/history", label: "History", glyph: "◷" },
  { to: "/masters", label: "Masters", glyph: "⚙" },
  { to: "/settings", label: "Settings", glyph: "✧" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState(false);
  // Best-effort read so the shell keeps working on error screens too.
  const { data: board } = useQuery({ ...boardQuery, retry: false });
  const business = {
    name: board?.business?.name || BUSINESS.name,
    subtitle: board?.business?.subtitle || BUSINESS.tagline,
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="appbg min-h-screen w-full font-body text-ink antialiased relative">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="glass sticky top-0 z-30 border-b border-frostline/50">
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
            <button
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              className="h-9 w-9 rounded-full glass grid place-items-center text-[15px] text-ink shrink-0"
            >
              ☰
            </button>
            <Link to="/" className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-[10px] bg-brand grid place-items-center text-[11px] font-display font-bold text-primary-foreground shadow-[0_6px_16px_-6px_var(--brand)] shrink-0">
                {initials(business.name)}
              </div>
              <div className="leading-tight min-w-0">
                <div className="font-display text-[15px] font-semibold tracking-tight truncate">
                  {business.name}
                </div>
                <div className="text-[10px] text-inkmuted -mt-0.5 truncate">{business.subtitle}</div>
              </div>
            </Link>
          </div>
        </header>

        <main className="px-5 pt-5 pb-32 space-y-5">
          <h1 className="font-display text-[26px] font-bold tracking-tight leading-none">
            {title}
          </h1>
          {children}
        </main>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-5 pt-3 z-30">
          <div className="glass rounded-full border border-frostline/60 shadow-[0_18px_40px_-16px_#0e224455] flex items-center justify-around py-2">
            <BottomItem to="/" label="Dashboard" glyph="■" active={pathname === "/"} />
            <Link
              to="/new"
              aria-label="New voucher"
              className="size-12 -mt-6 rounded-full bg-brand grid place-items-center text-primary-foreground text-[22px] font-light shadow-[0_10px_24px_-8px_var(--brand)]"
            >
              +
            </Link>
            <BottomItem
              to="/vouchers"
              label="Vouchers"
              glyph="☰"
              active={pathname === "/vouchers"}
            />
          </div>
        </div>
      </div>

      {menu && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`drawer fixed top-0 left-0 z-50 h-full w-[272px] transition-transform duration-200 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!menu}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="size-9 rounded-[10px] bg-brand grid place-items-center text-[12px] font-display font-bold text-primary-foreground">
              {initials(business.name)}
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-display text-[15px] font-semibold truncate">{business.name}</div>
              <div className="text-[10px] text-inkmuted truncate">{business.subtitle}</div>
            </div>
          </div>

          <nav className="space-y-1">
            {DRAWER_ITEMS.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenu(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold ${
                    active ? "bg-brand text-primary-foreground" : "text-ink hover:bg-frostline/30"
                  }`}
                >
                  <span className="text-[13px] w-4 text-center">{item.glyph}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={() => void signOut()}
            className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-warn"
          >
            <span className="w-4 text-center">⎋</span>
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}

function BottomItem({
  to,
  label,
  glyph,
  active,
}: {
  to: string;
  label: string;
  glyph: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 ${
        active ? "text-brand" : "text-inkmuted"
      }`}
    >
      <span className="text-[16px]">{glyph}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}
