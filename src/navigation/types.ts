/**
 * Navigation type definitions.
 *
 * Auth Stack: Onboarding → Login
 * Main Tabs: Home, Map, Feed, Circle, Settings
 * Push screens (overlay on tabs): Notifications, Profile, IncidentDetail
 * Modal: SOS
 */

import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Onboarding: { skip?: boolean } | undefined;
  Login: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  MapTab: undefined;
  FeedTab: undefined;
  CircleTab: undefined;
  SettingsTab: undefined;
};

export type MainStackParamList = {
  Notifications: undefined;
  Profile: undefined;
  IncidentDetail: { id: string };
};

export type RootStackParamList = {
  AuthFlow: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  MainStack: NavigatorScreenParams<MainStackParamList>;
  SOS: undefined;
};
