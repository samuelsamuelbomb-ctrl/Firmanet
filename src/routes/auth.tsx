import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Firmanet — Sign in" },
      { name: "description", content: "Sign in to your Firmanet account to access the safety network." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setErr(null);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      setErr(res.error instanceof Error ? res.error.message : String(res.error));
      setBusy(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Link to="/onboarding" className="text-xs font-semibold text-muted-foreground">
            About Firmanet
          </Link>
          <Link to="/" className="text-xs font-semibold text-muted-foreground">
            Skip
          </Link>
        </div>

        <div className="mt-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-mint-foreground shadow-soft">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">
              {mode === "signin" ? "Welcome back" : "Join Firmanet"}
            </h1>
            <p className="text-xs text-muted-foreground">
              A calm safety network for your neighborhood.
            </p>
          </div>
        </div>

        <form onSubmit={handleEmail} className="mt-8 space-y-3">
          {mode === "signup" && (
            <Field
              icon={<Mail className="h-4 w-4" />}
              type="text"
              placeholder="Display name"
              value={name}
              onChange={setName}
            />
          )}
          <Field
            icon={<Mail className="h-4 w-4" />}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={setEmail}
            required
          />
          <Field
            icon={<Lock className="h-4 w-4" />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
            required
          />
          {err && (
            <p className="rounded-2xl bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-1 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98] disabled:opacity-50"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or continue with
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-sm font-semibold shadow-soft active:scale-[0.98] disabled:opacity-50"
        >
          <GoogleG />
          Continue with Google
        </button>

        <button
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          className="mt-8 text-center text-xs text-muted-foreground"
        >
          {mode === "signin" ? (
            <>New to Firmanet? <span className="font-semibold text-foreground">Create an account</span></>
          ) : (
            <>Already have an account? <span className="font-semibold text-foreground">Sign in</span></>
          )}
        </button>

        <p className="mt-auto pt-6 text-center text-[10px] text-muted-foreground">
          By continuing you agree to Firmanet's calm-by-default safety policies.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon, type, placeholder, value, onChange, required,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-primary">
      <span className="text-muted-foreground">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}