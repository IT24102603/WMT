import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../api/client";

type TaskRow = {
  id: string;
  title: string;
  module_code?: string | null;
  due_date?: string | null;
  completed: number;
  priority_score: number;
};

export function TasksScreen() {
  const { user, token } = useAuth();
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    if (!user?.id || !token) return;
    const list = await apiJson<TaskRow[]>(`/users/${user.id}/tasks`, { token });
    setRows(Array.isArray(list) ? list : []);
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

  const add = async () => {
    if (!user?.id || !token) return;
    const t = title.trim();
    if (!t) return;
    await apiJson("/tasks", {
      method: "POST",
      token,
      body: JSON.stringify({
        user_id: user.id,
        module_code: code.trim().toUpperCase() || null,
        title: t,
        priority_score: 5,
      }),
    });
    setTitle("");
    setCode("");
    await load();
  };

  const toggle = async (id: string, done: boolean) => {
    if (!token) return;
    await apiJson(`/tasks/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ completed: done }),
    });
    await load();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Module code"
          placeholderTextColor="#6b7c99"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <TextInput
          style={styles.input}
          placeholder="Task title"
          placeholderTextColor="#6b7c99"
          value={title}
          onChangeText={setTitle}
        />
        <TouchableOpacity style={styles.primary} onPress={add}>
          <Text style={styles.primaryText}>Add task</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5b8def" />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Switch
              value={!!item.completed}
              onValueChange={(v) => toggle(item.id, v)}
              thumbColor="#e8edf5"
              trackColor={{ false: "#2a3548", true: "#3d5a8a" }}
            />
            <View style={styles.rowText}>
              <Text style={[styles.title, !!item.completed && styles.done]}>{item.title}</Text>
              <Text style={styles.meta}>{item.module_code || "—"} · priority {item.priority_score}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#121826" },
  form: { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: "#2a3548" },
  input: {
    backgroundColor: "#1a2233",
    borderWidth: 1,
    borderColor: "#2a3548",
    borderRadius: 10,
    padding: 12,
    color: "#e8edf5",
  },
  primary: { backgroundColor: "#5b8def", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  primaryText: { color: "#fff", fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2a3548" },
  rowText: { marginLeft: 12, flex: 1 },
  title: { color: "#e8edf5", fontSize: 16 },
  done: { textDecorationLine: "line-through", color: "#6b7c99" },
  meta: { color: "#8b9cb8", fontSize: 12, marginTop: 2 },
});
