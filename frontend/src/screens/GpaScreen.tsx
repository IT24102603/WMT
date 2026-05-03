import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../api/client";

const GRADES = ["", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E", "F"];

type Mod = {
  id: string;
  code: string;
  name: string;
  credits: number;
  grade_letter?: string | null;
  semester: number;
};

type GpaRes = {
  overall: { gpa: number; credits: number };
  semesters: { semester: number; gpa: number; credits: number }[];
  modules: Mod[];
};

export function GpaScreen() {
  const { user, token } = useAuth();
  const [data, setData] = useState<GpaRes | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("3");
  const [semester, setSemester] = useState("1");
  const [grade, setGrade] = useState("");

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

  const addModule = async () => {
    if (!user?.id || !token) return;
    const n = name.trim();
    const c = code.trim().toUpperCase();
    const cr = parseInt(credits, 10) || 3;
    const sem = parseInt(semester, 10) || 1;
    if (!n || !c) {
      Alert.alert("Validation", "Module name and code are required.");
      return;
    }
    const res = await apiJson<{ id?: string; error?: string }>("/modules", {
      method: "POST",
      token,
      body: JSON.stringify({
        user_id: user.id,
        name: n,
        code: c,
        credits: cr,
        semester: sem,
        academic_year: 1,
        semester_in_year: 1,
        grade_letter: grade || null,
        grade_point: null,
        university_id: null,
        source_type: "normal",
        is_repeat: false,
      }),
    });
    if (res.error) Alert.alert("Error", res.error);
    else {
      setName("");
      setCode("");
      setGrade("");
      await load();
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5b8def" />}
    >
      <Text style={styles.h1}>GPA overview</Text>
      <Text style={styles.bigGpa}>Cumulative: {data?.overall?.gpa?.toFixed(2) ?? "—"}</Text>
      <Text style={styles.muted}>Weighted GPA uses grade points × credits.</Text>

      {(data?.semesters || []).map((s) => (
        <View key={s.semester} style={styles.semRow}>
          <Text style={styles.semLabel}>Semester {s.semester}</Text>
          <Text style={styles.semGpa}>{s.gpa.toFixed(2)}</Text>
        </View>
      ))}

      <Text style={styles.section}>Add module</Text>
      <TextInput style={styles.input} placeholder="Module name" placeholderTextColor="#6b7c99" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Code (e.g. SE2020)" placeholderTextColor="#6b7c99" value={code} onChangeText={setCode} />
      <View style={styles.row2}>
        <TextInput
          style={[styles.input, styles.half]}
          placeholder="Credits"
          placeholderTextColor="#6b7c99"
          keyboardType="number-pad"
          value={credits}
          onChangeText={setCredits}
        />
        <TextInput
          style={[styles.input, styles.half]}
          placeholder="Semester #"
          placeholderTextColor="#6b7c99"
          keyboardType="number-pad"
          value={semester}
          onChangeText={setSemester}
        />
      </View>
      <Text style={styles.mutedSmall}>Grade (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeRow}>
        {GRADES.filter(Boolean).map((g) => (
          <TouchableOpacity key={g} style={[styles.chip, grade === g && styles.chipOn]} onPress={() => setGrade(g)}>
            <Text style={[styles.chipText, grade === g && styles.chipTextOn]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.primary} onPress={addModule}>
        <Text style={styles.primaryText}>Save module</Text>
      </TouchableOpacity>

      <Text style={styles.section}>All modules</Text>
      {(data?.modules || []).map((m) => (
        <View key={m.id} style={styles.line}>
          <Text style={styles.code}>{m.code}</Text>
          <Text style={styles.modName} numberOfLines={1}>
            {m.name}
          </Text>
          <Text style={styles.meta}>
            {m.grade_letter || "—"} · sem {m.semester}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#121826" },
  content: { padding: 20, paddingBottom: 48 },
  h1: { fontSize: 20, fontWeight: "700", color: "#e8edf5" },
  bigGpa: { fontSize: 28, fontWeight: "700", color: "#5b8def", marginTop: 8 },
  muted: { color: "#8b9cb8", marginBottom: 12 },
  mutedSmall: { color: "#8b9cb8", marginBottom: 6 },
  semRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3548",
  },
  semLabel: { color: "#e8edf5" },
  semGpa: { color: "#5b8def", fontWeight: "600" },
  section: { color: "#e8edf5", fontWeight: "600", marginTop: 20, marginBottom: 10 },
  input: {
    backgroundColor: "#1a2233",
    borderWidth: 1,
    borderColor: "#2a3548",
    borderRadius: 10,
    padding: 12,
    color: "#e8edf5",
    marginBottom: 10,
  },
  row2: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  gradeRow: { flexDirection: "row", marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a2233",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#2a3548",
  },
  chipOn: { borderColor: "#5b8def", backgroundColor: "#243048" },
  chipText: { color: "#8b9cb8" },
  chipTextOn: { color: "#e8edf5", fontWeight: "600" },
  primary: {
    backgroundColor: "#5b8def",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  line: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3548",
    gap: 8,
  },
  code: { color: "#5b8def", width: 68, fontWeight: "600" },
  modName: { flex: 1, color: "#e8edf5" },
  meta: { color: "#8b9cb8", fontSize: 12 },
});
