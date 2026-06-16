import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCheck, AlertTriangle, ShieldCheck, Siren } from "lucide-react";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Firmanet — Notifications" },
      { name: "description", content: "Verified alerts, circle pings and system updates." },
    ],
  }),
  component: NotificationsPage,
});

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  data?: { signal_id?: string; sos_id?: string; request_id?: string; from_user?: string } | null;
}

const ICON: Record<string, { Icon: typeof Bell; chip: string }> = {
  alert:    { Icon: Siren,         chip: "bg-danger/15 text-danger" },
  verified: { Icon: ShieldCheck,   chip: "bg-mint/60 text-mint-foreground" },
  circle_request:  { Icon: AlertTriangle, chip: "bg-warn/50 text-warn-foreground" },
  circle_accepted: { Icon: ShieldCheck,   chip: "bg-mint/60 text-mint-foreground" },
  sos:      { Icon: Siren,         chip: "bg-danger/15 text-danger" },
  system:   { Icon: Bell,          chip: "bg-muted text-muted-foreground" },
  info:     { Icon: Bell,          chip: "bg-muted text-muted-foreground" },
};

function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      setItems((data ?? []) as Notif[]);
      setLoading(false);
      if (!uid) return;
      const ch = supabase
        .channel("notif-stream")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          (payload) => setItems((arr) => [payload.new as Notif, ...arr]))
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          (payload) => {
            const n = payload.new as Notif;
            setItems((arr) => arr.map((x) => (x.id === n.id ? n : x)));
          })
        .subscribe();
      cleanup = () => { void supabase.removeChannel(ch); };
    })();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  const markAll = async () => {
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", auth.user.id).eq("read", false);
  };

  const open = async (n: Notif) => {
    if (!n.read) {
      setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    const d = n.data ?? {};
    if (d.signal_id) { navigate({ to: "/incident/$id", params: { id: d.signal_id } }); return; }
    if (d.request_id || n.kind === "circle_request" || n.kind === "circle_accepted") {
      navigate({ to: "/circle" }); return;
    }
    if (d.sos_id || n.kind === "sos") { navigate({ to: "/map" }); return; }
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <AppShell>
      <TopBar />
      <div className="px-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unread > 0 ? `${unread} new alert${unread > 1 ? "s" : ""}` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && items.length === 0 && (
            <div className="rounded-3xl bg-card p-8 text-center shadow-soft">
              <BellOff className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No notifications yet.</p>
            </div>
          )}
          {items.map((n) => {
            const meta = ICON[n.kind] ?? ICON.info;
            return (
              <article
                key={n.id}
                onClick={() => open(n)}
                className={`flex cursor-pointer gap-3 rounded-3xl p-4 shadow-soft transition-colors active:scale-[0.99] ${
                  n.read ? "bg-card" : "bg-surface ring-1 ring-primary/20"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.chip}`}>
                  <meta.Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-tight">{n.title}</h3>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-danger" />}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}