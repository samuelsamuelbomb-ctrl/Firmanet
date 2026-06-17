/**
 * FeedScreen — Signal feed with filtered tabs and create report.
 *
 * Ported from /routes/feed.tsx
 * Uses: signalStore, clusterSignals, sponsors
 */

import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  Modal, TextInput,
} from "react-native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { SignalCard } from "../components/shared/SignalCard";
import { ClusterCard } from "../components/shared/ClusterCard";
import { useSignals, useSignalsRealtime, signalStore } from "../core/signalStore";
import { clusterSignals, isCluster } from "../core/signalCluster";
import { SponsorSeparator } from "../components/shared/SponsorCard";
import {
  Plus, X, ChevronLeft, ChevronRight, MapPin, Camera,
  ShieldAlert, Flame, Droplets, Car, UserSearch, HelpCircle, Loader2,
} from "lucide-react-native";
import type { Signal, SignalCluster, SignalCategory, SignalType } from "../core/types";
import { lightTap, mediumTap, successNotify } from "../core/haptics";

const TABS = ["For You", "Near You", "Verified", "Alerts"] as const;
type Tab = (typeof TABS)[number];

export default function FeedScreen() {
  const [tab, setTab] = useState<Tab>("For You");
  const [open, setOpen] = useState(false);
  const signals = useSignals();
  useSignalsRealtime();

  const filtered = signals.filter((s) => {
    if (tab === "Verified") return s.type === "verified";
    if (tab === "Alerts") return s.trust >= 70;
    if (tab === "Near You") return s.distanceKm <= 2;
    return true;
  });
  const grouped = clusterSignals(filtered);

  const renderItem = ({ item, index }: { item: Signal | SignalCluster; index: number }) => {
    const showSponsor = tab !== "Verified" && tab !== "Alerts" && grouped.length > 4 && index === 4;
    return (
      <View>
        {showSponsor && <SponsorSeparator />}
        {isCluster(item) ? (
          <ClusterCard cluster={item} />
        ) : (
          <SignalCard signal={item} />
        )}
      </View>
    );
  };

  return (
    <AppShell>
      <TopBar />
      <View style={styles.header}>
        <Text style={styles.title}>Signals</Text>
        <Text style={styles.subtitle}>Verified intelligence from your community.</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => { lightTap(); setTab(t); }}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <FlatList
        data={grouped}
        keyExtractor={(item) => (isCluster(item) ? item.id : item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No signals in this view.</Text>
          </View>
        }
      />

      {/* Create report FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { mediumTap(); setOpen(true); }}
        accessibilityLabel="Create report"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>

      {open && <CreateModal onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

// ─── Category Configuration ───

type IncidentCategory = {
  key: SignalCategory;
  label: string;
  type: SignalType;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
};

const CATEGORIES: IncidentCategory[] = [
  { key: "crime", label: "Crime", type: "incident", Icon: ShieldAlert, color: "#E63946" },
  { key: "fire", label: "Fire", type: "incident", Icon: Flame, color: "#FF8C42" },
  { key: "flood", label: "Flood", type: "update", Icon: Droplets, color: "#2D6A4F" },
  { key: "accident", label: "Accident", type: "incident", Icon: Car, color: "#F59E0B" },
  { key: "missing", label: "Missing person", type: "update", Icon: UserSearch, color: "#1A1A2E" },
  { key: "other", label: "Other", type: "observation", Icon: HelpCircle, color: "#6B7280" },
];

// ─── Create Report Modal ───

function CreateModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [cat, setCat] = useState<IncidentCategory | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [media, setMedia] = useState(0);
  const [location, setLocation] = useState("Ikeja, Lagos");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Get current position on mount
    // In RN we use expo-location or Geolocation API
    const getLocation = async () => {
      try {
        // Simple navigator.geolocation fallback if available
        if (typeof navigator !== "undefined" && "geolocation" in (navigator as any)) {
          (navigator as any).geolocation.getCurrentPosition(
            (pos: any) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { timeout: 4000 },
          );
        }
      } catch {}
    };
    getLocation();
  }, []);

  const submit = () => {
    if (!cat) return;
    setProcessing(true);
    setTimeout(() => {
      signalStore.add({
        type: cat.type,
        category: cat.key,
        title: title.trim() || cat.label,
        description: desc,
        location,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      onClose();
    }, 1100);
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Modal transparent animationType="slide" visible>
      <View style={createStyles.overlay}>
        <View style={createStyles.modal}>
          <View style={createStyles.handle} />
          <View style={createStyles.topRow}>
            <View style={createStyles.topLeft}>
              {step > 0 && !processing && (
                <TouchableOpacity onPress={back} style={createStyles.iconBtn}>
                  <ChevronLeft size={18} color="#1A1A2E" />
                </TouchableOpacity>
              )}
              <Text style={createStyles.stepTitle}>
                {processing ? "Processing report" : ["Type", "Details", "Media", "Location", "Review"][step]}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { lightTap(); onClose(); }} style={createStyles.iconBtn}>
              <X size={18} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          {/* Progress dots */}
          <View style={createStyles.progressRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[createStyles.progressDot, i <= step && createStyles.progressDotActive]} />
            ))}
          </View>

          {processing ? (
            <View style={createStyles.processingBox}>
              <Loader2 size={32} color="#2D6A4F" />
              <Text style={createStyles.processingTitle}>Scanning nearby reports…</Text>
              <Text style={createStyles.processingSub}>Matching similar incidents.</Text>
            </View>
          ) : step === 0 ? (
            /* Step 0: Category selection */
            <View style={createStyles.categoryGrid}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[createStyles.categoryCard, cat?.key === c.key && createStyles.categoryCardActive]}
                  onPress={() => { lightTap(); setCat(c); next(); }}
                >
                  <View style={[createStyles.categoryIconWrap, { backgroundColor: c.color + "20" }]}>
                    <c.Icon size={20} color={c.color} />
                  </View>
                  <Text style={createStyles.categoryLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : step === 1 ? (
            /* Step 1: Title & Description */
            <View style={createStyles.stepContent}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={cat ? `${cat.label} — short title` : "Title"}
                placeholderTextColor="#9CA3AF"
                style={createStyles.inputField}
              />
              <TextInput
                value={desc}
                onChangeText={setDesc}
                placeholder="What's happening?"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                style={[createStyles.inputField, createStyles.textArea]}
              />
            </View>
          ) : step === 2 ? (
            /* Step 2: Media */
            <View style={createStyles.stepContent}>
              <TouchableOpacity style={createStyles.mediaBtn} onPress={() => { lightTap(); setMedia((m) => m + 1); }}>
                <Camera size={20} color="#6B7280" />
                <Text style={createStyles.mediaBtnText}>Add photo or video {media > 0 ? `(${media})` : ""}</Text>
              </TouchableOpacity>
              <Text style={createStyles.mediaHint}>Optional · helps verification confidence.</Text>
            </View>
          ) : step === 3 ? (
            /* Step 3: Location */
            <View style={createStyles.stepContent}>
              <View style={createStyles.locationRow}>
                <View style={createStyles.gpsBadge}>
                  <MapPin size={14} color="#2D6A4F" />
                  <Text style={createStyles.gpsText}>{coords ? "GPS locked" : "Auto"}</Text>
                </View>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Address or area"
                  placeholderTextColor="#9CA3AF"
                  style={createStyles.locationInput}
                />
              </View>
              <Text style={createStyles.locationHint}>You can adjust manually if GPS isn't precise.</Text>
            </View>
          ) : (
            /* Step 4: Review */
            <View style={createStyles.stepContent}>
              <ReviewRow label="Type" value={cat?.label ?? "—"} />
              <ReviewRow label="Title" value={title || "(none)"} />
              <ReviewRow label="Location" value={location} />
              <ReviewRow label="Media" value={`${media} attachment${media === 1 ? "" : "s"}`} />
              <View style={createStyles.confidenceBox}>
                <Text style={createStyles.confidenceText}>
                  Initial confidence: low. Will rise as neighbors confirm.
                </Text>
              </View>
            </View>
          )}

          {!processing && (
            step < 4 ? (
              <TouchableOpacity
                style={[createStyles.actionBtn, step === 0 && !cat && createStyles.actionBtnDisabled]}
                onPress={next}
                disabled={step === 0 && !cat}
              >
                <Text style={createStyles.actionBtnText}>Continue</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={createStyles.actionBtn} onPress={() => { mediumTap(); successNotify(); submit(); }}>
                <Text style={createStyles.actionBtnText}>Submit report</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={createStyles.reviewRow}>
      <Text style={createStyles.reviewLabel}>{label}</Text>
      <Text style={createStyles.reviewValue}>{value}</Text>
    </View>
  );
}

// ─── Create Modal Styles ───

const createStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modal: {
    backgroundColor: "#F7F8FB",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  stepTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  progressRow: { flexDirection: "row", gap: 4, marginTop: 12, marginBottom: 16 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  progressDotActive: { backgroundColor: "#1A1A2E" },
  processingBox: { alignItems: "center", paddingVertical: 32 },
  processingTitle: { fontSize: 14, fontWeight: "600", color: "#1A1A2E", marginTop: 12 },
  processingSub: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  categoryCard: {
    width: "31%", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: "transparent", gap: 8,
  },
  categoryCardActive: { borderColor: "#2D6A4F", backgroundColor: "rgba(45, 106, 79, 0.05)" },
  categoryIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  categoryLabel: { fontSize: 11, fontWeight: "600", color: "#1A1A2E", textAlign: "center" },
  stepContent: { gap: 8, marginBottom: 16 },
  inputField: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: "#1A1A2E",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  mediaBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    backgroundColor: "#FFFFFF", borderWidth: 1, borderStyle: "dashed", borderColor: "#D1D5DB",
    borderRadius: 16, paddingVertical: 32,
  },
  mediaBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  mediaHint: { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#D8F3DC", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  gpsText: { fontSize: 11, fontWeight: "600", color: "#2D6A4F" },
  locationInput: { flex: 1, backgroundColor: "#E5E7EB", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: "#1A1A2E" },
  locationHint: { fontSize: 11, color: "#9CA3AF" },
  actionBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    backgroundColor: "#2D6A4F", paddingVertical: 16, borderRadius: 16, marginTop: 8,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  reviewRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
  },
  reviewLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#6B7280" },
  reviewValue: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  confidenceBox: { backgroundColor: "rgba(45, 106, 79, 0.1)", padding: 12, borderRadius: 16, marginTop: 4 },
  confidenceText: { fontSize: 11, color: "#2D6A4F", textAlign: "center" },
});

const styles = StyleSheet.create({
  header: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  subtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  tabScroll: { marginTop: 12, marginBottom: 8 },
  tabRow: { flexDirection: "row", gap: 4, backgroundColor: "#E5E7EB", borderRadius: 20, padding: 3 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  tabTextActive: { color: "#1A1A2E" },
  list: { gap: 12, paddingBottom: 40 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 32, alignItems: "center" },
  emptyText: { fontSize: 13, color: "#6B7280" },
  fab: {
    position: "absolute",
    bottom: 100,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2D6A4F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});