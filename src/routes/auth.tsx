import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkAccess } from "@/lib/auth.functions";
import { BUSINESS } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — M Sulaim" },
      { name: "description", content: "Sign in to the M Sulaim voucher tracking system." },
      { property: "og:title", content: "Sign in — M Sulaim" },
      {
        property: "og:description",
        content: "Private access. Sign in with your invited email to continue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const checkAccessFn = useServerFn(checkAccess);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Already signed in? Go straight to the board.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/" });
    });
  }, [navigate]);

  const afterSession = async () => {
    try {
      await checkAccessFn();
      router.invalidate();
      await navigate({ to: "/" });
    } catch (err) {
      await supabase.auth.signOut();
      setError(
        (err as Error)?.message ||
          "Access Restricted: You are not authorized to access this system.",
      );
    }
  };

  const submit = async () => {
    setError("");
    setNotice("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) {
          setError(e.message);
          return;
        }
        await afterSession();
      } else {
        const { data, error: e } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (e) {
          setError(e.message);
          return;
        }
        if (data.session) {
          await afterSession();
        } else {
          setNotice("Account created. Check your email to confirm, then sign in.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="appbg min-h-screen w-full font-body text-ink antialiased grid place-items-center px-5 py-10">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="size-14 rounded-2xl bg-brand grid place-items-center font-display text-[18px] font-bold text-primary-foreground shadow-[0_14px_30px_-10px_var(--brand)] mb-3">
            MS
          </div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">{BUSINESS.name}</h1>
          <p className="text-[12px] text-inkmuted -mt-0.5">{BUSINESS.tagline}</p>
        </div>

        <div className="frost rounded-3xl p-5 shadow-[0_24px_50px_-24px_#0e224455]">
          <div className="glass rounded-full p-1 flex mb-4">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                  setNotice("");
                }}
                className={`flex-1 py-2 rounded-full text-[12px] font-semibold ${
                  mode === m ? "bg-brand text-primary-foreground" : "text-inkmuted"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-inkmuted font-semibold mb-1">
                Email
              </div>
              <input
                className="field"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-inkmuted font-semibold mb-1">
                Password
              </div>
              <input
                className="field"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
            </div>
          </div>

          <button
            disabled={busy}
            onClick={() => void submit()}
            className="w-full mt-4 py-3 rounded-2xl bg-brand text-primary-foreground font-display font-semibold shadow-[0_10px_24px_-10px_var(--brand)] disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          {error && <p className="mt-3 text-[12px] text-warn font-semibold">{error}</p>}
          {notice && <p className="mt-3 text-[12px] text-tealdeep font-semibold">{notice}</p>}
        </div>

        <p className="text-center text-[11px] text-inkmuted mt-5">
          {BUSINESS.location} · Private system. Access is by invitation only.
        </p>
      </div>
    </div>
  );
}
