import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, MapPin, Shield, Save, BellRing } from "lucide-react";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { TrustBar } from "@/components/swish/TrustBar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Firmanet — Profile" },
      { name: "description", content: "Your Firmanet profile, trust score and circle settings." },
    ],
  }),
  component: Profile,
});

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  trust_score: number;
}

function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setEmail(auth.user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
      if (data) {
        setProfile(data as ProfileRow);
        setName(data.display_name ?? "");
        setLocation(data.location ?? "Ikeja, Lagos");
      }
    })();
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, location })
      .eq("id", profile.id);
    setSaving(false);
    setMsg(error ? error.message : "Saved");
    setTimeout(() => setMsg(null), 2500);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const initials = (name || email || "U").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <TopBar />
      <div className="px-4">
        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-soft">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-semibold leading-tight">
                {name || "Set your name"}
              </h1>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-mint/60 px-2 py-0.5 text-[10px] font-bold text-mint-foreground">
                <Shield className="h-3 w-3" /> Verified member
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Personal trust score</span>
              <span>Reflects your verified contributions</span>
            </div>
            <TrustBar value={profile?.trust_score ?? 50} />
          </div>
        </div>

        <section className="mt-4 space-y-3 rounded-3xl bg-card p-4 shadow-soft">
          <Row label="Display name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-right text-sm outline-none"
            />
          </Row>
          <Row label="Home area" icon={<MapPin className="h-3.5 w-3.5" />}>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-right text-sm outline-none"
            />
          </Row>
          <Row label="Email">
            <span className="text-sm text-muted-foreground">{email}</span>
          </Row>

          <button
            onClick={save}
            disabled={saving}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </button>
          {msg && <p className="text-center text-xs text-muted-foreground">{msg}</p>}
        </section>

        <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <button
            onClick={() => navigate({ to: "/notifications" })}
            className="flex w-full items-center justify-between text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-4 w-4" /> Notifications
            </span>
            <span className="text-xs text-muted-foreground">Manage →</span>
          </button>
        </section>

        <button
          onClick={signOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-semibold text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Row({
  label, icon, children,
}: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon} {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}