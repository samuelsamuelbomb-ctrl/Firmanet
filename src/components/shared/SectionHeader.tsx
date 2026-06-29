/**
 * SectionHeader — Section title with optional "See all" action.
 *
 * Ported from src/components/swish/SectionHeader.tsx
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronRight } from "lucide-react-native";
import { lightTap } from "../../core/haptics";

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: string; // route name
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  const navigation = useNavigation<any>();

  const handleAction = () => {
    lightTap();
    if (onAction) {
      // Tab routes (e.g. FeedTab, MapTab) are directly accessible in tab navigator
      // Stack routes need parent navigation
      if (onAction === "Notifications" || onAction === "Profile" || onAction === "IncidentDetail") {
        try {
          navigation.navigate("MainStack", { screen: onAction });
        } catch {
          navigation.navigate(onAction);
        }
      } else {
        navigation.navigate(onAction);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity
          style={styles.action}
          onPress={handleAction}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>{action}</Text>
          <ChevronRight size={14} color="#2D6A4F" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#1A1A2E",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2D6A4F",
  },
});