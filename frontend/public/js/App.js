/**
 * UniNavigator — React Native / Expo Frontend  (single-file)
 *
 * This file is the complete frontend App.js for an Expo project.
 *
 * Setup:
 *   npx create-expo-app UniNavigator --template blank
 *   cd UniNavigator
 *   npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
 *               react-native-screens react-native-safe-area-context
 *               react-native-gesture-handler react-native-reanimated
 *               axios @react-native-async-storage/async-storage
 *
 * Then replace App.js with this file.
 *
 * Set API_BASE below to your backend URL (e.g. http://192.168.x.x:3000 on LAN).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, RefreshControl, Modal, Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// ============================================================
// Configuration
// ============================================================
const API_BASE = "https://wmt-tbo4.onrender.com"; // Change to your server IP

const api = axios.create({ baseURL: API_BASE });

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    return Promise.reject(new Error(message));
  }
);

// ============================================================
// Auth Context
// ============================================================
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (stored) setUser(JSON.parse(stored));
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/login", { email, password });
    if (data.error) throw new Error(data.error);
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post("/register", { name, email, password });
    if (data.error) throw new Error(data.error);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/logout").catch(() => {});
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/me");
    if (data?.user) {
      const merged = { ...user, ...data.user };
      await AsyncStorage.setItem("user", JSON.stringify(merged));
      setUser(merged);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Utility Components
// ============================================================
function Btn({ title, onPress, style, textStyle, disabled, loading: busy }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.btn, style, (disabled || busy) && styles.btnDisabled]}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.btnText, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function Input({ label, ...props }) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput style={styles.input} placeholderTextColor="#999" {...props} />
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ErrorText({ msg }) {
  if (!msg) return null;
  return <Text style={styles.errorText}>{msg}</Text>;
}

// ============================================================
// Login Screen
// ============================================================
function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async () => {
    setErr("");
    if (!email || !password) return setErr("Email and password are required.");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authContainer}>
      <ScrollView contentContainerStyle={styles.authInner}>
        <Text style={styles.appTitle}>UniNavigator</Text>
        <Text style={styles.appSubtitle}>Academic Performance Manager</Text>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="your@email.com" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" />
        <ErrorText msg={err} />
        <Btn title="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />
        <TouchableOpacity onPress={() => navigation.navigate("Register")} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={styles.linkText}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Register Screen
// ============================================================
function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleRegister = async () => {
    setErr("");
    if (!name || !email || !password) return setErr("All fields are required.");
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      Alert.alert("Success", "Account created! Please sign in.");
      navigation.goBack();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authContainer}>
      <ScrollView contentContainerStyle={styles.authInner}>
        <Text style={styles.appTitle}>Create Account</Text>
        <Input label="Full Name" value={name} onChangeText={setName} placeholder="John Doe" />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="your@email.com" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Min. 6 characters" />
        <ErrorText msg={err} />
        <Btn title="Register" onPress={handleRegister} loading={loading} style={{ marginTop: 8 }} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Dashboard Screen
// ============================================================
function DashboardScreen() {
  const { user } = useAuth();
  const [gpaData, setGpaData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, t, a] = await Promise.all([
        api.get(`/users/${user.id}/gpa`),
        api.get(`/users/${user.id}/tasks`),
        api.get(`/users/${user.id}/attendance`),
      ]);
      setGpaData(g.data);
      setTasks(t.data || []);
      setAttendance(a.data || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const avgAttendance =
    attendance.length
      ? (attendance.reduce((s, a) => s + (a.total_sessions ? (a.attended / a.total_sessions) * 100 : 0), 0) / attendance.length).toFixed(1)
      : null;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Welcome, {user.name?.split(" ")[0]} 👋</Text>

      <View style={styles.statsRow}>
        <StatCard label="CGPA" value={gpaData?.overall?.gpa?.toFixed(2) ?? "—"} color={COLORS.primary} />
        <StatCard label="Credits" value={gpaData?.overall?.credits ?? "—"} color={COLORS.secondary} />
        <StatCard label="Attendance" value={avgAttendance ? `${avgAttendance}%` : "—"} color={COLORS.success} />
      </View>

      {user.target_gpa ? (
        <Card>
          <Text style={styles.cardLabel}>GPA Target: {user.target_gpa}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, ((gpaData?.overall?.gpa ?? 0) / 4) * 100)}%` }]} />
          </View>
          <Text style={styles.cardSubText}>Current: {gpaData?.overall?.gpa?.toFixed(2) ?? "0"} / 4.00</Text>
        </Card>
      ) : null}

      <SectionTitle title={`Pending Tasks (${pendingTasks.length})`} />
      {pendingTasks.slice(0, 5).map((t) => (
        <Card key={t._id} style={styles.taskCard}>
          <Text style={styles.taskTitle}>{t.title}</Text>
          {t.due_date ? <Text style={styles.taskMeta}>Due: {new Date(t.due_date).toDateString()}</Text> : null}
          {t.module_code ? <Text style={styles.taskMeta}>Module: {t.module_code}</Text> : null}
        </Card>
      ))}
      {pendingTasks.length === 0 ? <Text style={styles.emptyText}>No pending tasks 🎉</Text> : null}

      <SectionTitle title="Semester GPAs" />
      {(gpaData?.semesters || []).map((s) => (
        <Card key={s.semester} style={styles.semCard}>
          <Text style={styles.semLabel}>Semester {s.semester}</Text>
          <Text style={styles.semGpa}>{s.gpa?.toFixed(2)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// Modules Screen
// ============================================================
function ModulesScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", credits: "3", grade_letter: "", grade_point: "", semester: "1", ca_percentage: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/users/${user.id}/modules`);
      setModules(data || []);
    } catch (_) {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.name || !form.code) return setErr("Name and code are required.");
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: form.name.trim(),
        code: form.code.trim(),
        credits: parseInt(form.credits, 10) || 3,
        grade_letter: form.grade_letter || undefined,
        grade_point: form.grade_point ? parseFloat(form.grade_point) : undefined,
        semester: parseInt(form.semester, 10) || 1,
        ca_percentage: form.ca_percentage ? parseInt(form.ca_percentage, 10) : undefined,
      };
      const { data } = await api.post("/modules", payload);
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ name: "", code: "", credits: "3", grade_letter: "", grade_point: "", semester: "1", ca_percentage: "" });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteModule = async (id) => {
    Alert.alert("Delete", "Remove this module?", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await api.delete(`/modules/${id}`);
          load();
        }
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.screen}>
      <FlatList
        data={modules}
        keyExtractor={(m) => String(m._id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Modules</Text>
            <Btn title="+ Add Module" onPress={() => setShowForm(true)} style={styles.addBtn} />
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No modules yet. Add your first module!</Text>}
        renderItem={({ item: m }) => (
          <Card style={styles.moduleCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleCode}>{m.code}</Text>
                <Text style={styles.moduleName}>{m.name}</Text>
                <Text style={styles.moduleMeta}>
                  Credits: {m.credits} | Sem: {m.semester}
                  {m.grade_letter ? ` | Grade: ${m.grade_letter}` : ""}
                  {m.grade_point != null ? ` (${m.grade_point})` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteModule(m._id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Module</Text>
            <ScrollView>
              <Input label="Module Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. Data Structures" />
              <Input label="Module Code *" value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} placeholder="e.g. IT2030" autoCapitalize="characters" />
              <Input label="Credits" value={form.credits} onChangeText={(v) => setForm({ ...form, credits: v })} keyboardType="numeric" placeholder="3" />
              <Input label="Semester" value={form.semester} onChangeText={(v) => setForm({ ...form, semester: v })} keyboardType="numeric" placeholder="1" />
              <Input label="Grade Letter (A+, A, B+…)" value={form.grade_letter} onChangeText={(v) => setForm({ ...form, grade_letter: v })} autoCapitalize="characters" placeholder="optional" />
              <Input label="Grade Point (0-4)" value={form.grade_point} onChangeText={(v) => setForm({ ...form, grade_point: v })} keyboardType="decimal-pad" placeholder="optional" />
              <Input label="CA Percentage (0-100)" value={form.ca_percentage} onChangeText={(v) => setForm({ ...form, ca_percentage: v })} keyboardType="numeric" placeholder="optional" />
              <ErrorText msg={err} />
              <Btn title="Save Module" onPress={save} loading={saving} />
              <Btn title="Cancel" onPress={() => { setShowForm(false); setErr(""); }} style={styles.cancelBtn} textStyle={{ color: COLORS.text }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// Attendance Screen
// ============================================================
function AttendanceScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ module_name: "", attended: "", total_sessions: "", semester: "1" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/users/${user.id}/attendance`);
      setRecords(data || []);
    } catch (_) {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.module_name) return setErr("Module name is required.");
    const att = parseInt(form.attended, 10) || 0;
    const tot = parseInt(form.total_sessions, 10) || 0;
    if (att > tot) return setErr("Attended cannot exceed total sessions.");
    setSaving(true);
    try {
      const { data } = await api.post("/attendance", { user_id: user.id, module_name: form.module_name.trim(), attended: att, total_sessions: tot, semester: parseInt(form.semester, 10) || null });
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ module_name: "", attended: "", total_sessions: "", semester: "1" });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getColor = (pct) => {
    if (pct >= 80) return COLORS.success;
    if (pct >= 60) return COLORS.warning;
    return COLORS.danger;
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.screen}>
      <FlatList
        data={records}
        keyExtractor={(r) => String(r._id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Attendance</Text>
            <Btn title="+ Add Record" onPress={() => setShowForm(true)} style={styles.addBtn} />
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No attendance records yet.</Text>}
        renderItem={({ item: r }) => {
          const pct = r.total_sessions ? ((r.attended / r.total_sessions) * 100).toFixed(1) : 0;
          return (
            <Card style={styles.attendCard}>
              <Text style={styles.attendModule}>{r.module_name}</Text>
              <Text style={styles.attendMeta}>Sem {r.semester} | {r.attended}/{r.total_sessions} sessions</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: getColor(pct) }]} />
              </View>
              <Text style={[styles.attendPct, { color: getColor(pct) }]}>{pct}%</Text>
            </Card>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Attendance</Text>
            <Input label="Module Name *" value={form.module_name} onChangeText={(v) => setForm({ ...form, module_name: v })} placeholder="e.g. Data Structures" />
            <Input label="Sessions Attended" value={form.attended} onChangeText={(v) => setForm({ ...form, attended: v })} keyboardType="numeric" placeholder="0" />
            <Input label="Total Sessions" value={form.total_sessions} onChangeText={(v) => setForm({ ...form, total_sessions: v })} keyboardType="numeric" placeholder="0" />
            <Input label="Semester" value={form.semester} onChangeText={(v) => setForm({ ...form, semester: v })} keyboardType="numeric" placeholder="1" />
            <ErrorText msg={err} />
            <Btn title="Save" onPress={save} loading={saving} />
            <Btn title="Cancel" onPress={() => { setShowForm(false); setErr(""); }} style={styles.cancelBtn} textStyle={{ color: COLORS.text }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// Tasks Screen
// ============================================================
function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", module_code: "", due_date: "", priority_score: "5" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/users/${user.id}/tasks`);
      setTasks(data || []);
    } catch (_) {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.title.trim()) return setErr("Title is required.");
    setSaving(true);
    try {
      const { data } = await api.post("/tasks", { user_id: user.id, title: form.title.trim(), module_code: form.module_code.trim() || null, due_date: form.due_date || null, priority_score: parseInt(form.priority_score, 10) || 5 });
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ title: "", module_code: "", due_date: "", priority_score: "5" });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id, completed) => {
    await api.patch(`/tasks/${id}`, { completed: !completed });
    load();
  };

  const deleteTask = async (id) => {
    Alert.alert("Delete", "Remove this task?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/tasks/${id}`); load(); } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <View style={styles.screen}>
      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(t) => String(t._id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Tasks</Text>
            <Btn title="+ Add Task" onPress={() => setShowForm(true)} style={styles.addBtn} />
            {pending.length > 0 ? <Text style={styles.subSection}>Pending ({pending.length})</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks yet. Add your first task!</Text>}
        renderItem={({ item: t, index }) => {
          const isFirstDone = index === pending.length && done.length > 0;
          return (
            <View>
              {isFirstDone ? <Text style={styles.subSection}>Completed ({done.length})</Text> : null}
              <Card style={[styles.taskItemCard, t.completed && styles.taskDoneCard]}>
                <TouchableOpacity onPress={() => toggle(t._id, t.completed)} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.checkbox, t.completed && styles.checkboxDone]}>
                    {t.completed ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.taskItemTitle, t.completed && styles.taskDoneText]}>{t.title}</Text>
                    <Text style={styles.taskMeta}>
                      {t.module_code ? `${t.module_code} · ` : ""}
                      {t.due_date ? `Due ${new Date(t.due_date).toDateString()}` : ""}
                      {` · Priority ${t.priority_score}/10`}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteTask(t._id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </Card>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <Input label="Task Title *" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="e.g. Submit Lab Report" />
            <Input label="Module Code" value={form.module_code} onChangeText={(v) => setForm({ ...form, module_code: v })} autoCapitalize="characters" placeholder="optional" />
            <Input label="Due Date (YYYY-MM-DD)" value={form.due_date} onChangeText={(v) => setForm({ ...form, due_date: v })} placeholder="optional" />
            <Input label="Priority (1–10)" value={form.priority_score} onChangeText={(v) => setForm({ ...form, priority_score: v })} keyboardType="numeric" placeholder="5" />
            <ErrorText msg={err} />
            <Btn title="Save Task" onPress={save} loading={saving} />
            <Btn title="Cancel" onPress={() => { setShowForm(false); setErr(""); }} style={styles.cancelBtn} textStyle={{ color: COLORS.text }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// GPA Planner Screen
// ============================================================
function GPAPlannerScreen() {
  const { user } = useAuth();
  const [form, setForm] = useState({ targetGpa: "3.5", totalCredits: "120", completedCredits: "", currentPoints: "", totalModules: "" });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const calculate = () => {
    setErr("");
    setResult(null);
    const targetGpa = parseFloat(form.targetGpa);
    const totalCredits = parseFloat(form.totalCredits);
    const completedCredits = parseFloat(form.completedCredits) || 0;
    const currentPoints = parseFloat(form.currentPoints) || 0;
    const totalModules = parseInt(form.totalModules, 10) || 0;

    if (isNaN(targetGpa) || targetGpa < 0 || targetGpa > 4) return setErr("Target GPA must be between 0 and 4.0");
    if (!totalCredits || totalCredits <= 0) return setErr("Total credits must be greater than 0");
    if (completedCredits < 0 || currentPoints < 0) return setErr("Completed credits and current points cannot be negative");

    const remainingCredits = totalCredits - completedCredits;
    if (remainingCredits <= 0) {
      return setResult({ message: "No remaining credits. Your GPA is already fixed from completed modules.", remainingCredits: 0 });
    }
    const requiredTotalPoints = targetGpa * totalCredits;
    const remainingPoints = requiredTotalPoints - currentPoints;
    const requiredRemainingGPA = remainingPoints / remainingCredits;

    let suggestedGrade = "–";
    let requiredCA = "–";
    if (requiredRemainingGPA >= 3.7) { suggestedGrade = "A-"; requiredCA = "80%+"; }
    else if (requiredRemainingGPA >= 3.3) { suggestedGrade = "B+"; requiredCA = "75%+"; }
    else if (requiredRemainingGPA >= 3.0) { suggestedGrade = "B"; requiredCA = "70%+"; }
    else if (requiredRemainingGPA >= 2.7) { suggestedGrade = "B-"; requiredCA = "65%+"; }
    else if (requiredRemainingGPA >= 2.3) { suggestedGrade = "C+"; requiredCA = "60%+"; }
    else if (requiredRemainingGPA >= 2.0) { suggestedGrade = "C"; requiredCA = "55%+"; }
    else if (requiredRemainingGPA >= 1.0) { suggestedGrade = "D"; requiredCA = "–"; }
    else { suggestedGrade = "F"; requiredCA = "–"; }

    const perModulePoints = totalModules > 0 ? remainingPoints / totalModules : null;
    setResult({ remainingCredits, requiredRemainingGPA: requiredRemainingGPA.toFixed(2), remainingPoints: remainingPoints.toFixed(2), requiredCgpa: targetGpa.toFixed(2), perModulePoints: perModulePoints ? perModulePoints.toFixed(2) : null, suggestedGrade, requiredCA });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.pageTitle}>GPA Goal Planner</Text>
      <Card>
        <Input label="Target CGPA (0–4)" value={form.targetGpa} onChangeText={(v) => setForm({ ...form, targetGpa: v })} keyboardType="decimal-pad" />
        <Input label="Total Programme Credits" value={form.totalCredits} onChangeText={(v) => setForm({ ...form, totalCredits: v })} keyboardType="numeric" />
        <Input label="Completed Credits" value={form.completedCredits} onChangeText={(v) => setForm({ ...form, completedCredits: v })} keyboardType="numeric" placeholder="0" />
        <Input label="Current Weighted Points" value={form.currentPoints} onChangeText={(v) => setForm({ ...form, currentPoints: v })} keyboardType="decimal-pad" placeholder="sum of grade_point × credits" />
        <Input label="Remaining Modules Count" value={form.totalModules} onChangeText={(v) => setForm({ ...form, totalModules: v })} keyboardType="numeric" placeholder="optional" />
        <ErrorText msg={err} />
        <Btn title="Calculate" onPress={calculate} />
      </Card>

      {result ? (
        <Card style={{ marginTop: 16 }}>
          {result.message ? (
            <Text style={styles.plannerMsg}>{result.message}</Text>
          ) : (
            <>
              <PlannerRow label="Target CGPA" value={result.requiredCgpa} />
              <PlannerRow label="Remaining Credits" value={result.remainingCredits} />
              <PlannerRow label="Required GPA for Remaining" value={result.requiredRemainingGPA} highlight />
              <PlannerRow label="Remaining Grade Points Needed" value={result.remainingPoints} />
              <PlannerRow label="Suggested Grade" value={result.suggestedGrade} />
              <PlannerRow label="Required CA" value={result.requiredCA} />
              {result.perModulePoints ? <PlannerRow label="Points Needed Per Module" value={result.perModulePoints} /> : null}
            </>
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function PlannerRow({ label, value, highlight }) {
  return (
    <View style={styles.plannerRow}>
      <Text style={styles.plannerLabel}>{label}</Text>
      <Text style={[styles.plannerValue, highlight && { color: COLORS.primary, fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

// ============================================================
// Profile Screen
// ============================================================
function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", index_number: user?.index_number || "", target_gpa: user?.target_gpa ? String(user.target_gpa) : "", target_attendance: user?.target_attendance ? String(user.target_attendance) : "80", notify_deadlines: user?.notify_deadlines ?? true, deadline_reminder_days: user?.deadline_reminder_days ? String(user.deadline_reminder_days) : "3" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const save = async () => {
    setErr("");
    setSuccess(false);
    setSaving(true);
    try {
      const { data } = await api.put(`/users/${user.id}/profile`, {
        name: form.name.trim(),
        index_number: form.index_number.trim() || null,
        target_gpa: form.target_gpa ? parseFloat(form.target_gpa) : null,
        target_attendance: parseInt(form.target_attendance, 10) || 80,
        notify_deadlines: form.notify_deadlines,
        deadline_reminder_days: parseInt(form.deadline_reminder_days, 10) || 3,
      });
      if (data.error) throw new Error(data.error);
      await refreshUser();
      setSuccess(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "This will permanently delete your account and all data. This cannot be undone.", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await api.delete(`/users/${user.id}`);
          logout();
        }
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.pageTitle}>Profile</Text>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "U"}</Text>
      </View>
      <Text style={styles.profileEmail}>{user?.email}</Text>
      <Text style={styles.profileRole}>{user?.role === "admin" ? "👑 Admin" : "🎓 Student"}</Text>

      <Card style={{ marginTop: 16 }}>
        <Input label="Full Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Input label="Index / Registration Number" value={form.index_number} onChangeText={(v) => setForm({ ...form, index_number: v })} />
        <Input label="Target GPA (0–4)" value={form.target_gpa} onChangeText={(v) => setForm({ ...form, target_gpa: v })} keyboardType="decimal-pad" />
        <Input label="Target Attendance (%)" value={form.target_attendance} onChangeText={(v) => setForm({ ...form, target_attendance: v })} keyboardType="numeric" />
        <Input label="Deadline Reminder Days" value={form.deadline_reminder_days} onChangeText={(v) => setForm({ ...form, deadline_reminder_days: v })} keyboardType="numeric" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Deadline Notifications</Text>
          <Switch value={form.notify_deadlines} onValueChange={(v) => setForm({ ...form, notify_deadlines: v })} thumbColor={form.notify_deadlines ? COLORS.primary : "#ccc"} />
        </View>
        {err ? <ErrorText msg={err} /> : null}
        {success ? <Text style={styles.successText}>Profile saved ✓</Text> : null}
        <Btn title="Save Profile" onPress={save} loading={saving} />
      </Card>

      <Btn title="Sign Out" onPress={logout} style={styles.signOutBtn} />
      <Btn title="Delete Account" onPress={handleDeleteAccount} style={styles.dangerBtn} />
    </ScrollView>
  );
}

// ============================================================
// Concerns Screen
// ============================================================
function ConcernsScreen() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ university_id: "", category: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([api.get(`/users/${user.id}/concerns`), api.get("/universities")]);
      setConcerns(c.data || []);
      setUniversities(u.data || []);
    } catch (_) {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.university_id) return setErr("Please select a university.");
    if (!form.message.trim()) return setErr("Message is required.");
    setSaving(true);
    try {
      const { data } = await api.post("/concerns", { user_id: user.id, university_id: form.university_id, category: form.category || null, message: form.message.trim() });
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ university_id: "", category: "", message: "" });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (s) => ({ open: COLORS.warning, forwarded: COLORS.success, closed: COLORS.secondary }[s] || COLORS.secondary);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.screen}>
      <FlatList
        data={concerns}
        keyExtractor={(c) => String(c._id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Concerns</Text>
            <Btn title="+ Submit Concern" onPress={() => setShowForm(true)} style={styles.addBtn} />
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No concerns submitted yet.</Text>}
        renderItem={({ item: c }) => (
          <Card>
            {c.category ? <Text style={styles.concernCategory}>{c.category}</Text> : null}
            <Text style={styles.concernMsg}>{c.message}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={styles.concernMeta}>{new Date(c.created_at).toDateString()}</Text>
              <Text style={[styles.statusBadge, { backgroundColor: statusColor(c.status) }]}>{c.status}</Text>
            </View>
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Submit Concern</Text>
            <Text style={styles.inputLabel}>University *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {universities.map((u) => (
                <TouchableOpacity
                  key={String(u._id)}
                  onPress={() => setForm({ ...form, university_id: String(u._id) })}
                  style={[styles.uniChip, form.university_id === String(u._id) && styles.uniChipActive]}
                >
                  <Text style={[styles.uniChipText, form.university_id === String(u._id) && { color: "#fff" }]}>{u.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Input label="Category (optional)" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} placeholder="e.g. Academic, Infrastructure" />
            <Input label="Message *" value={form.message} onChangeText={(v) => setForm({ ...form, message: v })} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: "top" }} placeholder="Describe your concern…" />
            <ErrorText msg={err} />
            <Btn title="Submit" onPress={save} loading={saving} />
            <Btn title="Cancel" onPress={() => { setShowForm(false); setErr(""); }} style={styles.cancelBtn} textStyle={{ color: COLORS.text }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// Navigation
// ============================================================
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Dashboard: "🏠",
  Modules: "📚",
  Attendance: "✅",
  Tasks: "📝",
  Planner: "🎯",
  Concerns: "📢",
  Profile: "👤",
};

function MainTabs() {
  const { user } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name] || "●"}</Text>,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "#999",
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 10 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Modules" component={ModulesScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Planner" component={GPAPlannerScreen} />
      <Tab.Screen name="Concerns" component={ConcernsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ============================================================
// App Entry
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

// ============================================================
// Theme & Styles
// ============================================================
const COLORS = {
  primary: "#4F46E5",
  secondary: "#6B7280",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  background: "#F9FAFB",
  card: "#FFFFFF",
  text: "#111827",
  textLight: "#6B7280",
  border: "#E5E7EB",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },

  // Auth
  authContainer: { flex: 1, backgroundColor: COLORS.background },
  authInner: { padding: 24, paddingTop: 80 },
  appTitle: { fontSize: 32, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  appSubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: "center", marginBottom: 32 },
  linkText: { color: COLORS.primary, fontSize: 14 },

  // Input
  inputWrap: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: COLORS.secondary, marginBottom: 4, textTransform: "uppercase" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text },

  // Button
  btn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  addBtn: { marginBottom: 12 },
  cancelBtn: { backgroundColor: COLORS.border, marginTop: 8 },
  signOutBtn: { backgroundColor: COLORS.secondary, marginTop: 20 },
  dangerBtn: { backgroundColor: COLORS.danger, marginTop: 10 },

  // Card
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

  // Text helpers
  pageTitle: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 8, marginBottom: 8 },
  subSection: { fontSize: 13, fontWeight: "700", color: COLORS.secondary, marginVertical: 6, textTransform: "uppercase" },
  emptyText: { color: COLORS.textLight, textAlign: "center", marginTop: 24, fontSize: 14 },
  errorText: { color: COLORS.danger, fontSize: 13, marginBottom: 8 },
  successText: { color: COLORS.success, fontSize: 13, marginBottom: 8 },
  cardLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  cardSubText: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: "center", borderTopWidth: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 2, textTransform: "uppercase" },

  // Progress
  progressBarBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 4, marginVertical: 6, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 4 },

  // Module
  moduleCard: { marginBottom: 10 },
  moduleCode: { fontSize: 12, fontWeight: "700", color: COLORS.primary, textTransform: "uppercase" },
  moduleName: { fontSize: 15, fontWeight: "600", color: COLORS.text, marginTop: 2 },
  moduleMeta: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },

  // Attendance
  attendCard: { marginBottom: 10 },
  attendModule: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  attendMeta: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  attendPct: { fontSize: 13, fontWeight: "700", textAlign: "right" },

  // Tasks
  taskCard: { marginBottom: 8 },
  taskTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  taskMeta: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  taskItemCard: { marginBottom: 8 },
  taskDoneCard: { opacity: 0.55 },
  taskItemTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  taskDoneText: { textDecorationLine: "line-through", color: COLORS.textLight },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, justifyContent: "center", alignItems: "center" },
  checkboxDone: { backgroundColor: COLORS.primary },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Semester
  semCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  semLabel: { fontSize: 14, color: COLORS.text },
  semGpa: { fontSize: 18, fontWeight: "800", color: COLORS.primary },

  // Delete
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 16, color: COLORS.danger },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%", paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginBottom: 16 },

  // Profile
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 8 },
  avatarText: { fontSize: 36, color: "#fff", fontWeight: "800" },
  profileEmail: { textAlign: "center", color: COLORS.textLight, fontSize: 14 },
  profileRole: { textAlign: "center", color: COLORS.text, fontWeight: "600", marginTop: 4, marginBottom: 12 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  switchLabel: { fontSize: 14, color: COLORS.text },

  // Concerns
  concernCategory: { fontSize: 12, fontWeight: "700", color: COLORS.primary, textTransform: "uppercase", marginBottom: 4 },
  concernMsg: { fontSize: 14, color: COLORS.text },
  concernMeta: { fontSize: 12, color: COLORS.textLight },
  statusBadge: { fontSize: 11, color: "#fff", fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, textTransform: "uppercase", overflow: "hidden" },
  uniChip: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  uniChipActive: { backgroundColor: COLORS.primary },
  uniChipText: { fontSize: 12, color: COLORS.primary, fontWeight: "600" },

  // Planner
  plannerMsg: { color: COLORS.textLight, textAlign: "center", fontSize: 14 },
  plannerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  plannerLabel: { fontSize: 14, color: COLORS.secondary },
  plannerValue: { fontSize: 14, fontWeight: "600", color: COLORS.text },
});
