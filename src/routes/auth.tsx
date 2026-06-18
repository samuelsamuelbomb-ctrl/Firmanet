import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Shield, Mail, Lock, ArrowRight, User, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { lightTap, mediumTap } from "@/core/haptics";

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
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus(null);
      setUsernameMessage(null);
      return;
    }
    setUsernameStatus("checking");
    setUsernameMessage("Checking...");
    timerRef.current = setTimeout(async () => {
      const { count } = await (supabase as any)
        .from("profiles")
        .select("username", { count: "exact", head: true })
        .ilike("username", trimmed);
      if (count && count > 0) {
        setUsernameStatus("taken");
        setUsernameMessage("Username is already taken");
      } else {
        setUsernameStatus("available");
        setUsernameMessage("Username is available");
      }
    }, 400);
  };

  const handleUsernameChange = (v: string) => {
    setUsername(v);
    checkUsername(v);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "signup") {
        if (!username.trim()) {
          throw new Error("Please choose a username");
        }
        if (usernameStatus === "taken") {
          throw new Error("That username is already taken");
        }
        if (usernameStatus === "checking") {
          throw new Error("Please wait while we check if the username is available");
        }
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name, username },
          },
        });
        if (error) throw error;
        // If no session, email confirmation is required
        if (!data.session) {
          setConfirming(true);
          return;
        }
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

  // Confirmation message screen
  if (confirming) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-mint text-mint-foreground shadow-soft mb-6">
            <CheckCircle className="h-12 w-12" />
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight mb-3">Check your email</h1>
          <p className="text-sm text-muted-foreground text-center leading-relaxed mb-8">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground">{email}</span>.<br /><br />
            Click the link to verify your account, then sign in.
          </p>
          <button
            onClick={() => {
              lightTap();
              setConfirming(false);
              setMode("signin");
              setPassword("");
            }}
            className="flex items-center justify-center gap-1 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98]"
          >
            Go to sign in
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Link to="/onboarding" onClick={() => lightTap()} className="text-xs font-semibold text-muted-foreground">
            About Firmanet
          </Link>
          <Link to="/" onClick={() => lightTap()} className="text-xs font-semibold text-muted-foreground">
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

        <form onSubmit={(e) => { mediumTap(); handleEmail(e); }} className="mt-8 space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <Field
                  icon={<User className="h-4 w-4" />}
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={handleUsernameChange}
                  required
                />
                {usernameMessage && (
                  <p className={`mt-1 text-xs ${
                    usernameStatus === "available" ? "text-green-600" :
                    usernameStatus === "taken" ? "text-red-500" :
                    "text-muted-foreground"
                  }`}>
                    {usernameMessage}
                  </p>
                )}
              </div>
              <Field
                icon={<Mail className="h-4 w-4" />}
                type="text"
                placeholder="Display name (optional)"
                value={name}
                onChange={setName}
              />
            </>
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
          onClick={(e) => { lightTap(); handleGoogle(); }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-sm font-semibold shadow-soft active:scale-[0.98] disabled:opacity-50"
        >
          <GoogleG />
          Continue with Google
        </button>

        <button
          onClick={() => { lightTap(); setMode((m) => (m === "signin" ? "signup" : "signin")); setErr(null); }}
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