/**
 * SponsorStrip + SponsorCard + SponsorSeparator — Sponsor display components.
 *
 * Ported from src/components/swish/SponsorCard.tsx
 */

import { View, Text, StyleSheet, Image, Animated } from "react-native";
import { useSponsors, useSponsorsBootstrap } from "../../core/sponsorStore";
import { useEffect, useRef, useState } from "react";
import type { Sponsor } from "../../core/types";

export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <View style={styles.sponsorCard}>
      {sponsor.image_url ? (
        <Image
          source={{ uri: sponsor.image_url }}
          style={styles.sponsorLogo}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.sponsorLogo, { backgroundColor: sponsor.accent }]}>
          <Text style={styles.sponsorInitials}>{sponsor.initials}</Text>
        </View>
      )}
      <View>
        <Text style={styles.sponsorName}>{sponsor.name}</Text>
        <Text style={styles.sponsorTagline}>{sponsor.tagline}</Text>
      </View>
    </View>
  );
}

export function SponsorSeparator() {
  const sponsors = useSponsors();
  return (
    <View style={sepStyles.container}>
      <View style={sepStyles.line} />
      <View style={sepStyles.sponsor}>
        <Text style={sepStyles.sparkle}>✦</Text>
        <Text style={sepStyles.text}>Sponsored by {sponsors[1]?.name ?? "GTBank"}</Text>
      </View>
      <View style={sepStyles.line} />
    </View>
  );
}

export function SponsorStrip() {
  const sponsors = useSponsors();
  const { bootstrap } = useSponsorsBootstrap();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (sponsors.length === 0) return;
    
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => (prev + 1) % sponsors.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [sponsors.length, fadeAnim]);

  const currentSponsor = sponsors.length > 0 ? sponsors[currentIndex] : null;

  return (
    <View style={styles.strip}>
      <Text style={styles.label}>COMMUNITY SUPPORTERS</Text>
      <View style={styles.logos}>
        {currentSponsor ? (
          <Animated.View style={{ opacity: fadeAnim, flexDirection: "row", alignItems: "center", gap: 8 }}>
            {currentSponsor.image_url ? (
              <Image
                source={{ uri: currentSponsor.image_url }}
                style={[styles.sponsorDot, { width: 32, height: 32, borderRadius: 10 }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.sponsorDot, { backgroundColor: currentSponsor.accent, width: 32, height: 32, borderRadius: 10 }]}>
                <Text style={[styles.sponsorInitials, { fontSize: 10 }]}>{currentSponsor.initials}</Text>
              </View>
            )}
            <Text style={[styles.moreText, { fontWeight: "600", color: "#374151" }]}>{currentSponsor.name}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const sepStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  line: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  sponsor: { flexDirection: "row", alignItems: "center", gap: 4 },
  sparkle: { fontSize: 10, color: "#F59E0B" },
  text: { fontSize: 10, fontWeight: "600", color: "#9CA3AF" },
});

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#9CA3AF",
  },
  logos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sponsorDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sponsorInitials: {
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  moreText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  sponsorCard: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  sponsorLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sponsorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  sponsorTagline: {
    fontSize: 11,
    color: "#6B7280",
  },
});
