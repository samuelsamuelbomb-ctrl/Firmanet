/**
 * OnboardingScreen — 5-slide welcome carousel.
 *
 * Ported from /routes/onboarding.tsx
 * Slides: mission → purpose → intelligence → alerts → sponsors
 * On complete: sets localStorage flag + navigates to Auth
 */

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Shield, Users, Radar, Sparkles, Siren, ChevronRight } from "lucide-react-native";
import { sponsors } from "../core/sponsors";
import * as SecureStore from "expo-secure-store";
import { lightTap } from "../core/haptics";

const SLIDES = ["mission", "purpose", "intelligence", "alerts", "sponsors"] as const;
type Stage = (typeof SLIDES)[number];

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const [stage, setStage] = useState<Stage>("mission");
  const idx = SLIDES.indexOf(stage);

  const next = async () => {
    if (idx === SLIDES.length - 1) {
      try {
        await SecureStore.setItemAsync("swish.onboarded", "1");
      } catch {}
      navigation.replace("Login");
      return;
    }
    setStage(SLIDES[idx + 1]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View key={s} style={[styles.dot, i <= idx && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity onPress={() => { lightTap(); navigation.replace("Login"); }}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {stage === "mission" && <Mission />}
          {stage === "purpose" && <Purpose />}
          {stage === "intelligence" && <Intelligence />}
          {stage === "alerts" && <Alerts />}
          {stage === "sponsors" && <Sponsors />}
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={() => { lightTap(); next(); }} activeOpacity={0.8}>
          <Text style={styles.continueText}>
            {idx === SLIDES.length - 1 ? "Get started" : "Continue"}
          </Text>
          <ChevronRight size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Mission() {
  return (
    <View style={styles.slideCenter}>
      <View style={styles.iconLarge}>
        <Shield size={40} color="#2D6A4F" />
      </View>
      <Text style={styles.titleLarge}>Firmanet</Text>
      <Text style={styles.subLarge}>A real-time safety network for Nigerian communities.</Text>
    </View>
  );
}

function Purpose() {
  const items = [
    { Icon: Users, t: "Report incidents", s: "Calm, structured signals — not noise." },
    { Icon: Radar, t: "See nearby safety updates", s: "Only what's relevant to where you are." },
    { Icon: Sparkles, t: "Stay informed in real time", s: "Trust grows as community verifies." },
  ];
  return (
    <View>
      <Text style={styles.title}>Built for your neighborhood</Text>
      <Text style={styles.sub}>Detect, verify, and alert — together.</Text>
      <View style={styles.cardList}>
        {items.map(({ Icon, t, s }) => (
          <View key={t} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <Icon size={20} color="#2D6A4F" />
            </View>
            <View>
              <Text style={styles.featureTitle}>{t}</Text>
              <Text style={styles.featureSub}>{s}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Intelligence() {
  return (
    <View>
      <Text style={styles.title}>Verified, not viral</Text>
      <Text style={styles.sub}>Every signal carries a trust score from the people around it.</Text>
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>Incident Report</Text>
          </View>
          <Text style={styles.previewTime}>9 min</Text>
        </View>
        <Text style={styles.previewTitle}>Armed robbery suspected</Text>
        <Text style={styles.previewLoc}>Allen Avenue · 1.2 km away</Text>
        <View style={styles.previewBar}>
          <View style={[styles.previewFill, { width: "82%" }]} />
          <Text style={styles.previewPct}>82%</Text>
        </View>
      </View>
    </View>
  );
}

function Alerts() {
  return (
    <View style={styles.slideCenter}>
      <Text style={styles.title}>Loud only when it matters</Text>
      <Text style={styles.sub}>Quiet by default. Emergency override when reality demands it.</Text>
      <View style={styles.sosDemo}>
        <View style={styles.sosPulse} />
        <Siren size={48} color="#FFFFFF" />
      </View>
      <Text style={styles.sosDesc}>Active alert nearby — confidence rises as more neighbors confirm.</Text>
    </View>
  );
}

function Sponsors() {
  return (
    <View>
      <Text style={styles.title}>Backed by Nigeria's safety infrastructure</Text>
      <Text style={styles.sub}>Supported by organizations committed to public safety.</Text>
      <View style={styles.sponsorList}>
        {sponsors.map((s) => (
          <View key={s.id} style={styles.sponsorCard}>
            <View style={[styles.sponsorLogo, { backgroundColor: s.accent }]}>
              <Text style={styles.sponsorInitials}>{s.initials}</Text>
            </View>
            <View>
              <Text style={styles.sponsorName}>{s.name}</Text>
              <Text style={styles.sponsorTagline}>{s.tagline}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FB" },
  container: { flex: 1, paddingHorizontal: 24, paddingVertical: 24, justifyContent: "space-between" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 12, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB" },
  dotActive: { width: 24, backgroundColor: "#1A1A2E" },
  skip: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  content: { flex: 1, justifyContent: "center" },
  continueBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2D6A4F",
    paddingVertical: 16,
    borderRadius: 16,
  },
  continueText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  slideCenter: { alignItems: "center" },
  iconLarge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  titleLarge: { fontSize: 32, fontWeight: "700", fontFamily: "Outfit", textAlign: "center", color: "#1A1A2E" },
  subLarge: { fontSize: 16, color: "#6B7280", textAlign: "center", marginTop: 8 },
  title: { fontSize: 24, fontWeight: "700", fontFamily: "Outfit", textAlign: "center", color: "#1A1A2E" },
  sub: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 8 },
  cardList: { gap: 12, marginTop: 24 },
  featureCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  featureTitle: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  featureSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewBadge: { backgroundColor: "#FFEDD5", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  previewBadgeText: { fontSize: 10, fontWeight: "700", color: "#1A1A2E" },
  previewTime: { fontSize: 10, color: "#6B7280" },
  previewTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E", marginTop: 12 },
  previewLoc: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  previewBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  previewFill: { height: 6, borderRadius: 3, backgroundColor: "#F59E0B", flex: 1 },
  previewPct: { fontSize: 12, fontWeight: "600", color: "#1A1A2E" },
  sosDemo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#E63946",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 32,
  },
  sosPulse: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(230, 57, 70, 0.4)",
  },
  sosDesc: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 24 },
  sponsorList: { gap: 12, marginTop: 24 },
  sponsorCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  sponsorLogo: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  sponsorInitials: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  sponsorName: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  sponsorTagline: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});