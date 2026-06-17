/**
 * ProfileScreen — Edit name/location, trust score, sign out.
 *
 * Ported from /_authenticated/profile.tsx
 * Protected screen: requires auth
 */

import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { TrustBar } from "../components/shared/TrustBar";
import { supabase } from "../core/supabase";
import { useAuth } from "../context/AuthContext";
import { deleteFcmToken, removeTokenFromSupabase } from "../services/notifications";
import { LogOut, MapPin, Shield, Save, BellRing } from "lucide-react-native";
import { lightTap, mediumTap, successNotify } from "../core/haptics";

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  trust_score: number;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
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
    const { error } = await supabase.from("profiles").update({ display_name: name, location }).eq("id", profile.id);
    setSaving(false);
    setMsg(error ? error.message : "Saved");
    setTimeout(() => setMsg(null), 2500);
  };

  const handleSignOut = async () => {
    // Clean up FCM token before signing out
    await Promise.allSettled([
      deleteFcmToken(),
      removeTokenFromSupabase(),
    ]);
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: "AuthFlow" as any }] });
  };

  const initials = (name || email || "U").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{name || "Set your name"}</Text>
              <Text style={styles.headerEmail}>{email}</Text>
              <View style={styles.verifiedBadge}>
                <Shield size={12} color="#2D6A4F" />
                <Text style={styles.verifiedText}>Verified member</Text>
              </View>
            </View>
          </View>
          <View style={styles.trustSection}>
            <View style={styles.trustHeader}>
              <Text style={styles.trustLabel}>Personal trust score</Text>
              <Text style={styles.trustDesc}>Reflects your verified contributions</Text>
            </View>
            <TrustBar value={profile?.trust_score ?? 50} />
          </View>
        </View>

        {/* Edit fields */}
        <View style={styles.card}>
          <Row label="Display name">
            <TextInput value={name} onChangeText={setName} style={styles.input} />
          </Row>
          <Row label="Home area" icon={<MapPin size={14} color="#6B7280" />}>
            <TextInput value={location} onChangeText={setLocation} style={styles.input} />
          </Row>
          <Row label="Email">
            <Text style={styles.emailText}>{email}</Text>
          </Row>
          <TouchableOpacity style={styles.saveBtn} onPress={() => { mediumTap(); save(); }} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save size={16} color="#FFFFFF" />
                <Text style={styles.saveText}>Save changes</Text>
              </>
            )}
          </TouchableOpacity>
          {msg && <Text style={styles.msg}>{msg}</Text>}
        </View>

        {/* Notifications link */}
        <TouchableOpacity
          style={styles.navCard}
          onPress={() => navigation.navigate("Notifications")}
        >
          <BellRing size={16} color="#1A1A2E" />
          <Text style={styles.navText}>Notifications</Text>
          <Text style={styles.navArrow}>Manage →</Text>
        </TouchableOpacity>

        {/* Sign out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={() => { lightTap(); handleSignOut(); }}>
          <LogOut size={16} color="#1A1A2E" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppShell>
  );
}

function Row({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        {icon}
        <Text style={styles.rowLabelText}>{label}</Text>
      </View>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 12 },
  headerRow: { flexDirection: "row", gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#2D6A4F", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  headerEmail: { fontSize: 12, color: "#6B7280" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D8F3DC", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: "flex-start", marginTop: 4 },
  verifiedText: { fontSize: 10, fontWeight: "700", color: "#2D6A4F" },
  trustSection: { marginTop: 16 },
  trustHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  trustLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  trustDesc: { fontSize: 10, color: "#9CA3AF" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowLabelText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  rowValue: { flex: 1, alignItems: "flex-end" },
  input: { textAlign: "right", fontSize: 13, color: "#1A1A2E", paddingVertical: 4, minWidth: 120 },
  emailText: { fontSize: 13, color: "#6B7280" },
  saveBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#2D6A4F", paddingVertical: 14, borderRadius: 16, marginTop: 12 },
  saveText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  msg: { textAlign: "center", fontSize: 11, color: "#6B7280", marginTop: 8 },
  navCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", padding: 16, borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, marginBottom: 12 },
  navText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#1A1A2E" },
  navArrow: { fontSize: 11, color: "#6B7280" },
  signOutBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#E5E7EB", paddingVertical: 14, borderRadius: 16, marginBottom: 24 },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
});