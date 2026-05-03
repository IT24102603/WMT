import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../api/client";

type GpaRes = {
  overall: { gpa: number; credits: number };
  modules: { id: string; code: string; name: string; credits: number; grade_letter?: string | null; semester: number }[];
};

export function DashboardScreen() {
  const { user, token } = useAuth();
  const [data, setData] = useState<GpaRes | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !token) return;
    const g = await apiJson<GpaRes>(`/users/${user.id}/gpa`, { token });
    setData(g);
  }, [user?.id, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const recent = (data?.modules || []).slice(0, 8);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5b8def" />}
    >
      <Text style={styles.h1}>Hello, {user?.name || "Student"}</Text>
      <Text style={styles.muted}>{user?.email}</Text>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Current GPA</Text>
          <Text style={styles.value}>{data?.overall?.gpa?.toFixed(2) ?? "—"}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Credits (graded)</Text>
          <Text style={styles.value}>{data?.overall?.credits ?? 0}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Target GPA</Text>
          <Text style={styles.value}>{user?.target_gpa != null ? user.target_gpa.toFixed(2) : "—"}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Target attendance</Text>
          <Text style={styles.value}>{user?.target_attendance ?? 80}%</Text>
        </View>
      </View>

      <Text style={styles.section}>Recent modules</Text>
      {recent.length === 0 ? (
        <Text style={styles.muted}>Add modules from the GPA tab.</Text>
      ) : (
        recent.map((m) => (
          <View key={m.id} style={styles.line}>
            <Text style={styles.code}>{m.code}</Text>
            <Text style={styles.modName} numberOfLines={1}>
              {m.name}
            </Text>
            <Text style={styles.grade}>{m.grade_letter || "—"}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#121826" },
  content: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "700", color: "#e8edf5" },
  muted: { color: "#8b9cb8", marginTop: 4, marginBottom: 20 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: "#1a2233",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a3548",
  },
  label: { color: "#8b9cb8", fontSize: 12 },
  value: { color: "#e8edf5", fontSize: 22, fontWeight: "600", marginTop: 4 },
  section: { color: "#e8edf5", fontWeight: "600", marginTop: 16, marginBottom: 10 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3548",
    gap: 8,
  },
  code: { color: "#5b8def", width: 72, fontWeight: "600" },
  modName: { flex: 1, color: "#e8edf5" },
  grade: { color: "#8b9cb8", width: 36, textAlign: "right" },
});
