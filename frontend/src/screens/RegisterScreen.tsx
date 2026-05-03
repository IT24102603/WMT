import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register, loading, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#6b7c99"
        value={name}
        onChangeText={(t) => {
          clearError();
          setName(t);
        }}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6b7c99"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 6)"
        placeholderTextColor="#6b7c99"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity
        style={styles.primary}
        disabled={loading}
        onPress={() => register(name.trim(), email.trim(), password)}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Register</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#121826" },
  input: {
    backgroundColor: "#1a2233",
    borderWidth: 1,
    borderColor: "#2a3548",
    borderRadius: 10,
    padding: 14,
    color: "#e8edf5",
    marginBottom: 12,
  },
  primary: {
    backgroundColor: "#5b8def",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  link: { marginTop: 20, alignItems: "center" },
  linkText: { color: "#5b8def" },
  error: { color: "#f07178", marginBottom: 12, textAlign: "center" },
});
