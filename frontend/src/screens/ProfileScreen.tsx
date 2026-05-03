import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiJson, getBaseUrl } from "../api/client";

export function ProfileScreen() {
  const { user, token, logout, refreshUser } = useAuth();
  const [targetGpa, setTargetGpa] = useState(user?.target_gpa != null ? String(user.target_gpa) : "");
  const [targetAtt, setTargetAtt] = useState(user?.target_attendance != null ? String(user.target_attendance) : "80");

  React.useEffect(() => {
    setTargetGpa(user?.target_gpa != null ? String(user.target_gpa) : "");
    setTargetAtt(user?.target_attendance != null ? String(user.target_attendance) : "80");
  }, [user?.target_gpa, user?.target_attendance]);

  const save = async () => {
    if (!user?.id || !token) return;
    const tg = parseFloat(targetGpa);
    const ta = parseInt(targetAtt, 10);
    if (isNaN(tg) || tg < 0 || tg > 4) {
      Alert.alert("Validation", "Target GPA must be between 0 and 4.");
      return;
    }
    if (isNaN(ta) || ta < 0 || ta > 100) {
      Alert.alert("Validation", "Target attendance must be 0–100.");
      return;
    }
    const res = await apiJson<{ success?: boolean; error?: string }>(`/users/${user.id}/profile`, {
      method: "PUT",
      token,
      body: JSON.stringify({
        target_gpa: tg,
        target_attendance: ta,
      }),
    });
    if (res.error) Alert.alert("Error", res.error);
    else {
      Alert.alert("Saved", "Goals updated.");
      await refreshUser();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{user?.name}</Text>
      <Text style={styles.muted}>{user?.email}</Text>
      <Text style={styles.muted}>Role: {user?.role}</Text>
      <Text style={styles.label}>API base</Text>
      <Text style={styles.small}>{getBaseUrl()}</Text>

      <Text style={styles.label}>Target GPA (0–4)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 3.5"
        placeholderTextColor="#6b7c99"
        keyboardType="decimal-pad"
        value={targetGpa}
        onChangeText={setTargetGpa}
      />
      <Text style={styles.label}>Target attendance %</Text>
      <TextInput
        style={styles.input}
        placeholder="80"
        placeholderTextColor="#6b7c99"
        keyboardType="number-pad"
        value={targetAtt}
        onChangeText={setTargetAtt}
      />
      <TouchableOpacity style={styles.primary} onPress={save}>
        <Text style={styles.primaryText}>Save goals</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.danger} onPress={() => logout()}>
        <Text style={styles.dangerText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#121826", padding: 20 },
  h1: { fontSize: 22, fontWeight: "700", color: "#e8edf5" },
  muted: { color: "#8b9cb8", marginBottom: 4 },
  label: { color: "#e8edf5", marginTop: 16, marginBottom: 6 },
  small: { color: "#6b7c99", fontSize: 12 },
  input: {
    backgroundColor: "#1a2233",
    borderWidth: 1,
    borderColor: "#2a3548",
    borderRadius: 10,
    padding: 12,
    color: "#e8edf5",
  },
  primary: {
    backgroundColor: "#5b8def",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  danger: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#f07178",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  dangerText: { color: "#f07178", fontWeight: "600" },
});
