/**
 * IncidentDetailScreen — Full incident view with verification and timeline.
 *
 * Ported from /routes/incident.$id.tsx
 */

import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { TrustBar } from "../components/shared/TrustBar";
import { useSignals, useSignalsRealtime, signalStore } from "../core/signalStore";
import { trustToIntensity } from "../core/types";
import { ArrowLeft, MapPin, Clock, Users, ShieldCheck, AlertTriangle, CheckCircle2, Camera } from "lucide-react-native";

const STATE_LABEL = (reports: number, trust: number) => {
  if (reports >= 20) return { label: "Verified", color: "#D8F3DC", textColor: "#2D6A4F" };
  if (trust >= 80) return { label: "High confidence", color: "#FEF3C7", textColor: "#F59E0B" };
  if (reports >= 3) return { label: "Emerging", color: "#FFEDD5", textColor: "#FF8C42" };
  return { label: "Unverified", color: "#E5E7EB", textColor: "#6B7280" };
};

export default function IncidentDetailScreen() {
  useSignalsRealtime();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params;
  const signals = useSignals();
  const signal = signals.find((s) => s.id === id);
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!signal) {
    return (
      <AppShell>
        <TopBar />
        <TouchableOpacity onPress={() => navigation.navigate("FeedTab")}>
          <Text style={styles.back}><ArrowLeft size={14} color="#6B7280" /> Back to feed</Text>
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>This incident isn't in your local feed yet.</Text>
        </View>
      </AppShell>
    );
  }

  const state = STATE_LABEL(signal.reports, signal.trust);
  const intensity = trustToIntensity(signal.trust);

  const verify = async () => {
    setVerifying(true);
    setErr(null);
    const r = await signalStore.verify(signal.id);
    setVerifying(false);
    if (!r.ok) setErr(r.error ?? "Couldn't verify");
  };

  return (
    <AppShell>
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.navigate("FeedTab")}>
          <Text style={styles.back}><ArrowLeft size={14} color="#6B7280" /> Back</Text>
        </TouchableOpacity>

        <View style={styles.topRow}>
          <View style={[styles.stateBadge, { backgroundColor: state.color }]}>
            <Text style={[styles.stateText, { color: state.textColor }]}>{state.label}</Text>
          </View>
          <Text style={styles.typeText}>{signal.type}</Text>
        </View>

        <Text style={styles.title}>{signal.title}</Text>
        {signal.description && <Text style={styles.desc}>{signal.description}</Text>}

        <View style={styles.statsGrid}>
          <Stat icon={<MapPin size={14} color="#6B7280" />} label="Distance" value={`${signal.distanceKm.toFixed(1)} km`} />
          <Stat icon={<Clock size={14} color="#6B7280" />} label="Reported" value={`${signal.minutesAgo}m ago`} />
          <Stat icon={<Users size={14} color="#6B7280" />} label="Reports" value={String(signal.reports)} />
        </View>

        {/* Verification */}
        <View style={styles.verifyCard}>
          <View style={styles.verifyHeader}>
            <ShieldCheck size={16} color="#2D6A4F" />
            <Text style={styles.verifyTitle}>Verification</Text>
          </View>
          <Text style={styles.verifyDesc}>
            Confidence rises as more neighbors confirm. {signal.reports} of 20 needed for verified status.
          </Text>
          <TrustBar value={signal.trust} />
          <TouchableOpacity style={styles.verifyBtn} onPress={verify} disabled={verifying}>
            <Text style={styles.verifyBtnText}>
              {verifying ? "Confirming…" : "I can confirm this"}
            </Text>
          </TouchableOpacity>
          {err && <Text style={styles.errorText}>{err}</Text>}
        </View>

        {/* Media */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Camera size={16} color="#6B7280" />
            <Text style={styles.cardTitle}>Media</Text>
          </View>
          <Text style={styles.cardBody}>
            {signal.media > 0 ? `${signal.media} photo/video attachments.` : "No media attached yet."}
          </Text>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <TimelineItem icon={<AlertTriangle size={14} color="#6B7280" />} text="Initial report submitted" time={`${signal.minutesAgo}m ago`} />
            {signal.reports >= 3 && (
              <TimelineItem icon={<Users size={14} color="#6B7280" />} text={`${signal.reports - 1} corroborating reports`} time="now" />
            )}
            {signal.reports >= 20 && (
              <TimelineItem icon={<CheckCircle2 size={14} color="#2D6A4F" />} text="Reached verified status" time="now" />
            )}
          </View>
        </View>

        {/* Status buttons */}
        <View style={styles.statusRow}>
          {["Still active", "Resolved", "False alarm"].map((c) => (
            <TouchableOpacity key={c} style={styles.statusBtn}>
              <Text style={styles.statusBtnText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.intensityLabel}>Intensity · {intensity}</Text>
      </ScrollView>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHeader}>
        {icon}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function TimelineItem({ icon, text, time }: { icon: React.ReactNode; text: string; time: string }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIcon}>{icon}</View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineText}>{text}</Text>
        <Text style={styles.timelineTime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { fontSize: 13, color: "#6B7280", marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 4 },
  notFound: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 32, alignItems: "center" },
  notFoundText: { fontSize: 13, color: "#6B7280", textAlign: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  stateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stateText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  typeText: { fontSize: 11, color: "#6B7280", textTransform: "capitalize" },
  title: { fontSize: 24, fontWeight: "700", fontFamily: "Outfit", color: "#1A1A2E", lineHeight: 30 },
  desc: { fontSize: 13, color: "#6B7280", marginTop: 8, lineHeight: 18 },
  statsGrid: { flexDirection: "row", gap: 8, marginTop: 16 },
  stat: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E", marginTop: 4 },
  verifyCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, marginTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  verifyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  verifyTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  verifyDesc: { fontSize: 11, color: "#6B7280", lineHeight: 16, marginBottom: 12 },
  verifyBtn: { backgroundColor: "#2D6A4F", paddingVertical: 14, borderRadius: 16, alignItems: "center", marginTop: 12 },
  verifyBtnText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  errorText: { textAlign: "center", fontSize: 11, color: "#E63946", marginTop: 8 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16, marginTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  cardBody: { fontSize: 12, color: "#6B7280" },
  timeline: { marginTop: 12, gap: 12 },
  timelineItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  timelineIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  timelineContent: { flex: 1 },
  timelineText: { fontSize: 13, color: "#1A1A2E" },
  timelineTime: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  statusBtn: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  statusBtnText: { fontSize: 12, fontWeight: "600", color: "#1A1A2E" },
  intensityLabel: { textAlign: "center", fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 24 },
});