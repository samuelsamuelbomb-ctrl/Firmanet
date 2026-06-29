import { View, Text, TouchableOpacity, StyleSheet, Image, Share } from "react-native";
import { ShieldAlert, MapPin, MoreVertical, X, ThumbsUp, Flag, Share2, ZoomIn } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { Signal } from "../../core/types";
import { formatTimeAgo } from "../../core/utils";
import { useMediaViewer } from "./MediaViewer";
import { signalStore } from "../../core/signalStore";
import { lightTap } from "../../core/haptics";
import { Video } from "expo-video";
import { useState } from "react";

interface CategoryColors {
  bg: string;
  text: string;
}

const categoryColors: Record<string, CategoryColors> = {
  crime: { bg: "#EF4444", text: "#EF4444" },
  fire: { bg: "#B91C1C", text: "#B91C1C" },
  flood: { bg: "#3B82F6", text: "#3B82F6" },
  accident: { bg: "#F97316", text: "#F97316" },
  missing: { bg: "#8B5CF6", text: "#8B5CF6" },
  other: { bg: "#6B7280", text: "#6B7280" },
};

interface SignalCardProps {
  signal: Signal;
}

export function SignalCard({ signal }: SignalCardProps) {
  console.log('SignalCard received signal:', signal);
  console.log('Signal media_urls:', signal.media_urls);
  const navigation = useNavigation<any>();
  const { open } = useMediaViewer();
  const colors = categoryColors[signal.category] || categoryColors.other;
  const isVerified = signal.state === "verified";

  const handleConfirm = () => {
    lightTap();
    signalStore.toggleConfirm(signal.id);
  };

  const handleShare = async () => {
    lightTap();
    try {
      await Share.share({
        message: `${signal.title}\n${signal.description || ''}`,
        title: signal.title,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDismiss = () => {
    lightTap();
    // TODO: Implement dismiss logic
  };

  const handleMoreOptions = () => {
    lightTap();
    // TODO: Implement more options
  };

  return (
    <View style={styles.card}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
            <ShieldAlert size={20} color="#FFFFFF" />
          </View>
          <View style={styles.metaTextContainer}>
            <View style={styles.metaRow1}>
              <Text style={[styles.categoryText, { color: colors.text }]}>
                {signal.category.charAt(0).toUpperCase() + signal.category.slice(1)}
              </Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.trustText}>{signal.trust}%</Text>
              <Text style={styles.separator}>·</Text>
              <Text style={[styles.statusText, { color: isVerified ? "#10B981" : "#F59E0B" }]}>
                {isVerified ? "Verified" : "Unverified"}
              </Text>
            </View>
            <View style={styles.metaRow2}>
              <MapPin size={14} color="#6B7280" />
              <Text style={styles.locationText} numberOfLines={1}>
                {signal.location}
              </Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.timeText}>{formatTimeAgo(signal.minutesAgo)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.rightSection}>
          <TouchableOpacity onPress={handleMoreOptions} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MoreVertical size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* CAPTION */}
      <View style={styles.captionSection}>
        <Text style={styles.title}>{signal.title}</Text>
        {signal.description && <Text style={styles.description}>{signal.description}</Text>}
        <Text style={styles.distanceReportsText}>
          {signal.distanceKm.toFixed(1)} km away · {signal.reports} report{signal.reports !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* MEDIA */}
      {signal.media_urls && signal.media_urls.length > 0 && (
        <View style={styles.mediaContainer}>
          {(() => {
            const isVideo = signal.media_files?.[0]?.mime_type.startsWith('video/');
            if (isVideo) {
              return (
                <Video
                  source={{ uri: signal.media_urls[0] }}
                  style={styles.mediaImage}
                  contentFit="cover"
                  allowsFullscreen={false}
                  allowsPictureInPicture={false}
                  allowsExternalPlayback={false}
                  useNativeControls={false}
                />
              );
            }
            return (
              <Image 
                source={{ uri: signal.media_urls[0] }} 
                style={styles.mediaImage} 
                resizeMode="cover"
                onLoadStart={() => console.log('Image loading started:', signal.media_urls![0])}
                onLoad={(e) => console.log('Image loaded:', e.nativeEvent)}
                onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
              />
            );
          })()}
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => open(signal.media_urls![0])}
          >
            <ZoomIn size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* COUNT LINE */}
      <View style={styles.countLine}>
        <View style={styles.confirmsSection}>
          <View style={styles.confirmsCircle}>
            <ThumbsUp size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.confirmsText}>
            {signal.confirms} confirmation{signal.confirms !== 1 ? "s" : ""}
          </Text>
        </View>
        <Text style={styles.reportsCountText}>{signal.reports} report{signal.reports !== 1 ? "s" : ""}</Text>
      </View>
      <View style={styles.divider} />

      {/* ACTION ROW */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, signal.userConfirmed && styles.confirmedButton]}
          onPress={handleConfirm}
        >
          <ThumbsUp size={20} color={signal.userConfirmed ? "#FFFFFF" : "#6B7280"} />
          <Text style={[styles.actionButtonText, signal.userConfirmed && styles.confirmedButtonText]}>
            Confirm
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Flag size={20} color="#6B7280" />
          <Text style={styles.actionButtonText}>Dispute</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Share2 size={20} color="#6B7280" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  leftSection: {
    flexDirection: "row",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  metaTextContainer: {
    flex: 1,
  },
  metaRow1: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  separator: {
    fontSize: 14,
    color: "#6B7280",
    marginHorizontal: 4,
  },
  trustText: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  metaRow2: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  locationText: {
    fontSize: 14,
    color: "#6B7280",
    flexShrink: 1,
  },
  timeText: {
    fontSize: 14,
    color: "#6B7280",
  },
  rightSection: {
    flexDirection: "row",
    gap: 12,
    marginLeft: 8,
  },
  captionSection: {
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  distanceReportsText: {
    fontSize: 12,
    color: "#6B7280",
  },
  mediaContainer: {
    marginHorizontal: -16,
    overflow: "hidden",
    marginBottom: 12,
    aspectRatio: 1,
    backgroundColor: "#E5E7EB",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  zoomButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 20,
    padding: 8,
    backdropFilter: "blur(4px)",
  },
  countLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  confirmsSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  confirmsCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  confirmsText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  reportsCountText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    gap: 6,
  },
  confirmedButton: {
    backgroundColor: "#10B981",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  confirmedButtonText: {
    color: "#FFFFFF",
  },
});