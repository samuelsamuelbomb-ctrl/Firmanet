/**
 * AppShell — React Native layout wrapper.
 *
 * Ported from src/components/swish/AppShell.tsx
 *
 * Provides:
 * - SafeAreaView for notch/island safety
 * - Consistent horizontal padding
 * - Bottom padding to clear the custom tab bar
 * - Optional floating SOS FAB
 */

import { ReactNode } from "react";
import { View, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { SosFab } from "./SosFab";

interface AppShellProps {
  children: ReactNode;
  /** Hide SOS floating button (used on Map screen) */
  hideSos?: boolean;
}

export function AppShell({ children, hideSos = false }: AppShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FB" />
      <View style={styles.container}>
        {children}
      </View>
      {!hideSos && <SosFab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FB",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 88, // clears the fixed bottom tab bar
  },
});