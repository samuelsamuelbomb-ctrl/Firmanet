/**
 * SOSScreen — Emergency alert with hold-to-arm, active state, and code-protected deactivation.
 *
 * Ported from /routes/sos.tsx
 * Full-screen modal, no AppShell, no tabs.
 * Stages: ready → holding → armed → active
 */

import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Siren, MapPin, Users, Radio, X, Check, Lock } from "lucide-react-native";
import { supabase } from "../core/supabase";

type Stage = "ready" | "holding" | "armed" | "active";

export default function SOSScreen() {
  const navigation = useNavigation<any>();
  const [stage, setStage] = useState<Stage>("ready");
  const [hold, setHold] = useState(0);
  const [acks, setAcks] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deact, setDeact] = useState(false);

  // Hold progress timer
  useEffect(() => {
    if (stage !== "holding") return;
    if (hold >= 100) { setStage("armed"); return; }
    const t = setTimeout(() => setHold((h) => h + 4), 60);
    return () => clearTimeout(t);
  }, [stage, hold]);

  // Activate SOS: create session + start acknowledgment counter
  useEffect(() => {
    if (stage === "active") {
      setAcks(0);
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
  }, [stage]);

  // Sync acknowledged count to server
  useEffect(() => {
    if (!sessionId) return;
    void supabase.from("sos_sessions").update({ acknowledged_count: Math.min(acks, 12) }).eq("id", sessionId);
  }, [acks, sessionId]);

  const startHold = () => { setHold(0); setStage("holding"); };
  const cancel = () => { setHold(0); setStage("ready"); };
  const endEmergency = () => { setDeact(true); };

  const confirmDeactivate = () => {
    if (sessionId) {
      void supabase.from("sos_sessions").update({ status: "resolved", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
    navigation.goBack();
  };

  // ─── ACTIVE STATE ───
  if (stage === "active") {
    return (
      <View style={[styles.container, styles.activeBg]}>
        <SafeAreaView style={styles.activeSafe}>
          <View style={styles.activeTop}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>SOS Active</Text>
            </View>
          </View>

          <View style={styles.activeCenter}>
            <View style={styles.sosRing}>
              <View style={styles.sosRingInner} />
              <Siren size={64} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <Text style={styles.activeTitle}>Help is on the way</Text>
            <Text style={styles.activeSub}>
              Location sharing is ON · {Math.min(acks, 12)}/12 circle contacts confirmed.
            </Text>
            <View style={styles.activeRows}>
              <Row icon={<MapPin size={16} color="#FFFFFF" />} text="Live location: streaming" />
              <Row
                icon={acks >= 12 ? <Check size={16} color="#FFFFFF" /> : <Users size={16} color="#FFFFFF" />}
                text={`Circle notified · ${Math.min(acks, 12)} acknowledged`}
              />
              <Row icon={<Radio size={16} color="#FFFFFF" />} text="Nearby Firmanet users · 47 alerted" />
            </View>
          </View>

          <TouchableOpacity style={styles.deactivateBtn} onPress={endEmergency}>
            <Text style={styles.deactivateBtnText}>Deactivate SOS</Text>
          </TouchableOpacity>
        </SafeAreaView>
        {deact && <DeactivateModal onCancel={() => setDeact(false)} onConfirm={confirmDeactivate} />}
      </View>
    );
  }

  // ─── READY / HOLDING / ARMED STATE ───
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <X size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.topLabel}>Emergency</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {stage === "armed" ? "Ready to send" : "Hold to arm SOS"}
          </Text>
          <Text style={styles.heroSub}>
            {stage === "armed"
              ? "Confirm to alert your circle and nearby users."
              : "Press and hold the button for 3 seconds."}
          </Text>
        </View>

        <View style={styles.holdArea}>
          <TouchableOpacity
            onPressIn={startHold}
            onPressOut={() => stage === "holding" && cancel()}
            activeOpacity={1}
            style={styles.holdBtn}
          >
            <View style={styles.holdRingBorder}>
              <View style={[styles.holdRingFill, { width: `${hold}%` }]} />
            </View>
            <View style={styles.holdCenter}>
              <Siren size={56} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.holdLabel}>SOS</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Row icon={<MapPin size={16} color="#2D6A4F" />} text="Live location: ON" />
          <Row icon={<Users size={16} color="#2D6A4F" />} text="12 trusted contacts in your circle" />
          <Row icon={<Radio size={16} color="#2D6A4F" />} text="Nearby Firmanet users will be notified" />
        </View>

        {stage === "armed" ? (
          <View style={styles.armedRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={() => setStage("active")}>
              <Text style={styles.sendText}>Send alert</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.holdHint}>SOS overrides silent mode and quiet hours.</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── HELPERS ───

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.icon}>{icon}</View>
      <Text style={rowStyles.text}>{text}</Text>
    </View>
  );
}

function DeactivateModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [secs, setSecs] = useState(10);
  const [entry, setEntry] = useState("");
  const code = useMemo(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }, []);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const ready = secs === 0;
  const match = entry.trim().toUpperCase() === code;

  return (
    <View style={modalStyles.overlay}>
      <View style={modalStyles.modal}>
        <View style={modalStyles.handle} />
        <View style={modalStyles.headerRow}>
          <View style={modalStyles.lockIcon}><Lock size={16} color="#E63946" /></View>
          <Text style={modalStyles.title}>Confirm deactivation</Text>
        </View>
        <Text style={modalStyles.desc}>
          To prevent accidental shutdown, wait the cooldown and enter the code shown below.
        </Text>

        {!ready ? (
          <View style={modalStyles.cooldown}>
            <Text style={modalStyles.cooldownNum}>{secs}s</Text>
            <Text style={modalStyles.cooldownLabel}>Cooldown in progress</Text>
          </View>
        ) : (
          <>
            <View style={modalStyles.codeBox}>
              <Text style={modalStyles.codeLabel}>Enter this code</Text>
              <Text style={modalStyles.code}>{code}</Text>
            </View>
            <TextInput
              autoFocus
              value={entry}
              onChangeText={(v) => setEntry(v.toUpperCase())}
              maxLength={6}
              placeholder="Type code"
              placeholderTextColor="#9CA3AF"
              style={modalStyles.input}
            />
          </>
        )}

        <View style={modalStyles.btnRow}>
          <TouchableOpacity style={modalStyles.stayBtn} onPress={onCancel}>
            <Text style={modalStyles.stayText}>Stay active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.confirmBtn, (!ready || !match) && modalStyles.confirmDisabled]}
            onPress={onConfirm}
            disabled={!ready || !match}
          >
            <Text style={[modalStyles.confirmText, (!ready || !match) && modalStyles.confirmTextDisabled]}>
              Deactivate
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── STYLES ───

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  text: { fontSize: 13, color: "#1A1A2E" },
});

