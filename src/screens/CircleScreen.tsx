/**
 * CircleScreen — Trusted contacts list with add/remove/requests.
 *
 * Ported from /routes/circle.tsx
 * Uses: supabase.circle_members, circle_requests, RPCs
 */

import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Modal, ActivityIndicator,
} from "react-native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { supabase } from "../core/supabase";
import { Plus, MapPin, X, Trash2, Search, Check, UserPlus, Inbox } from "lucide-react-native";
import type { Intensity } from "../core/types";

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

const TONE: Record<Intensity, { dot: string; label: string }> = {
  calm:   { dot: "#2D6A4F", label: "Safe" },
  warn:   { dot: "#F59E0B", label: "Check in" },
  danger: { dot: "#E63946", label: "SOS" },
};

export default function CircleScreen() {
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

  // Realtime refresh
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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Circle</Text>
          <Text style={styles.sub}>{members.length} trusted {members.length === 1 ? "contact" : "contacts"}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setOpen(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={requests.length > 0 ? ["_requests", ...members] : members}
        keyExtractor={(item, idx) => (typeof item === "string" ? "requests" : item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          requests.length > 0 ? (
            <View style={styles.requestsSection}>
              <Text style={styles.sectionTitle}>
                <Inbox size={14} color="#6B7280" /> Incoming requests
              </Text>
              {requests.map((r) => (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(r.from_name ?? r.from_username ?? "?").slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{r.from_name ?? r.from_username}</Text>
                    <Text style={styles.requestUser}>@{r.from_username}</Text>
                  </View>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => decline(r)}>
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => accept(r)}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (typeof item === "string") return null;
          const m = item as Member;
          const t = TONE[m.status];
          return (
            <View style={styles.memberCard}>
              <View style={styles.memberLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{m.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: t.dot }]} />
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberRole}> · {m.role}</Text>
                </View>
                <View style={styles.memberMeta}>
                  <MapPin size={10} color="#6B7280" />
                  <Text style={styles.memberMetaText}>{m.location} · {m.last_seen}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: t.dot + "20" }]}>
                <Text style={[styles.statusText, { color: t.dot }]}>{t.label}</Text>
              </View>
              <TouchableOpacity onPress={() => remove(m.id)} style={styles.removeBtn}>
                <Trash2 size={14} color="#6B7280" />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCard}><ActivityIndicator color="#2D6A4F" /></View>
          ) : !me ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>Sign in to build your trust network.</Text></View>
          ) : (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>No one in your circle yet. Tap + to add.</Text></View>
          )
        }
      />
      {open && <AddMemberModal me={me} onClose={() => setOpen(false)} onAdded={load} />}
    </AppShell>
  );
}

function AddMemberModal({ me, onClose, onAdded }: { me: string | null; onClose: () => void; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_users", { q: term });
      if (error) { setErr(error.message); return; }
      setResults((data as any[]) ?? []);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const sendRequest = async (u: any) => {
    if (!me) { setErr("Sign in first."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from("circle_requests").insert({ from_user: me, to_user: u.id, status: "pending" });
    setBusy(false);
    if (error && !error.message.toLowerCase().includes("duplicate")) { setErr(error.message); return; }
    setSent((s) => new Set(s).add(u.id));
    onAdded();
  };

  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to your Circle</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color="#1A1A2E" /></TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <Search size={16} color="#6B7280" />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search @username or name"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>
          {err && <View style={styles.errorBox}><Text style={styles.errorText}>{err}</Text></View>}
          <FlatList
            data={results}
            keyExtractor={(u) => u.id}
            renderItem={({ item: u }) => {
              const already = sent.has(u.id);
              return (
                <View style={styles.userRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{(u.display_name ?? u.username).slice(0, 1).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{u.display_name ?? u.username}</Text>
                    <Text style={styles.requestUser}>@{u.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.requestBtn, already && styles.requestBtnSent]}
                    onPress={() => sendRequest(u)}
                    disabled={busy || already}
                  >
                    <Text style={[styles.requestBtnText, already && styles.requestBtnTextSent]}>
                      {already ? "Sent" : "Request"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              q.trim().length >= 2 ? (
                <Text style={styles.noResults}>No users match "{q}".</Text>
              ) : (
                <Text style={styles.hint}>Type at least 2 characters to search.</Text>
              )
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  sub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2D6A4F", justifyContent: "center", alignItems: "center" },
  list: { gap: 8, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#6B7280", marginBottom: 8 },
  requestsSection: { marginBottom: 16 },
  requestCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FFFFFF", padding: 12, borderRadius: 16, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#2D6A4F",
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 13, fontWeight: "600", color: "#1A1A2E" },
  requestUser: { fontSize: 11, color: "#6B7280" },
  declineBtn: { backgroundColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  declineText: { fontSize: 11, fontWeight: "600", color: "#1A1A2E" },
  acceptBtn: { backgroundColor: "#2D6A4F", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  acceptText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FFFFFF", padding: 12, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  memberLeft: { position: "relative" },
  statusDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF" },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center" },
  memberName: { fontSize: 13, fontWeight: "600", color: "#1A1A2E" },
  memberRole: { fontSize: 11, color: "#6B7280" },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  memberMetaText: { fontSize: 10, color: "#6B7280" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: "600" },
  removeBtn: { padding: 6 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 32, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#6B7280", textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
  modal: {
    backgroundColor: "#F7F8FB", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 20, paddingBottom: 36, maxHeight: "80%",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1A1A2E" },
  errorBox: { backgroundColor: "rgba(230,57,70,0.1)", padding: 10, borderRadius: 12, marginBottom: 8 },
  errorText: { fontSize: 11, color: "#E63946" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", padding: 12, borderRadius: 12, marginBottom: 4 },
  requestBtn: { backgroundColor: "#2D6A4F", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  requestBtnSent: { backgroundColor: "#D8F3DC" },
  requestBtnText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  requestBtnTextSent: { color: "#2D6A4F" },
  noResults: { textAlign: "center", fontSize: 12, color: "#6B7280", paddingVertical: 24 },
  hint: { textAlign: "center", fontSize: 12, color: "#9CA3AF", paddingVertical: 24 },
});