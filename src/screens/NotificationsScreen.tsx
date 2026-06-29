/**
 * NotificationsScreen — Notification list with real-time updates.
 *
 * Ported from /_authenticated/notifications.tsx
 * Protected screen: requires auth
 *
 * FIXED: Navigation now uses getParent() to reach the RootStack
 *        which has MainStack/MainTabs defined.
 */

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { supabase } from "../core/supabase";
import { Bell, BellOff, CheckCheck, ShieldCheck, AlertTriangle, Siren } from "lucide-react-native";
import { lightTap, softTap } from "../core/haptics";

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  data?: { signal_id?: string; sos_id?: string; request_id?: string; from_user?: string } | null;
}

const ICON: Record<string, { Icon: typeof Bell; color: string; bg: string }> = {
  alert:          { Icon: Siren,       color: "#E63946", bg: "#FEE2E2" },
  verified:       { Icon: ShieldCheck, color: "#2D6A4F", bg: "#D8F3DC" },
  circle_request: { Icon: AlertTriangle, color: "#F59E0B", bg: "#FEF3C7" },
  circle_accepted:{ Icon: ShieldCheck, color: "#2D6A4F", bg: "#D8F3DC" },
  sos:            { Icon: Siren,       color: "#E63946", bg: "#FEE2E2" },
  system:         { Icon: Bell,        color: "#6B7280", bg: "#E5E7EB" },
  info:           { Icon: Bell,        color: "#6B7280", bg: "#E5E7EB" },
};

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  // Get the root navigator for navigating to MainStack/MainTabs
  const rootNav = navigation.getParent();

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
    await (supabase.from("notifications") as any).update({ read: true }).eq("user_id", auth.user.id).eq("read", false);
  };

  const open = async (n: Notif) => {
    if (!n.read) {
      setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void (supabase.from("notifications") as any).update({ read: true }).eq("id", n.id);
    }
    lightTap();
    const d = n.data ?? {};
    if (d.signal_id) {
      // Navigate to IncidentDetail in MainStack
      if (rootNav) {
        rootNav.navigate("MainStack", { screen: "IncidentDetail", params: { id: d.signal_id } });
      } else {
        navigation.navigate("IncidentDetail", { id: d.signal_id });
      }
      return;
    }
    if (d.request_id || n.kind === "circle_request" || n.kind === "circle_accepted") {
      // Navigate to Circle tab in MainTabs
      if (rootNav) {
        rootNav.navigate("MainTabs", { screen: "CircleTab" });
      } else {
        navigation.navigate("CircleTab");
      }
      return;
    }
    if (d.sos_id || n.kind === "sos") {
      // Navigate to Map tab in MainTabs
      if (rootNav) {
        rootNav.navigate("MainTabs", { screen: "MapTab" });
      } else {
        navigation.navigate("MapTab");
      }
      return;
    }
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <AppShell>
      <TopBar hideBell hideProfile={false} />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.sub}>
            {unread > 0 ? `${unread} new alert${unread > 1 ? "s" : ""}` : "All caught up"}
          </Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity style={styles.markBtn} onPress={() => { softTap(); markAll(); }}>
            <CheckCheck size={14} color="#1A1A2E" />
            <Text style={styles.markText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: n }) => {
          const meta = ICON[n.kind] ?? ICON.info;
          const Icon = meta.Icon;
          return (
            <TouchableOpacity
              style={[styles.notifCard, !n.read && styles.notifUnread]}
              onPress={() => open(n)}
              activeOpacity={0.7}
            >
              <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
                <Icon size={18} color={meta.color} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                </View>
                {n.body && <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>}
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : (
            <View style={styles.emptyCard}>
              <BellOff size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          )
        }
      />
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

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  sub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  markBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  markText: { fontSize: 11, fontWeight: "600", color: "#1A1A2E" },
  list: { gap: 8, paddingBottom: 40 },
  notifCard: {
    flexDirection: "row", gap: 12, backgroundColor: "#FFFFFF", padding: 16, borderRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  notifUnread: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "rgba(45, 106, 79, 0.2)" },
  notifIcon: { width: 40, height: 40, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  notifTitle: { fontSize: 13, fontWeight: "600", color: "#1A1A2E", flex: 1 },
  notifTime: { fontSize: 10, color: "#6B7280" },
  notifBody: { fontSize: 11, color: "#6B7280", marginTop: 4, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E63946", marginTop: 4 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 13, color: "#6B7280", textAlign: "center" },
});