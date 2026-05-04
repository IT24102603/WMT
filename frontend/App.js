import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, RefreshControl, Modal, Switch, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// ============================================================
// CONFIGURATION
// ============================================================
const API_BASE = "https://wmt-tbo4.onrender.com"; // ← Change to your server IP/URL

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================================================
// CONSTANTS
// ============================================================
const GRADE_POINTS = {
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D": 1.0, "E": 0.5, "F": 0,
};

const GRADE_OPTIONS = ["A+","A","A-","B+","B","B-","C+","C","C-","D","E","F"];

const COLORS = {
  bg:        "#0f1419",
  bgCard:    "#1a2332",
  bgElevated:"#243044",
  border:    "#2d3a4f",
  text:      "#e6edf3",
  textMuted: "#8b9cb8",
  accent:    "#00c9a7",
  accentDim: "#00a88a",
  warning:   "#f59e0b",
  danger:    "#ef4444",
  success:   "#10b981",
};

// ============================================================
// AUTH CONTEXT
// ============================================================
const AuthContext = createContext(null);
function useAuth() { return useContext(AuthContext); }

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
// SHARED UI PRIMITIVES
// ============================================================
function Btn({ title, onPress, style, textStyle, disabled, loading: busy, danger, ghost, small }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        styles.btn,
        danger && styles.btnDanger,
        ghost && styles.btnGhost,
        small && styles.btnSmall,
        style,
        (disabled || busy) && { opacity: 0.55 },
      ]}
    >
      {busy ? <ActivityIndicator color={ghost ? COLORS.textMuted : "#fff"} size="small" />
             : <Text style={[styles.btnText, ghost && styles.btnGhostText, danger && { color: "#fff" }, small && { fontSize: 13 }, textStyle]}>{title}</Text>}
    </TouchableOpacity>
  );
}

function Input({ label, style, ...props }) {
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput style={styles.input} placeholderTextColor={COLORS.textMuted} {...props} />
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ title, sub }) {
  return (
    <View style={{ marginBottom: 10, marginTop: 4 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.subtitle}>{sub}</Text> : null}
    </View>
  );
}

function ErrorText({ msg }) {
  if (!msg) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTxt}>{msg}</Text>
    </View>
  );
}

function SuccessText({ msg }) {
  if (!msg) return null;
  return (
    <View style={styles.successBox}>
      <Text style={styles.successTxt}>{msg}</Text>
    </View>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color || COLORS.accent }]}>
      <Text style={[styles.statValue, { color: color || COLORS.accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressBar({ pct, color }) {
  const clamp = Math.min(100, Math.max(0, pct || 0));
  const barColor = color || (clamp >= 80 ? COLORS.success : clamp >= 60 ? COLORS.warning : COLORS.danger);
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${clamp}%`, backgroundColor: barColor }]} />
    </View>
  );
}

function PlannerRow({ label, value, highlight }) {
  return (
    <View style={styles.plannerRow}>
      <Text style={styles.plannerLabel}>{label}</Text>
      <Text style={[styles.plannerValue, highlight && { color: COLORS.accent, fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

function PickerModal({ visible, items, value, onSelect, onClose, title }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { paddingBottom: 30 }]}>
          <Text style={styles.modalTitle}>{title || "Select"}</Text>
          <ScrollView>
            {items.map((item) => (
              <TouchableOpacity
                key={String(item.value)}
                onPress={() => { onSelect(item.value); onClose(); }}
                style={[styles.pickerItem, item.value === value && styles.pickerItemActive]}
              >
                <Text style={[styles.pickerItemText, item.value === value && { color: COLORS.accent }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Btn title="Cancel" ghost onPress={onClose} style={{ marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}

function SelectField({ label, value, placeholder, items, onSelect, style }) {
  const [open, setOpen] = useState(false);
  const display = items.find(i => i.value === value)?.label || placeholder || "Select…";
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TouchableOpacity style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? COLORS.text : COLORS.textMuted }}>{display}</Text>
      </TouchableOpacity>
      <PickerModal visible={open} items={items} value={value} onSelect={onSelect} onClose={() => setOpen(false)} title={label || "Select"} />
    </View>
  );
}

// ============================================================
// LOGIN SCREEN
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
    try { await login(email.trim(), password); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authContainer}>
      <ScrollView contentContainerStyle={styles.authInner} keyboardShouldPersistTaps="handled">
        <Text style={styles.appTitle}>UniNavigator</Text>
        <Text style={styles.appSubtitle}>Academic Performance Manager</Text>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@university.lk" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" />
        <ErrorText msg={err} />
        <Btn title="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />
        <TouchableOpacity onPress={() => navigation.navigate("Register")} style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={styles.linkText}>Don't have an account? <Text style={{ color: COLORS.accent }}>Register</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// REGISTER SCREEN
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email address.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      Alert.alert("Success", "Account created! Please sign in.");
      navigation.goBack();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authContainer}>
      <ScrollView contentContainerStyle={styles.authInner} keyboardShouldPersistTaps="handled">
        <Text style={styles.appTitle}>Create Account</Text>
        <Input label="Full Name" value={name} onChangeText={setName} placeholder="John Doe" />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@university.lk" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Min. 6 characters" />
        <ErrorText msg={err} />
        <Btn title="Register" onPress={handleRegister} loading={loading} style={{ marginTop: 8 }} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={styles.linkText}>Already have an account? <Text style={{ color: COLORS.accent }}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// DASHBOARD SCREEN
// ============================================================
function DashboardScreen() {
  const { user } = useAuth();
  if (!user) return null;
  const [gpaData, setGpaData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deadlines, setDeadlines] = useState([]);

  const load = useCallback(async () => {
    try {
      const [g, t, a] = await Promise.all([
        api.get(`/users/${user.id}/gpa`),
        api.get(`/users/${user.id}/tasks`),
        api.get(`/users/${user.id}/attendance`),
      ]);
      setGpaData(g.data);
      const taskList = t.data || [];
      setTasks(taskList);
      setAttendance(a.data || []);

      // Check upcoming deadlines
      const days = Math.min(30, Math.max(1, parseInt(user.deadline_reminder_days, 10) || 3));
      if (user.notify_deadlines !== false) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = taskList.filter(t2 => {
          if (t2.completed || !t2.due_date) return false;
          const due = new Date(t2.due_date);
          due.setHours(0, 0, 0, 0);
          const diff = Math.ceil((due - today) / 86400000);
          return diff >= 0 && diff <= days;
        });
        setDeadlines(upcoming.slice(0, 5));
      }
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const pendingTasks = tasks.filter(t => !t.completed);
  const avgAtt = attendance.length
    ? (attendance.reduce((s, a) => s + (a.total_sessions ? (a.attended / a.total_sessions) * 100 : 0), 0) / attendance.length).toFixed(1)
    : null;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Welcome, {user?.name?.split(" ")[0]} 👋</Text>

      {/* Deadline Alert */}
      {deadlines.length > 0 && (
        <Card style={styles.alertCard}>
          <Text style={{ color: COLORS.warning, fontWeight: "700", marginBottom: 4 }}>⏰ Upcoming Deadlines</Text>
          {deadlines.map(t => {
            const due = new Date(t.due_date);
            const today = new Date(); today.setHours(0,0,0,0);
            const diff = Math.ceil((due - today) / 86400000);
            const dayText = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff} days`;
            return (
              <Text key={String(t.id || t._id)} style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 2 }}>
                • {t.title} — <Text style={{ color: COLORS.warning }}>{dayText}</Text>
              </Text>
            );
          })}
        </Card>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatCard label="CGPA" value={gpaData?.overall?.gpa?.toFixed(2) ?? "—"} color={COLORS.accent} />
        <StatCard label="Credits" value={gpaData?.overall?.credits ?? "—"} color="#818cf8" />
        <StatCard label="Attendance" value={avgAtt ? `${avgAtt}%` : "—"} color={COLORS.success} />
      </View>

      {/* GPA Progress */}
      {user.target_gpa ? (
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.cardLabel}>GPA Progress</Text>
          <ProgressBar pct={Math.min(100, ((gpaData?.overall?.gpa ?? 0) / 4) * 100)} color={COLORS.accent} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={styles.cardSubText}>Current: {gpaData?.overall?.gpa?.toFixed(2) ?? "0.00"} / 4.00</Text>
            <Text style={styles.cardSubText}>Target: {user.target_gpa}</Text>
          </View>
        </Card>
      ) : null}

      {/* Semester GPAs */}
      {(gpaData?.semesters || []).length > 0 && (
        <>
          <SectionTitle title="Semester GPAs" />
          {gpaData.semesters.map(s => (
            <Card key={`${s.semester}-${s.academic_year}`} style={styles.semCard}>
              <Text style={styles.semLabel}>Year {s.academic_year || "–"} / Sem {s.semester_in_year || s.semester}</Text>
              <Text style={styles.semGpa}>{s.gpa?.toFixed(2)}</Text>
            </Card>
          ))}
        </>
      )}

      {/* Pending Tasks */}
      <SectionTitle title={`Pending Tasks (${pendingTasks.length})`} />
      {pendingTasks.slice(0, 5).map(t => (
        <Card key={String(t.id || t._id)} style={{ marginBottom: 8 }}>
          <Text style={{ color: COLORS.text, fontWeight: "600" }}>{t.title}</Text>
          {t.due_date ? <Text style={styles.cardSubText}>Due: {new Date(t.due_date).toDateString()}</Text> : null}
          {t.module_code ? <Text style={styles.cardSubText}>Module: {t.module_code}</Text> : null}
        </Card>
      ))}
      {pendingTasks.length === 0 && <Text style={styles.emptyText}>No pending tasks 🎉</Text>}
    </ScrollView>
  );
}

