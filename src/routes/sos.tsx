import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Siren, MapPin, Users, Radio, X, Check, Lock, Phone, Share2 } from "lucide-react";
import { play, stopSos } from "@/lib/swish-sound";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sos")({
  head: () => ({
    meta: [
      { title: "Firmanet — SOS" },
      { name: "description", content: "Activate an emergency alert to your trusted circle and nearby Firmanet users." },
    ],
  }),
  component: SosPage,
});

function SosPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"ready" | "holding" | "armed" | "active">("ready");
  const [hold, setHold] = useState(0);
  const [acks, setAcks] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deact, setDeact] = useState(false);

  useEffect(() => {
    if (stage !== "holding") return;
    if (hold >= 100) {
      setStage("armed");
      return;
    }
    const t = setTimeout(() => setHold((h) => h + 4), 60);
    return () => clearTimeout(t);
  }, [stage, hold]);

  useEffect(() => {
    if (stage === "armed") play("danger");
    if (stage === "active") {
      play("sos");
      setAcks(0);
      // Persist SOS session server-side (best-effort; works only when signed in)
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data } = await supabase
          .from("sos_sessions")
          .insert({ user_id: auth.user.id, status: "active", location: "Ikeja, Lagos" })
          .select()
          .single();
        if (data) setSessionId(data.id as string);
      })();
      const t = setInterval(
        () => setAcks((n) => (n >= 12 ? n : n + 1 + Math.floor(Math.random() * 2))),
        700,
      );
      return () => clearInterval(t);
    }
    return () => {};
  }, [stage]);

  useEffect(() => () => stopSos(), []);

  // Sync acknowledged count to the server while active
  useEffect(() => {
    if (!sessionId) return;
    void supabase.from("sos_sessions").update({ acknowledged_count: Math.min(acks, 12) }).eq("id", sessionId);
  }, [acks, sessionId]);

  const startHold = () => {
    setHold(0);
    setStage("holding");
  };
  const cancel = () => {
    setHold(0);
    setStage("ready");
    stopSos();
  };
  const endEmergency = () => {
    setDeact(true);
  };

  const confirmDeactivate = () => {
    stopSos();
    if (sessionId) {
      void supabase
        .from("sos_sessions")
        .update({ status: "resolved", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    navigate({ to: "/" });
  };

  if (stage === "active") {
    return (
      <div className="min-h-screen bg-danger text-danger-foreground">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-between px-6 py-10">
          <div className="self-start">
            <span className="rounded-full bg-danger-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              SOS Active
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-danger-foreground/20 animate-soft-ping" />
              <span className="absolute inset-4 rounded-full bg-danger-foreground/15 animate-soft-ping [animation-delay:0.6s]" />
              <Siren className="relative h-16 w-16" strokeWidth={2.4} />
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold">Help is on the way</h1>
            <p className="mt-2 max-w-xs text-sm opacity-90">
              Location sharing is ON · {Math.min(acks, 12)}/12 circle contacts confirmed.
            </p>

            <div className="mt-6 w-full space-y-2 text-left text-sm">
              <Row icon={<MapPin className="h-4 w-4" />} text="Live location: streaming" />
              <Row
                icon={acks >= 12 ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                text={`Circle notified · ${Math.min(acks, 12)} acknowledged`}
              />
              <Row icon={<Radio className="h-4 w-4" />} text="Nearby Firmanet users · 47 alerted" />
            </div>
          </div>

          <button
            onClick={endEmergency}
            className="w-full rounded-2xl bg-danger-foreground py-4 font-bold text-danger shadow-pop"
          >
            Deactivate SOS
          </button>
        </div>
        {deact && (
          <DeactivateModal onCancel={() => setDeact(false)} onConfirm={confirmDeactivate} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ to: "/" })}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-soft"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Emergency
          </span>
          <span className="w-10" />
        </div>

        <div className="mt-6">
          <h1 className="font-display text-3xl font-bold leading-tight">
            {stage === "armed" ? "Ready to send" : "Hold to arm SOS"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stage === "armed"
              ? "Confirm to alert your circle and nearby users."
              : "Press and hold the button for 3 seconds."}
          </p>
        </div>

        <div className="my-10 flex flex-1 items-center justify-center">
          <button
            onPointerDown={startHold}
            onPointerUp={() => stage === "holding" && cancel()}
            onPointerLeave={() => stage === "holding" && cancel()}
            className="relative flex h-56 w-56 items-center justify-center rounded-full bg-danger text-danger-foreground shadow-danger active:scale-95"
          >
            <span className="absolute inset-0 rounded-full bg-danger/40 animate-soft-ping" />
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 224 224">
              <circle cx="112" cy="112" r="108" stroke="oklch(1 0 0 / 0.18)" strokeWidth="6" fill="none" />
              <circle
                cx="112"
                cy="112"
                r="108"
                stroke="oklch(1 0 0 / 0.95)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(hold / 100) * 678} 678`}
                style={{ transition: "stroke-dasharray 60ms linear" }}
              />
            </svg>
            <div className="relative text-center">
              <Siren className="mx-auto h-14 w-14" strokeWidth={2.4} />
              <div className="mt-2 font-display text-xl font-bold">SOS</div>
            </div>
          </button>
        </div>

        <div className="space-y-2 rounded-3xl bg-card p-4 shadow-soft">
          <Row icon={<MapPin className="h-4 w-4 text-mint-foreground" />} text="Live location: ON" />
          <Row icon={<Users className="h-4 w-4 text-mint-foreground" />} text="12 trusted contacts in your circle" />
          <Row icon={<Radio className="h-4 w-4 text-mint-foreground" />} text="Nearby Firmanet users will be notified" />
        </div>

        {stage === "armed" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={cancel}
              className="rounded-2xl bg-muted py-4 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => setStage("active")}
              className="rounded-2xl bg-danger py-4 font-bold text-danger-foreground shadow-pop"
            >
              Send alert
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            SOS overrides silent mode and quiet hours.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function DeactivateModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [secs, setSecs] = useState(10);
  const code = useMemo(genCode, []);
  const [entry, setEntry] = useState("");

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const ready = secs === 0;
  const match = entry.trim().toUpperCase() === code;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[32px] bg-surface p-6 pb-8 text-foreground shadow-pop animate-in slide-in-from-bottom">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger">
            <Lock className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg font-semibold">Confirm deactivation</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          To prevent accidental shutdown, wait the cooldown and enter the code shown below.
        </p>

        {!ready ? (
          <div className="mt-6 rounded-3xl bg-card p-6 text-center shadow-soft">
            <div className="font-display text-4xl font-bold tabular-nums">{secs}s</div>
            <p className="mt-1 text-xs text-muted-foreground">Cooldown in progress</p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-3xl bg-card p-5 text-center shadow-soft">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Enter this code</p>
              <div className="mt-2 font-display text-3xl font-bold tracking-[0.4em]">{code}</div>
            </div>
            <input
              autoFocus
              value={entry}
              onChange={(e) => setEntry(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Type code"
              className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-center font-display text-xl tracking-[0.4em] outline-none focus:border-primary"
            />
          </>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="rounded-2xl bg-muted py-3.5 text-sm font-semibold">
            Stay active
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready || !match}
            className="rounded-2xl bg-danger py-3.5 text-sm font-bold text-danger-foreground shadow-pop disabled:opacity-40"
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}