const modalStyles = StyleSheet.create({
  overlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", zIndex: 80 },
  modal: { backgroundColor: "#F7F8FB", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  lockIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  desc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 16 },
  cooldown: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, alignItems: "center", marginBottom: 16 },
  cooldownNum: { fontSize: 40, fontWeight: "700", fontFamily: "Outfit", color: "#1A1A2E" },
  cooldownLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  codeBox: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, alignItems: "center", marginBottom: 12 },
  codeLabel: { fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  code: { fontSize: 28, fontWeight: "700", fontFamily: "Outfit", letterSpacing: 8, color: "#1A1A2E", marginTop: 8 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 14, fontSize: 20, fontWeight: "700", fontFamily: "Outfit", letterSpacing: 8, textAlign: "center", marginBottom: 16 },
  btnRow: { flexDirection: "row", gap: 8 },
  stayBtn: { flex: 1, backgroundColor: "#E5E7EB", paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  stayText: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  confirmBtn: { flex: 1, backgroundColor: "#E63946", paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  confirmDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  confirmTextDisabled: { color: "#FFFFFF" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FB" },
  safe: { flex: 1, paddingHorizontal: 20, paddingVertical: 16, justifyContent: "space-between" },
  activeBg: { backgroundColor: "#E63946" },
  activeSafe: { flex: 1, paddingHorizontal: 24, paddingVertical: 24, justifyContent: "space-between" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  topLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: "#6B7280" },
  hero: { marginTop: 24 },
  heroTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Outfit", color: "#1A1A2E", lineHeight: 34 },
  heroSub: { fontSize: 14, color: "#6B7280", marginTop: 4, lineHeight: 20 },
  holdArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  holdBtn: {
    width: 224, height: 224, borderRadius: 112,
    backgroundColor: "#E63946", justifyContent: "center", alignItems: "center",
    shadowColor: "#E63946", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
  },
  holdRingBorder: {
    position: "absolute", width: 224, height: 224, borderRadius: 112,
    borderWidth: 6, borderColor: "rgba(255,255,255,0.18)", overflow: "hidden",
  },
  holdRingFill: {
    position: "absolute", top: 0, left: 0, height: "100%",
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 112,
  },
  holdCenter: { alignItems: "center", zIndex: 1 },
  holdLabel: { fontSize: 20, fontWeight: "700", fontFamily: "Outfit", color: "#FFFFFF", marginTop: 8 },
  infoCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, marginBottom: 16 },
  armedRow: { flexDirection: "row", gap: 8 },
  cancelBtn: { flex: 1, backgroundColor: "#E5E7EB", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  cancelText: { fontSize: 15, fontWeight: "600", color: "#1A1A2E" },
  sendBtn: { flex: 1, backgroundColor: "#E63946", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  sendText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  holdHint: { textAlign: "center", fontSize: 12, color: "#9CA3AF", marginBottom: 8 },
  activeTop: { alignSelf: "flex-start" },
  activeBadge: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  activeBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#FFFFFF" },
  activeCenter: { alignItems: "center" },
  sosRing: { width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  sosRingInner: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.15)" },
  activeTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Outfit", color: "#FFFFFF", textAlign: "center" },
  activeSub: { fontSize: 14, color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: 8, maxWidth: 280, lineHeight: 20 },
  activeRows: { marginTop: 24, alignSelf: "stretch" },
  deactivateBtn: { backgroundColor: "#FFFFFF", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  deactivateBtnText: { fontSize: 16, fontWeight: "700", color: "#E63946" },
});