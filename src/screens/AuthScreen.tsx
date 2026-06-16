/**
 * AuthScreen — Sign in / Sign up with email or Google.
 *
 * Ported from /routes/auth.tsx
 * Uses core/auth.ts functions for all Supabase operations.
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Shield, Mail, Lock, ArrowRight } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";

type AuthMode = "signin" | "signup";

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const { signIn, signUp, signInWithGoogle, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace("MainTabs");
    }
  }, [isAuthenticated, navigation]);

  const handleEmail = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === "signup") {
        await signUp(email, password, name || undefined);
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setErr(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top links */}
          <View style={styles.topLinks}>
            <TouchableOpacity onPress={() => navigation.navigate("Onboarding")}>
              <Text style={styles.link}>About Firmanet</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.replace("MainTabs")}>
              <Text style={styles.link}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Shield size={24} color="#2D6A4F" />
            </View>
            <View>
              <Text style={styles.headerTitle}>
                {mode === "signin" ? "Welcome back" : "Join Firmanet"}
              </Text>
              <Text style={styles.headerSub}>
                A calm safety network for your neighborhood.
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === "signup" && (
              <Field
                icon={<Mail size={16} color="#6B7280" />}
                placeholder="Display name"
                value={name}
                onChangeText={setName}
              />
            )}
            <Field
              icon={<Mail size={16} color="#6B7280" />}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              icon={<Lock size={16} color="#6B7280" />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {err && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{err}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleEmail}
              disabled={busy}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={busy}
            activeOpacity={0.8}
          >
            <GoogleG />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Toggle mode */}
          <TouchableOpacity
            onPress={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            style={styles.toggleBtn}
          >
            <Text style={styles.toggleText}>
              {mode === "signin" ? (
                <>New to Firmanet? <Text style={styles.toggleBold}>Create an account</Text></>
              ) : (
                <>Already have an account? <Text style={styles.toggleBold}>Sign in</Text></>
              )}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            By continuing you agree to Firmanet's calm-by-default safety policies.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldIcon}>{icon}</View>
      <TextInput
        style={styles.fieldInput}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

function GoogleG() {
  return (
    <View style={styles.googleIcon}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#4285F4" }}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FB" },
  container: { padding: 24, paddingTop: 16, flexGrow: 1 },
  topLinks: { flexDirection: "row", justifyContent: "space-between" },
  link: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  header: { flexDirection: "row", gap: 12, marginTop: 40 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Outfit", color: "#1A1A2E" },
  headerSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  form: { marginTop: 32, gap: 12 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldIcon: { width: 20, alignItems: "center" },
  fieldInput: { flex: 1, fontSize: 14, color: "#1A1A2E" },
  errorBox: { backgroundColor: "rgba(230,57,70,0.1)", padding: 12, borderRadius: 16 },
  errorText: { fontSize: 12, color: "#E63946" },
  submitBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2D6A4F",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  submitText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { fontSize: 11, color: "#9CA3AF" },
  googleBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 16,
  },
  googleIcon: { width: 20, height: 20, justifyContent: "center", alignItems: "center" },
  googleText: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  toggleBtn: { marginTop: 32, alignItems: "center" },
  toggleText: { fontSize: 12, color: "#9CA3AF" },
  toggleBold: { fontWeight: "600", color: "#1A1A2E" },
  footer: { marginTop: 24, fontSize: 10, color: "#9CA3AF", textAlign: "center" },
});