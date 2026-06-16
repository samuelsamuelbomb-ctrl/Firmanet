import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { Intensity } from "@/lib/swish-mock";
import { Plus, MapPin, X, Trash2, Search, Check, UserPlus, Inbox } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/circle")({
  head: () => ({
    meta: [
      { title: "Firmanet — Circle" },
      { name: "description", content: "Your trusted Firmanet network: search by @username, accept requests, share SOS." },
    ],
  }),
  component: CirclePage,
});

const TONE: Record<Intensity, { dot: string; chip: string; label: string }> = {
  calm: { dot: "bg-mint", chip: "bg-mint/50 text-mint-foreground", label: "Safe" },
  warn: { dot: "bg-warn", chip: "bg-warn/40 text-warn-foreground", label: "Check in" },
  danger: { dot: "bg-danger", chip: "bg-danger/15 text-danger", label: "SOS" },
};

type Member = {
  id: string;
  name: string;
  role: string;
  location: string;
  status: Intensity;
  last_seen: string;
};

type Request = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  from_username?: string;
  from_name?: string;
};

function CirclePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    setMe(auth.user?.id ?? null);
    if (!auth.user) { setLoading(false); return; }
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from("circle_members").select("id,name,role,location,status,last_seen").order("created_at"),
      supabase.from("circle_requests").select("id,from_user,to_user,status").eq("to_user", auth.user.id).eq("status", "pending"),
    ]);
    setMembers((m as Member[]) ?? []);
    if (r && r.length) {
      const ids = r.map((x) => (x as Request).from_user);
      const { data: profs } = await supabase.from("profiles").select("id,username,display_name").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p as { username: string; display_name: string }]));
      setRequests((r as Request[]).map((x) => ({
        ...x,
        from_username: map.get(x.from_user)?.username,
        from_name: map.get(x.from_user)?.display_name,
      })));
    } else {
      setRequests([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Realtime: refresh on new requests or member changes
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("circle-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_members" }, () => load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [me, load]);

  const remove = async (id: string) => {
    setMembers((m) => m.filter((x) => x.id !== id));
    await supabase.from("circle_members").delete().eq("id", id);
  };

  const accept = async (req: Request) => {
    setRequests((rs) => rs.filter((r) => r.id !== req.id));
    await supabase.rpc("accept_circle_request", { _req_id: req.id });
    load();
  };
  const decline = async (req: Request) => {
    setRequests((rs) => rs.filter((r) => r.id !== req.id));
    await supabase.rpc("decline_circle_request", { _req_id: req.id });
  };

  return (
    <AppShell>
      <TopBar />
      <div className="px-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Your Circle</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} trusted {members.length === 1 ? "contact" : "contacts"}
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
            aria-label="Add member"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {requests.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 flex items-center gap-1.5 px-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Inbox className="h-3.5 w-3.5" /> Incoming requests
            </h2>
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {(r.from_name ?? r.from_username ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-semibold">{r.from_name ?? r.from_username}</div>
                    <div className="truncate text-xs text-muted-foreground">@{r.from_username}</div>
                  </div>
                  <button onClick={() => decline(r)} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">Decline</button>
                  <button onClick={() => accept(r)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Accept</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <h2 className="mt-5 mb-2 px-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Members</h2>
        {loading ? (
          <div className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">Loading your circle…</div>
        ) : !me ? (
          <div className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">Sign in to build your trust network.</div>
        ) : members.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
            No one in your circle yet. Tap + to search a @username and send a request.
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const t = TONE[m.status];
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                  <div className="relative">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${t.dot}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground">· {m.role}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {m.location} · {m.last_seen}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${t.chip}`}>{t.label}</span>
                  <button onClick={() => remove(m.id)} aria-label="Remove" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {open && <AddMemberModal me={me} onClose={() => setOpen(false)} onAdded={load} />}
    </AppShell>
  );
}

type FoundUser = { id: string; username: string; display_name: string | null; avatar_url: string | null };

function AddMemberModal({ me, onClose, onAdded }: { me: string | null; onClose: () => void; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_users", { q: term });
      if (error) { setErr(error.message); return; }
      setResults((data as FoundUser[]) ?? []);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const sendRequest = async (u: FoundUser) => {
    if (!me) { setErr("Sign in first."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase
      .from("circle_requests")
      .insert({ from_user: me, to_user: u.id, status: "pending" });
    setBusy(false);
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      setErr(error.message);
      return;
    }
    setSent((s) => new Set(s).add(u.id));
    onAdded();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[32px] bg-surface p-5 pb-8 shadow-pop animate-in slide-in-from-bottom">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Add to your Circle</h2>
          <button onClick={onClose} className="rounded-full bg-muted p-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search @username or name"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {err && <p className="mt-3 rounded-2xl bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {results.length === 0 && q.trim().length >= 2 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No users match “{q}”.</p>
          )}
          {results.map((u) => {
            const already = sent.has(u.id);
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {(u.display_name ?? u.username).slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold">{u.display_name ?? u.username}</div>
                  <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                </div>
                <button
                  onClick={() => sendRequest(u)}
                  disabled={busy || already}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    already ? "bg-mint/60 text-mint-foreground" : "bg-primary text-primary-foreground"
                  } disabled:opacity-60`}
                >
                  {already ? <><Check className="h-3 w-3" /> Sent</> : <><UserPlus className="h-3 w-3" /> Request</>}
                </button>
              </div>
            );
          })}
          {q.trim().length < 2 && (
            <p className="py-6 text-center text-xs text-muted-foreground">Type at least 2 characters to search.</p>
          )}
        </div>
      </div>
    </div>
  );
}