// ============================================================
// GPA CALCULATOR SCREEN
// ============================================================
function GPAScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    name: "", code: "", credits: "3", grade_letter: "",
    ca_percentage: "", academic_year: "1", semester_in_year: "1", university_id: "",
  });

  // Planner state
  const [plan, setPlan] = useState({ targetGpa: "3.5", academicYear: "1", semesterInYear: "1", totalModules: "5", creditsPerModule: "3" });
  const [planResult, setPlanResult] = useState(null);
  const [planErr, setPlanErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, u] = await Promise.all([
        api.get(`/users/${user.id}/modules`),
        api.get("/universities"),
      ]);
      setModules(m.data || []);
      setUniversities(u.data || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.name || !form.code) return setErr("Name and code are required.");
    setSaving(true);
    try {
      const academic_year = parseInt(form.academic_year, 10) || 1;
      const semester_in_year = parseInt(form.semester_in_year, 10) || 1;
      const payload = {
        user_id: user.id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        credits: parseInt(form.credits, 10) || 3,
        grade_letter: form.grade_letter || undefined,
        grade_point: form.grade_letter ? GRADE_POINTS[form.grade_letter] : undefined,
        ca_percentage: form.ca_percentage ? parseInt(form.ca_percentage, 10) : undefined,
        academic_year,
        semester_in_year,
        semester: (academic_year - 1) * 2 + semester_in_year,
        university_id: form.university_id || undefined,
      };
      const { data } = await api.post("/modules", payload);
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ name: "", code: "", credits: "3", grade_letter: "", ca_percentage: "", academic_year: "1", semester_in_year: "1", university_id: "" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const deleteModule = (id) => {
    Alert.alert("Delete Module", "Remove this module?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/modules/${id}`); load(); } },
    ]);
  };

  const calculatePlan = () => {
    setPlanErr(""); setPlanResult(null);
    const target = parseFloat(plan.targetGpa);
    const ay = parseInt(plan.academicYear, 10) || 1;
    const sy = parseInt(plan.semesterInYear, 10) || 1;
    const mods = parseInt(plan.totalModules, 10) || 0;
    const cpm = parseInt(plan.creditsPerModule, 10) || 3;
    if (isNaN(target) || target < 0 || target > 4) return setPlanErr("Target GPA must be 0–4.");
    if (mods < 1) return setPlanErr("Enter number of modules.");

    // GPA data for semesters prior to this one
    const semester = (ay - 1) * 2 + sy;
    const prevMods = modules.filter(m => m.semester < semester && m.grade_point != null);
    const prevCredits = prevMods.reduce((s, m) => s + m.credits, 0);
    const prevPoints = prevMods.reduce((s, m) => s + m.grade_point * m.credits, 0);

    const remCredits = mods * cpm;
    const totalCredits = prevCredits + remCredits;
    const reqTotalPoints = target * totalCredits;
    const reqRemPoints = reqTotalPoints - prevPoints;
    const reqRemGPA = reqRemPoints / remCredits;

    let suggested = "—";
    if (reqRemGPA >= 4.0) suggested = "A / A+";
    else if (reqRemGPA >= 3.7) suggested = "A-";
    else if (reqRemGPA >= 3.3) suggested = "B+";
    else if (reqRemGPA >= 3.0) suggested = "B";
    else if (reqRemGPA >= 2.7) suggested = "B-";
    else if (reqRemGPA >= 2.3) suggested = "C+";
    else if (reqRemGPA >= 2.0) suggested = "C";
    else if (reqRemGPA >= 1.0) suggested = "D";
    else suggested = "Difficult";

    setPlanResult({ reqRemGPA: Math.max(0, reqRemGPA).toFixed(2), target: target.toFixed(2), remCredits, suggested });
  };

  // Group by academic year + semester
  const grouped = {};
  for (const m of modules) {
    const key = `Year ${m.academic_year || "–"} / Sem ${m.semester_in_year || "–"}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  const gpa = modules.length
    ? (modules.filter(m=>m.grade_point != null).reduce((s, m)=>s + m.grade_point * m.credits, 0) /
       Math.max(1, modules.filter(m=>m.grade_point != null).reduce((s, m)=>s + m.credits, 0))).toFixed(2)
    : "—";
  const totalCredits = modules.reduce((s, m) => s + (m.credits || 0), 0);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>GPA Calculator</Text>
      <Text style={styles.subtitle}>Weighted GPA = Σ(GradePoints × Credits) / Σ(Credits)</Text>

      {/* Summary */}
      <View style={styles.statsRow}>
        <StatCard label="CGPA" value={gpa} color={COLORS.accent} />
        <StatCard label="Credits" value={totalCredits} color="#818cf8" />
        <StatCard label="Modules" value={modules.length} color={COLORS.success} />
      </View>

      {/* Add Module */}
      <Btn title="+ Add Module" onPress={() => setShowForm(true)} style={{ marginBottom: 16 }} />

      {/* Modules grouped */}
      {Object.keys(grouped).map(key => (
        <View key={key} style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: COLORS.accent }]}>{key}</Text>
          {grouped[key].map(m => (
            <Card key={String(m.id || m._id)} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.accent, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{m.code}</Text>
                  <Text style={{ color: COLORS.text, fontWeight: "600", marginTop: 2 }}>{m.name}</Text>
                  <Text style={styles.cardSubText}>
                    Credits: {m.credits}
                    {m.grade_letter ? ` · Grade: ${m.grade_letter}` : ""}
                    {m.ca_percentage != null ? ` · CA: ${m.ca_percentage}%` : ""}
                    {m.grade_point != null ? ` · GP: ${m.grade_point}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteModule(m.id || m._id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      ))}
      {modules.length === 0 && <Text style={styles.emptyText}>No modules yet. Add your first module!</Text>}

      {/* Goal Planner */}
      <SectionTitle title="Goal Planner" sub="Enter your target GPA to see what you need to achieve it." />
      <Card>
        <Input label="Target GPA (0–4)" value={plan.targetGpa} onChangeText={v => setPlan({...plan, targetGpa: v})} keyboardType="decimal-pad" />
        <Input label="Academic Year" value={plan.academicYear} onChangeText={v => setPlan({...plan, academicYear: v})} keyboardType="numeric" />
        <Input label="Semester in Year" value={plan.semesterInYear} onChangeText={v => setPlan({...plan, semesterInYear: v})} keyboardType="numeric" />
        <Input label="Total Modules This Semester" value={plan.totalModules} onChangeText={v => setPlan({...plan, totalModules: v})} keyboardType="numeric" />
        <Input label="Credits Per Module" value={plan.creditsPerModule} onChangeText={v => setPlan({...plan, creditsPerModule: v})} keyboardType="numeric" />
        <ErrorText msg={planErr} />
        <Btn title="Calculate Required Marks" onPress={calculatePlan} />
        {planResult && (
          <View style={{ marginTop: 12 }}>
            <PlannerRow label="Target CGPA" value={planResult.target} />
            <PlannerRow label="Remaining Credits" value={planResult.remCredits} />
            <PlannerRow label="Required GPA for Remaining Mods" value={planResult.reqRemGPA} highlight />
            <PlannerRow label="Suggested Grade" value={planResult.suggested} />
          </View>
        )}
      </Card>

      {/* Add Module Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Module</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField
                label="University"
                value={form.university_id}
                placeholder="Select university"
                items={universities.map(u => ({ label: u.name, value: String(u.id) }))}
                onSelect={v => setForm({...form, university_id: v})}
              />
              <Input label="Module Name *" value={form.name} onChangeText={v => setForm({...form, name: v})} placeholder="e.g. Data Structures" />
              <Input label="Module Code *" value={form.code} onChangeText={v => setForm({...form, code: v})} placeholder="e.g. IT2030" autoCapitalize="characters" />
              <Input label="Credits" value={form.credits} onChangeText={v => setForm({...form, credits: v})} keyboardType="numeric" />
              <Input label="Academic Year" value={form.academic_year} onChangeText={v => setForm({...form, academic_year: v})} keyboardType="numeric" placeholder="1" />
              <Input label="Semester in Year (1–3)" value={form.semester_in_year} onChangeText={v => setForm({...form, semester_in_year: v})} keyboardType="numeric" />
              <SelectField
                label="Grade"
                value={form.grade_letter}
                placeholder="Select grade (optional)"
                items={[{ label: "– No grade –", value: "" }, ...GRADE_OPTIONS.map(g => ({ label: `${g} (${GRADE_POINTS[g]})`, value: g }))]}
                onSelect={v => setForm({...form, grade_letter: v})}
              />
              <Input label="CA %" value={form.ca_percentage} onChangeText={v => setForm({...form, ca_percentage: v})} keyboardType="numeric" placeholder="optional" />
              <ErrorText msg={err} />
              <Btn title="Save Module" onPress={save} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowForm(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// ATTENDANCE SCREEN
// ============================================================
function AttendanceScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [modules, setModules] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | checking | within | outside

  const [recForm, setRecForm] = useState({ module_id: "", attended: "", total_sessions: "", semester: "1", academic_year: "1", university_id: "", hall_id: "" });
  const [modForm, setModForm] = useState({ name: "", code: "", university_id: "", academic_year: "1", semester_in_year: "1" });
  const [halls, setHalls] = useState([]);

  const load = useCallback(async () => {
    try {
      const [a, m, u] = await Promise.all([
        api.get(`/users/${user.id}/attendance`),
        api.get(`/users/${user.id}/modules`),
        api.get("/universities"),
      ]);
      setRecords(a.data || []);
      setModules(m.data || []);
      setUniversities(u.data || []);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const loadHalls = async (uniId) => {
    if (!uniId) return setHalls([]);
    try {
      const { data } = await api.get(`/universities/${uniId}/halls`);
      setHalls(data || []);
    } catch (_) { setHalls([]); }
  };

  const checkGeofence = async () => {
    setLocationStatus("checking");
    try {
      let Location;
      try { Location = require("expo-location"); } catch (_) {
        Alert.alert("Location", "expo-location not installed. Run: expo install expo-location");
        setLocationStatus("idle");
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocationStatus("outside");
        Alert.alert("Permission Denied", "Location permission is required for geofence check.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = loc.coords;

      const selectedUniId = recForm.university_id;
      if (!selectedUniId) {
        Alert.alert("Select University", "Please select a university first.");
        setLocationStatus("idle");
        return;
      }

      const { data: hallList } = await api.get(`/universities/${selectedUniId}/halls`);
      const R = 6371000;
      const toRad = d => (d * Math.PI) / 180;

      let inside = false;
      for (const hall of hallList) {
        const dLat = toRad(hall.center_lat - lat);
        const dLon = toRad(hall.center_lng - lng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat)) * Math.cos(toRad(hall.center_lat)) * Math.sin(dLon/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (dist <= hall.radius_m) { inside = true; break; }
      }
      setLocationStatus(inside ? "within" : "outside");
    } catch (e) {
      setLocationStatus("outside");
      Alert.alert("Location Error", e.message);
    }
  };

  const saveRecord = async () => {
    setErr("");
    const att = parseInt(recForm.attended, 10) || 0;
    const tot = parseInt(recForm.total_sessions, 10) || 0;
    if (!recForm.module_id) return setErr("Select a module.");
    if (att > tot) return setErr("Attended cannot exceed total sessions.");
    setSaving(true);
    try {
      const mod = modules.find(m => String(m.id) === String(recForm.module_id));
      const { data } = await api.post("/attendance", {
        user_id: user.id,
        module_name: mod?.name || "",
        module_id: recForm.module_id,
        attended: att,
        total_sessions: tot,
        semester: parseInt(recForm.semester, 10) || null,
        academic_year: parseInt(recForm.academic_year, 10) || null,
        university_id: recForm.university_id || null,
        hall_id: recForm.hall_id || null,
      });
      if (data.error) throw new Error(data.error);
      setShowAddRecord(false);
      setRecForm({ module_id: "", attended: "", total_sessions: "", semester: "1", academic_year: "1", university_id: "", hall_id: "" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const saveModule = async () => {
  setErr("");
  if (!modForm.name || !modForm.university_id || !modForm.code.trim()) return setErr("Name, code, and university required.");
    setSaving(true);
    try {
      const ay = parseInt(modForm.academic_year, 10) || 1;
      const sy = parseInt(modForm.semester_in_year, 10) || 1;
      const { data } = await api.post("/modules", {
        user_id: user.id,
        name: modForm.name.trim(),
        code: modForm.code.trim().toUpperCase() || null,
        university_id: modForm.university_id,
        academic_year: ay,
        semester_in_year: sy,
        semester: (ay - 1) * 2 + sy,
        credits: 3,
      });
      if (data.error) throw new Error(data.error);
      setShowAddModule(false);
      setModForm({ name: "", code: "", university_id: "", academic_year: "1", semester_in_year: "1" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const getColor = pct => pct >= 80 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.danger;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Attendance Tracker</Text>
      <Text style={styles.subtitle}>80% rule – track sessions and safe absences</Text>

      {/* Geofence Card */}
      <Card style={styles.geofenceCard}>
        <Text style={{ color: COLORS.text, fontWeight: "700", marginBottom: 8 }}>📍 Geofence Check</Text>
        <SelectField
          label="University"
          value={recForm.university_id}
          placeholder="Select university"
          items={universities.map(u => ({ label: u.name, value: String(u.id) }))}
          onSelect={v => { setRecForm({...recForm, university_id: v, hall_id: ""}); loadHalls(v); }}
        />
        {locationStatus === "idle" && <Text style={styles.cardSubText}>Select your university then check your location.</Text>}
        {locationStatus === "checking" && <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 8 }} />}
        {locationStatus === "within" && (
          <View style={[styles.geofenceResult, { borderColor: COLORS.success }]}>
            <Text style={{ color: COLORS.success, fontWeight: "700" }}>✓ You're within the geofence! You can mark attendance.</Text>
          </View>
        )}
        {locationStatus === "outside" && (
          <View style={[styles.geofenceResult, { borderColor: COLORS.danger }]}>
            <Text style={{ color: COLORS.danger, fontWeight: "700" }}>⚠ You're outside the geofence. Move to the class area.</Text>
          </View>
        )}
        <Btn title="Check Location" onPress={checkGeofence} style={{ marginTop: 8 }} />
      </Card>

      {/* Action Buttons */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Btn title="+ Mark Attendance" onPress={() => setShowAddRecord(true)} style={{ flex: 1 }} disabled={locationStatus !== "within"} />
        <Btn title="+ Add Module" ghost onPress={() => setShowAddModule(true)} style={{ flex: 1 }} />
      </View>
      {locationStatus !== "within" && <Text style={[styles.cardSubText, { marginBottom: 12 }]}>Verify your location first to mark attendance.</Text>}

      {/* Records */}
      <SectionTitle title="By Module" />
      {records.length === 0 && <Text style={styles.emptyText}>No attendance records yet.</Text>}
      {records.map(r => {
        const pct = r.total_sessions ? ((r.attended / r.total_sessions) * 100) : 0;
        return (
          <Card key={String(r.id || r._id)} style={{ marginBottom: 8 }}>
            <Text style={{ color: COLORS.text, fontWeight: "600" }}>{r.module_name}</Text>
            <Text style={styles.cardSubText}>Sem {r.semester} · {r.attended}/{r.total_sessions} sessions</Text>
            <ProgressBar pct={pct} />
            <Text style={[{ fontSize: 13, fontWeight: "700", textAlign: "right", marginTop: 4 }, { color: getColor(pct) }]}>{pct.toFixed(1)}%</Text>
          </Card>
        );
      })}

      {/* Mark Attendance Modal */}
      <Modal visible={showAddRecord} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mark Attendance</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField
                label="Module *"
                value={recForm.module_id}
                placeholder="Select module"
                items={modules.map(m => ({ label: `${m.code ? m.code + " · " : ""}${m.name}`, value: String(m.id) }))}
                onSelect={v => setRecForm({...recForm, module_id: v})}
              />
              {halls.length > 0 && (
                <SelectField
                  label="Lecture Hall (optional)"
                  value={recForm.hall_id}
                  placeholder="Select hall"
                  items={[{ label: "— None —", value: "" }, ...halls.map(h => ({ label: h.name, value: String(h.id) }))]}
                  onSelect={v => setRecForm({...recForm, hall_id: v})}
                />
              )}
              <Input label="Sessions Attended" value={recForm.attended} onChangeText={v => setRecForm({...recForm, attended: v})} keyboardType="numeric" placeholder="0" />
              <Input label="Total Sessions" value={recForm.total_sessions} onChangeText={v => setRecForm({...recForm, total_sessions: v})} keyboardType="numeric" placeholder="0" />
              <Input label="Semester" value={recForm.semester} onChangeText={v => setRecForm({...recForm, semester: v})} keyboardType="numeric" />
              <Input label="Academic Year" value={recForm.academic_year} onChangeText={v => setRecForm({...recForm, academic_year: v})} keyboardType="numeric" />
              <ErrorText msg={err} />
              <Btn title="Mark Attendance" onPress={saveRecord} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowAddRecord(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Attendance Module Modal */}
      <Modal visible={showAddModule} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Module for Attendance</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField
                label="University *"
                value={modForm.university_id}
                placeholder="Select university"
                items={universities.map(u => ({ label: u.name, value: String(u.id) }))}
                onSelect={v => setModForm({...modForm, university_id: v})}
              />
              <Input label="Academic Year" value={modForm.academic_year} onChangeText={v => setModForm({...modForm, academic_year: v})} keyboardType="numeric" />
              <Input label="Semester in Year" value={modForm.semester_in_year} onChangeText={v => setModForm({...modForm, semester_in_year: v})} keyboardType="numeric" />
              <Input label="Module Name *" value={modForm.name} onChangeText={v => setModForm({...modForm, name: v})} placeholder="e.g. Database Systems" />
              <Input label="Code" value={modForm.code} onChangeText={v => setModForm({...modForm, code: v})} placeholder="e.g. CS205" autoCapitalize="characters" />
              <ErrorText msg={err} />
              <Btn title="Add Module" onPress={saveModule} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowAddModule(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// TASKS SCREEN
// ============================================================
function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", module_code: "", due_date: "", priority_score: "5" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/users/${user.id}/tasks`); setTasks(data || []); } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.title.trim()) return setErr("Title is required.");
    setSaving(true);
    try {
      const { data } = await api.post("/tasks", {
        user_id: user.id,
        title: form.title.trim(),
        module_code: form.module_code.trim() || null,
        due_date: form.due_date || null,
        priority_score: parseInt(form.priority_score, 10) || 5,
      });
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ title: "", module_code: "", due_date: "", priority_score: "5" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (id, completed) => {
    await api.patch(`/tasks/${id}`, { completed: !completed });
    load();
  };

  const deleteTask = (id) => {
    Alert.alert("Delete Task", "Remove this task?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/tasks/${id}`); load(); } },
    ]);
  };

  const getPriorityColor = (p) => p >= 8 ? COLORS.danger : p >= 5 ? COLORS.warning : COLORS.textMuted;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  const renderTask = (t) => (
    <Card key={String(t.id || t._id)} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={() => toggle(t.id || t._id, t.completed)} style={[styles.checkbox, t.completed && styles.checkboxDone]}>
          {t.completed ? <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text> : null}
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[{ color: COLORS.text, fontWeight: "600" }, t.completed && { textDecorationLine: "line-through", color: COLORS.textMuted }]}>{t.title}</Text>
          <Text style={styles.cardSubText}>
            {t.module_code ? `${t.module_code} · ` : ""}
            {t.due_date ? `Due ${new Date(t.due_date).toDateString()} · ` : ""}
            <Text style={{ color: getPriorityColor(t.priority_score) }}>Priority {t.priority_score}/10</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => deleteTask(t.id || t._id)} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Task Planner</Text>
      <Btn title="+ Add Task" onPress={() => setShowForm(true)} style={{ marginBottom: 16 }} />

      {tasks.length === 0 && <Text style={styles.emptyText}>No tasks yet. Add your first task!</Text>}

      {pending.length > 0 && (
        <>
          <Text style={styles.subSection}>Pending ({pending.length})</Text>
          {pending.map(renderTask)}
        </>
      )}
      {done.length > 0 && (
        <>
          <Text style={styles.subSection}>Completed ({done.length})</Text>
          {done.map(renderTask)}
        </>
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input label="Task Title *" value={form.title} onChangeText={v => setForm({...form, title: v})} placeholder="e.g. Submit Lab Report" />
              <Input label="Module Code" value={form.module_code} onChangeText={v => setForm({...form, module_code: v})} autoCapitalize="characters" placeholder="optional" />
              <Input label="Due Date (YYYY-MM-DD)" value={form.due_date} onChangeText={v => setForm({...form, due_date: v})} placeholder="e.g. 2025-06-30" />
              <Input label="Priority (1–10)" value={form.priority_score} onChangeText={v => setForm({...form, priority_score: v})} keyboardType="numeric" />
              <ErrorText msg={err} />
              <Btn title="Save Task" onPress={save} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowForm(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// REPEAT & IMPROVEMENT SCREEN
// ============================================================
function RepeatScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImproveForm, setShowImproveForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");

  const [addForm, setAddForm] = useState({ name: "", code: "", credits: "3", university_id: "", academic_year: "1", semester_in_year: "1" });
  const [impForm, setImpForm] = useState({ module_id: "", grade_letter: "", markPassed: true });

  const load = useCallback(async () => {
    try {
      const [m, u] = await Promise.all([
        api.get(`/users/${user.id}/modules`),
        api.get("/universities"),
      ]);
      setModules(m.data || []);
      setUniversities(u.data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const isRepeatCandidate = (m) =>
    Boolean(m.is_repeat) || (m.grade_point != null && m.grade_point < 2.0) || m.source_type === "repeat_add";

  const repeatCandidates = modules.filter(isRepeatCandidate);
  const normalCount = modules.length - repeatCandidates.length;

  const saveAddModule = async () => {
    setErr("");
    if (!addForm.name || !addForm.code || !addForm.university_id) return setErr("Name, code, and university are required.");
    setSaving(true);
    try {
      const ay = parseInt(addForm.academic_year, 10) || 1;
      const sy = parseInt(addForm.semester_in_year, 10) || 1;
      const { data } = await api.post("/modules", {
        user_id: user.id,
        university_id: addForm.university_id,
        academic_year: ay,
        semester_in_year: sy,
        semester: (ay - 1) * 2 + sy,
        source_type: "repeat_add",
        name: addForm.name.trim(),
        code: addForm.code.trim().toUpperCase(),
        credits: parseInt(addForm.credits, 10) || 3,
        is_repeat: 1,
      });
      if (data?.error) throw new Error(data.error);
      if (data?.updated) Alert.alert("Updated", "Existing module record was updated.");
      setShowAddForm(false);
      setAddForm({ name: "", code: "", credits: "3", university_id: "", academic_year: "1", semester_in_year: "1" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const saveImprovement = async () => {
    setErr("");
    if (!impForm.module_id || !impForm.grade_letter) return setErr("Select a module and new grade.");
    setSaving(true);
    try {
      const gradePoint = GRADE_POINTS[impForm.grade_letter] ?? null;
      const { data } = await api.put(`/modules/${impForm.module_id}`, {
        grade_letter: impForm.grade_letter,
        grade_point: gradePoint,
        is_repeat: impForm.markPassed ? 0 : 1,
      });
      if (data?.error) throw new Error(data.error);
      setShowImproveForm(false);
      setImpForm({ module_id: "", grade_letter: "", markPassed: true });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const removeModule = (id) => {
    Alert.alert("Remove", "Remove this entry from your academic history? This cannot be undone.", [
      { text: "Cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await api.delete(`/modules/${id}`); load(); } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Repeat & Improvement</Text>

      {/* Summary Cards */}
      <View style={styles.statsRow}>
        <StatCard label="Total Modules" value={modules.length} color={COLORS.accent} />
        <StatCard label="Normal" value={normalCount} color={COLORS.success} />
        <StatCard label="Repeat" value={repeatCandidates.length} color={COLORS.warning} />
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Btn title="+ Add Repeat Module" onPress={() => setShowAddForm(true)} style={{ flex: 1 }} />
        <Btn title="Record Improvement" ghost onPress={() => setShowImproveForm(true)} style={{ flex: 1 }} />
      </View>

      {/* Chart description */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
          You have <Text style={{ color: COLORS.warning, fontWeight: "700" }}>{repeatCandidates.length}</Text> repeat module{repeatCandidates.length !== 1 ? "s" : ""} out of{" "}
          <Text style={{ color: COLORS.text, fontWeight: "700" }}>{modules.length}</Text> total.
          Target: 0 repeat modules.
        </Text>
      </Card>

      {/* Academic History */}
      <SectionTitle title="Academic History" sub="Modules with grade below C or flagged as repeat." />
      {repeatCandidates.length === 0 && <Text style={styles.emptyText}>No repeat modules. Add modules in GPA Calculator first.</Text>}
      {repeatCandidates.map(m => (
        <Card key={String(m.id)} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontWeight: "600" }}>{m.name}</Text>
              <Text style={styles.cardSubText}>
                {m.code ? `${m.code} · ` : ""}
                Credits: {m.credits}
                {m.grade_letter ? ` · Grade: ${m.grade_letter}` : ""}
                {` · Y${m.academic_year || "–"}/S${m.semester_in_year || "–"}`}
              </Text>
              <Text style={[styles.cardSubText, { color: m.is_repeat ? COLORS.warning : COLORS.textMuted }]}>
                {m.is_repeat ? "⚠ Repeat" : "Low grade"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => { setImpForm({...impForm, module_id: String(m.id)}); setShowImproveForm(true); }}
                style={[styles.actionChip, { borderColor: COLORS.accent }]}
              >
                <Text style={{ color: COLORS.accent, fontSize: 12 }}>Improve</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeModule(m.id)} style={[styles.actionChip, { borderColor: COLORS.danger }]}>
                <Text style={{ color: COLORS.danger, fontSize: 12 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      ))}

      {/* Add Repeat Module Modal */}
      <Modal visible={showAddForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Repeat Module</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField
                label="University *"
                value={addForm.university_id}
                placeholder="Select university"
                items={universities.map(u => ({ label: u.name, value: String(u.id) }))}
                onSelect={v => setAddForm({...addForm, university_id: v})}
              />
              <Input label="Academic Year" value={addForm.academic_year} onChangeText={v => setAddForm({...addForm, academic_year: v})} keyboardType="numeric" />
              <Input label="Semester in Year (1–3)" value={addForm.semester_in_year} onChangeText={v => setAddForm({...addForm, semester_in_year: v})} keyboardType="numeric" />
              <Input label="Module Name *" value={addForm.name} onChangeText={v => setAddForm({...addForm, name: v})} placeholder="e.g. Algorithms" />
              <Input label="Module Code *" value={addForm.code} onChangeText={v => setAddForm({...addForm, code: v})} autoCapitalize="characters" placeholder="e.g. CS301" />
              <Input label="Credits" value={addForm.credits} onChangeText={v => setAddForm({...addForm, credits: v})} keyboardType="numeric" />
              <ErrorText msg={err} />
              <Btn title="Add Module" onPress={saveAddModule} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowAddForm(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Improvement Modal */}
      <Modal visible={showImproveForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Record Improvement</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField
                label="Module *"
                value={impForm.module_id}
                placeholder="Select module"
                items={repeatCandidates.map(m => ({ label: `${m.name}${m.code ? ` (${m.code})` : ""} — ${m.grade_letter || "–"}`, value: String(m.id) }))}
                onSelect={v => setImpForm({...impForm, module_id: v})}
              />
              <SelectField
                label="New Grade *"
                value={impForm.grade_letter}
                placeholder="Select new grade"
                items={GRADE_OPTIONS.map(g => ({ label: `${g} (${GRADE_POINTS[g]})`, value: g }))}
                onSelect={v => setImpForm({...impForm, grade_letter: v})}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Mark as passed (no longer repeat)</Text>
                <Switch
                  value={impForm.markPassed}
                  onValueChange={v => setImpForm({...impForm, markPassed: v})}
                  thumbColor={impForm.markPassed ? COLORS.accent : COLORS.textMuted}
                  trackColor={{ true: COLORS.accentDim, false: COLORS.border }}
                />
              </View>
              <ErrorText msg={err} />
              <Btn title="Save Improvement" onPress={saveImprovement} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowImproveForm(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// CONCERNS SCREEN
// ============================================================
function ConcernsScreen() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ university_id: "", category: "General", message: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const CATEGORIES = ["General", "Attendance", "GPA", "Technical"];

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([
        api.get(`/users/${user.id}/concerns`),
        api.get("/universities"),
      ]);
      setConcerns(c.data || []);
      setUniversities(u.data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    if (!form.university_id) return setErr("Please select a university.");
    if (!form.message.trim()) return setErr("Message is required.");
    setSaving(true);
    try {
      const { data } = await api.post("/concerns", {
        user_id: user.id,
        university_id: form.university_id,
        category: form.category || null,
        message: form.message.trim(),
      });
      if (data.error) throw new Error(data.error);
      setShowForm(false);
      setForm({ university_id: "", category: "General", message: "" });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const statusColor = s => ({ open: COLORS.warning, forwarded: COLORS.success, closed: COLORS.textMuted }[s] || COLORS.textMuted);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Feedback & Concerns</Text>
      <Text style={styles.subtitle}>Send feedback to the university administration</Text>
      <Btn title="+ Submit Concern" onPress={() => setShowForm(true)} style={{ marginBottom: 16 }} />

      {concerns.length === 0 && <Text style={styles.emptyText}>No concerns submitted yet.</Text>}
      {concerns.map(c => (
        <Card key={String(c.id || c._id)} style={{ marginBottom: 8 }}>
          {c.category ? <Text style={{ color: COLORS.accent, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>{c.category}</Text> : null}
          <Text style={{ color: COLORS.text, fontSize: 14 }}>{c.message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={styles.cardSubText}>{new Date(c.created_at).toDateString()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(c.status) }]}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{c.status}</Text>
            </View>
          </View>
        </Card>
      ))}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Submit Concern</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectField
                label="University *"
                value={form.university_id}
                placeholder="Select university"
                items={universities.map(u => ({ label: u.name, value: String(u.id) }))}
                onSelect={v => setForm({...form, university_id: v})}
              />
              <SelectField
                label="Category"
                value={form.category}
                items={CATEGORIES.map(c => ({ label: c, value: c }))}
                onSelect={v => setForm({...form, category: v})}
              />
              <Input
                label="Message *"
                value={form.message}
                onChangeText={v => setForm({...form, message: v})}
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: "top" }}
                placeholder="Describe your concern…"
              />
              <ErrorText msg={err} />
              <Btn title="Submit" onPress={save} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowForm(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// PROFILE SCREEN
// ============================================================
function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    index_number: user?.index_number || "",
    target_gpa: user?.target_gpa ? String(user.target_gpa) : "",
    target_attendance: user?.target_attendance ? String(user.target_attendance) : "80",
    notify_deadlines: user?.notify_deadlines !== false,
    deadline_reminder_days: user?.deadline_reminder_days ? String(user.deadline_reminder_days) : "3",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const save = async () => {
    setErr(""); setSuccess(false); setSaving(true);
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
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    Alert.alert("Delete Account", "This will permanently delete your account and all data. This cannot be undone.", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/users/${user.id}`); logout(); } },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.pageTitle}>Profile</Text>

      {/* Avatar */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "U"}</Text>
      </View>
      <Text style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 14 }}>{user?.email}</Text>
      <Text style={{ textAlign: "center", color: COLORS.text, fontWeight: "600", marginTop: 4, marginBottom: 16 }}>
        {user?.role === "admin" ? "👑 Admin" : "🎓 Student"}
      </Text>

      <Card>
        <Input label="Full Name" value={form.name} onChangeText={v => setForm({...form, name: v})} />
        <Input label="Index / Registration Number" value={form.index_number} onChangeText={v => setForm({...form, index_number: v})} placeholder="optional" />
        <Input label="Target GPA (0–4)" value={form.target_gpa} onChangeText={v => setForm({...form, target_gpa: v})} keyboardType="decimal-pad" placeholder="e.g. 3.5" />
        <Input label="Target Attendance (%)" value={form.target_attendance} onChangeText={v => setForm({...form, target_attendance: v})} keyboardType="numeric" />
        <Input label="Deadline Reminder (days before)" value={form.deadline_reminder_days} onChangeText={v => setForm({...form, deadline_reminder_days: v})} keyboardType="numeric" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Deadline Notifications</Text>
          <Switch
            value={form.notify_deadlines}
            onValueChange={v => setForm({...form, notify_deadlines: v})}
            thumbColor={form.notify_deadlines ? COLORS.accent : COLORS.textMuted}
            trackColor={{ true: COLORS.accentDim, false: COLORS.border }}
          />
        </View>
        <ErrorText msg={err} />
        <SuccessText msg={success ? "Profile saved ✓" : ""} />
        <Btn title="Save Profile" onPress={save} loading={saving} />
      </Card>

      <Btn title="Sign Out" onPress={logout} style={[styles.btnDanger, { backgroundColor: COLORS.textMuted, marginTop: 20 }]} />
      <Btn title="Delete Account" danger onPress={handleDelete} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

// ============================================================
// ADMIN DASHBOARD SCREEN
// ============================================================
function AdminDashboardScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, universities: 0, halls: 0, openConcerns: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [users, unis, concerns] = await Promise.all([
        api.get(`/admin/users?admin_user_id=${user.id}`),
        api.get("/universities"),
        api.get(`/admin/concerns?admin_user_id=${user.id}&status=open`),
      ]);
      const uniList = unis.data || [];
      let totalHalls = 0;
      for (const u of uniList) {
        try {
          const { data: hs } = await api.get(`/universities/${u.id}/halls`);
          totalHalls += (hs || []).length;
        } catch (_) {}
      }
      setStats({
        users: (users.data || []).length,
        universities: uniList.length,
        halls: totalHalls,
        openConcerns: (concerns.data || []).length,
      });
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Campus geofences, users, concerns, and analytics</Text>

      <View style={styles.statsRow}>
        <StatCard label="Total Users" value={stats.users} color={COLORS.accent} />
        <StatCard label="Campuses" value={stats.universities} color="#818cf8" />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Lecture Halls" value={stats.halls} color={COLORS.success} />
        <StatCard label="Open Concerns" value={stats.openConcerns} color={COLORS.warning} />
      </View>
    </ScrollView>
  );
}

// ============================================================
// ADMIN USERS SCREEN
// ============================================================
function AdminUsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/admin/users?admin_user_id=${user.id}`); setUsers(data || []); } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (uid, newRole) => {
    try {
      const { data } = await api.put(`/admin/users/${uid}/role`, { admin_user_id: user.id, role: newRole });
      if (data?.error) { Alert.alert("Error", data.error); return; }
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Registered Users</Text>
      {users.length === 0 && <Text style={styles.emptyText}>No users found.</Text>}
      {users.map(u => (
        <Card key={String(u.id)} style={{ marginBottom: 10 }}>
          <Text style={{ color: COLORS.text, fontWeight: "700" }}>{u.name || "—"}</Text>
          <Text style={styles.cardSubText}>{u.email}</Text>
          {u.index_number ? <Text style={styles.cardSubText}>Index: {u.index_number}</Text> : null}
          <Text style={[styles.cardSubText, { color: u.role === "admin" ? COLORS.warning : COLORS.accent }]}>
            Role: {u.role || "student"}
          </Text>
          <Text style={styles.cardSubText}>Joined: {u.created_at ? String(u.created_at).slice(0, 10) : "—"}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {u.role !== "admin" && (
              <Btn title="Make Admin" small onPress={() => Alert.alert("Promote", `Make ${u.name} an admin?`, [
                { text: "Cancel" }, { text: "Promote", onPress: () => changeRole(u.id, "admin") }
              ])} style={{ backgroundColor: COLORS.warning }} />
            )}
            {u.role !== "student" && (
              <Btn title="Make Student" small ghost onPress={() => Alert.alert("Demote", `Change ${u.name} to student?`, [
                { text: "Cancel" }, { text: "Demote", onPress: () => changeRole(u.id, "student") }
              ])} />
            )}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

// ============================================================
// ADMIN HALLS (GEOFENCE) SCREEN
// ============================================================
function AdminHallsScreen() {
  const { user } = useAuth();
  const [universities, setUniversities] = useState([]);
  const [halls, setHalls] = useState([]);
  const [selectedUni, setSelectedUni] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showAddUni, setShowAddUni] = useState(false);
  const [showAddHall, setShowAddHall] = useState(false);

  const [hallForm, setHallForm] = useState({ name: "", building: "", floor: "", lat: "", lng: "", radius: "80" });
  const [uniForm, setUniForm] = useState({ name: "", email: "" });

  const loadUnis = useCallback(async () => {
    try { const { data } = await api.get("/universities"); setUniversities(data || []); } catch (_) {}
    setLoading(false);
  }, []);

  const loadHalls = async (uniId) => {
    if (!uniId) { setHalls([]); return; }
    try { const { data } = await api.get(`/universities/${uniId}/halls`); setHalls(data || []); } catch (_) {}
  };

  useEffect(() => { loadUnis(); }, [loadUnis]);

  const saveUni = async () => {
    setErr("");
    if (!uniForm.name || !uniForm.email) return setErr("Name and email required.");
    setSaving(true);
    try {
      const { data } = await api.post("/admin/universities", { name: uniForm.name.trim(), general_email: uniForm.email.trim(), admin_user_id: user.id });
      if (data?.error) throw new Error(data.error);
      setShowAddUni(false);
      setUniForm({ name: "", email: "" });
      loadUnis();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const saveHall = async () => {
    setErr("");
    if (!selectedUni) return setErr("Select a university first.");
    if (!hallForm.name || !hallForm.lat || !hallForm.lng || !hallForm.radius) return setErr("Name, lat, lng, and radius are required.");
    setSaving(true);
    try {
      const { data } = await api.post(`/universities/${selectedUni}/halls`, {
        name: hallForm.name.trim(),
        building: hallForm.building.trim() || null,
        floor: hallForm.floor ? parseInt(hallForm.floor, 10) : null,
        center_lat: parseFloat(hallForm.lat),
        center_lng: parseFloat(hallForm.lng),
        radius_m: parseInt(hallForm.radius, 10),
        admin_user_id: user.id,
      });
      if (data?.error) throw new Error(data.error);
      setShowAddHall(false);
      setHallForm({ name: "", building: "", floor: "", lat: "", lng: "", radius: "80" });
      loadHalls(selectedUni);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const removeHall = (id) => {
    Alert.alert("Remove Hall", "Remove this geofence?", [
      { text: "Cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await api.delete(`/halls/${id}?admin_user_id=${user.id}`);
        loadHalls(selectedUni);
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.pageTitle}>Campus Lecture Halls</Text>
      <Text style={styles.subtitle}>Manage geofence circles for each hall</Text>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Btn title="+ Add University" ghost onPress={() => setShowAddUni(true)} style={{ flex: 1 }} />
        <Btn title="+ Add Hall" onPress={() => { if (!selectedUni) { Alert.alert("Select University", "Select a university first."); return; } setShowAddHall(true); }} style={{ flex: 1 }} />
      </View>

      <SelectField
        label="Select University"
        value={selectedUni}
        placeholder="Choose campus to view halls"
        items={universities.map(u => ({ label: u.name, value: String(u.id) }))}
        onSelect={v => { setSelectedUni(v); loadHalls(v); }}
      />

      {halls.length === 0 && selectedUni && <Text style={styles.emptyText}>No halls for this university. Add one!</Text>}
      {halls.map(h => (
        <Card key={String(h.id)} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontWeight: "700" }}>{h.name}</Text>
              {h.building ? <Text style={styles.cardSubText}>Building: {h.building}{h.floor != null ? `, Floor ${h.floor}` : ""}</Text> : null}
              <Text style={styles.cardSubText}>📍 {h.center_lat?.toFixed(5)}, {h.center_lng?.toFixed(5)} · Radius: {h.radius_m}m</Text>
            </View>
            <TouchableOpacity onPress={() => removeHall(h.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      {/* Add University Modal */}
      <Modal visible={showAddUni} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add University</Text>
            <Input label="University Name *" value={uniForm.name} onChangeText={v => setUniForm({...uniForm, name: v})} placeholder="e.g. University of Colombo" />
            <Input label="General Email *" value={uniForm.email} onChangeText={v => setUniForm({...uniForm, email: v})} keyboardType="email-address" autoCapitalize="none" placeholder="admin@uni.lk" />
            <ErrorText msg={err} />
            <Btn title="Add University" onPress={saveUni} loading={saving} />
            <Btn title="Cancel" ghost onPress={() => { setShowAddUni(false); setErr(""); }} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>

      {/* Add Hall Modal */}
      <Modal visible={showAddHall} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Lecture Hall</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input label="Hall Name *" value={hallForm.name} onChangeText={v => setHallForm({...hallForm, name: v})} placeholder="e.g. Lecture Hall A" />
              <Input label="Building" value={hallForm.building} onChangeText={v => setHallForm({...hallForm, building: v})} placeholder="e.g. Engineering Block" />
              <Input label="Floor" value={hallForm.floor} onChangeText={v => setHallForm({...hallForm, floor: v})} keyboardType="numeric" placeholder="e.g. 1" />
              <Input label="Center Latitude *" value={hallForm.lat} onChangeText={v => setHallForm({...hallForm, lat: v})} keyboardType="decimal-pad" placeholder="e.g. 6.9271" />
              <Input label="Center Longitude *" value={hallForm.lng} onChangeText={v => setHallForm({...hallForm, lng: v})} keyboardType="decimal-pad" placeholder="e.g. 79.8612" />
              <Input label="Radius (metres) *" value={hallForm.radius} onChangeText={v => setHallForm({...hallForm, radius: v})} keyboardType="numeric" placeholder="e.g. 80" />
              <Text style={[styles.cardSubText, { marginBottom: 12 }]}>
                💡 Tip: Use Google Maps to find coordinates. Long-press a location to copy lat/lng.
              </Text>
              <ErrorText msg={err} />
              <Btn title="Add Hall" onPress={saveHall} loading={saving} />
              <Btn title="Cancel" ghost onPress={() => { setShowAddHall(false); setErr(""); }} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// ADMIN CONCERNS SCREEN
// ============================================================
function AdminConcernsScreen() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/concerns?admin_user_id=${user.id}&status=${statusFilter}`);
      setConcerns(data || []);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const forwardConcern = async (id) => {
    try {
      await api.post(`/admin/concerns/${id}/forward`, { admin_user_id: user.id });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const closeConcern = async (id) => {
    try {
      await api.patch(`/admin/concerns/${id}`, { admin_user_id: user.id, status: "closed" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const statusColor = s => ({ open: COLORS.warning, forwarded: COLORS.success, closed: COLORS.textMuted }[s] || COLORS.textMuted);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Concerns Inbox</Text>

      {/* Filter */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {["open", "forwarded", "closed"].map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
          >
            <Text style={{ color: statusFilter === s ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: "600", textTransform: "capitalize" }}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {concerns.length === 0 && <Text style={styles.emptyText}>No {statusFilter} concerns.</Text>}
      {concerns.map(c => (
        <Card key={String(c.id || c._id)} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: COLORS.text, fontWeight: "700" }}>{c.student_name || "Unknown"}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(c.status) }]}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{c.status}</Text>
            </View>
          </View>
          <Text style={styles.cardSubText}>{c.university_name || "—"} · {c.category || "General"}</Text>
          <Text style={{ color: COLORS.text, marginVertical: 6 }}>{c.message}</Text>
          <Text style={styles.cardSubText}>{new Date(c.created_at).toDateString()}</Text>
          {c.status === "open" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Btn title="Forward" small onPress={() => forwardConcern(c.id)} style={{ backgroundColor: COLORS.success }} />
              <Btn title="Close" small ghost onPress={() => closeConcern(c.id)} />
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

// ============================================================
// ADMIN USAGE SCREEN
// ============================================================
function AdminUsageScreen() {
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/usage?admin_user_id=${user.id}`);
      setUsage(data);
    } catch (_) {}
    setLoading(false); setRefreshing(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;

  const summary = usage?.summary || {};

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={COLORS.accent} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.pageTitle}>Usage Analytics</Text>
      <Text style={styles.subtitle}>Last 7 days</Text>

      <View style={styles.statsRow}>
        <StatCard label="Total Events" value={summary.total_events ?? 0} color={COLORS.accent} />
        <StatCard label="Page Views" value={summary.page_views ?? 0} color="#818cf8" />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Tasks Added" value={summary.task_adds ?? 0} color={COLORS.success} />
        <StatCard label="Tasks Done" value={summary.task_completes ?? 0} color={COLORS.accentDim} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Att. Marks" value={summary.attendance_marks ?? 0} color={COLORS.warning} />
        <StatCard label="Concerns" value={summary.concerns_submits ?? 0} color="#c084fc} }" />
      </View>

      {/* Daily breakdown */}
      <SectionTitle title="Daily Breakdown" />
      {(usage?.daily || []).map(day => (
        <Card key={day.date} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: COLORS.text, fontWeight: "600" }}>{day.date}</Text>
            <Text style={{ color: COLORS.accent, fontWeight: "700" }}>{day.count} events</Text>
          </View>
        </Card>
      ))}
      {(!usage?.daily || usage.daily.length === 0) && <Text style={styles.emptyText}>No usage data yet.</Text>}
    </ScrollView>
  );
}

// ============================================================
// NAVIGATION — STUDENT TABS
// ============================================================
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const STUDENT_TABS = [
  { name: "Dashboard", icon: "🏠", component: DashboardScreen },
  { name: "GPA",       icon: "📚", component: GPAScreen },
  { name: "Attend",   icon: "✅", component: AttendanceScreen },
  { name: "Tasks",    icon: "📝", component: TasksScreen },
  { name: "Repeat",   icon: "🔁", component: RepeatScreen },
  { name: "Concerns", icon: "📢", component: ConcernsScreen },
  { name: "Profile",  icon: "👤", component: ProfileScreen },
];

const ADMIN_TABS = [
  { name: "Overview",  icon: "📊", component: AdminDashboardScreen },
  { name: "Users",     icon: "👥", component: AdminUsersScreen },
  { name: "Halls",     icon: "🏛", component: AdminHallsScreen },
  { name: "Concerns",  icon: "📬", component: AdminConcernsScreen },
  { name: "Analytics", icon: "📈", component: AdminUsageScreen },
  { name: "Profile",   icon: "👤", component: ProfileScreen },
];

function MainTabs() {
  const { user } = useAuth();
  const tabs = user?.role === "admin" ? ADMIN_TABS : STUDENT_TABS;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const tab = tabs.find(t => t.name === route.name);
          return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{tab?.icon || "●"}</Text>;
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.bgCard,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: Platform.OS === "ios" ? 10 : 4,
        },
        tabBarLabelStyle: { fontSize: 10 },
        headerShown: false,
      })}
    >
      {tabs.map(t => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
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
// APP ENTRY
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
// STYLES
// ============================================================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingTop: 50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },

  // Auth
  authContainer: { flex: 1, backgroundColor: COLORS.bg },
  authInner: { padding: 24, paddingTop: 80 },
  appTitle: { fontSize: 32, fontWeight: "800", color: COLORS.accent, textAlign: "center", marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginBottom: 32 },
  linkText: { color: COLORS.textMuted, fontSize: 14, textAlign: "center" },

  // Input
  inputWrap: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginBottom: 4, textTransform: "uppercase" },
  input: {
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    padding: 12, fontSize: 15, color: COLORS.text,
    justifyContent: "center",
  },

  // Button
  btn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnDanger: { backgroundColor: COLORS.danger },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
  btnGhostText: { color: COLORS.textMuted },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Card
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  alertCard: { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.4)", marginBottom: 16 },

  // Text
  pageTitle: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginBottom: 12 },
  subSection: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginVertical: 6, textTransform: "uppercase" },
  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 24, fontSize: 14, paddingBottom: 12 },
  cardLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 4 },
  cardSubText: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Error / Success
  errorBox: { backgroundColor: "rgba(239,68,68,0.15)", padding: 10, borderRadius: 8, marginBottom: 8 },
  errorTxt: { color: "#fca5a5", fontSize: 13 },
  successBox: { backgroundColor: "rgba(16,185,129,0.15)", padding: 10, borderRadius: 8, marginBottom: 8 },
  successTxt: { color: COLORS.success, fontSize: 13 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 14,
    alignItems: "center", borderTopWidth: 3, borderColor: COLORS.border,
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textTransform: "uppercase" },

  // Progress
  progressBg: { height: 6, backgroundColor: COLORS.bgElevated, borderRadius: 4, marginVertical: 6, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 4 },

  // Semester
  semCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, backgroundColor: COLORS.bgCard, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  semLabel: { fontSize: 14, color: COLORS.textMuted },
  semGpa: { fontSize: 18, fontWeight: "800", color: COLORS.accent },

  // Delete/Action
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18, color: COLORS.danger },
  actionChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },

  // Checkbox
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.accent, justifyContent: "center", alignItems: "center" },
  checkboxDone: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%", paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginBottom: 16 },

  // Picker
  pickerItem: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemActive: { backgroundColor: "rgba(0,201,167,0.1)" },
  pickerItemText: { fontSize: 15, color: COLORS.text },

  // Profile
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.accent, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 8 },
  avatarText: { fontSize: 36, color: "#fff", fontWeight: "800" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 4 },
  switchLabel: { fontSize: 14, color: COLORS.text, flex: 1, marginRight: 12 },

  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },

  // Filter chip
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  filterChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },

  // Concerns
  concernMeta: { fontSize: 12, color: COLORS.textMuted },

  // Planner
  plannerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  plannerLabel: { fontSize: 14, color: COLORS.textMuted },
  plannerValue: { fontSize: 14, fontWeight: "600", color: COLORS.text },

  // Geofence
  geofenceCard: { marginBottom: 16 },
  geofenceResult: { padding: 12, borderRadius: 8, borderWidth: 1, marginVertical: 8 },
});