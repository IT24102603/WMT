import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { get, put, trackUsage } from '../utils/api';
import {
  COLORS, Card, StatCard, Btn, Input, Label, SectionHeader,
  Loader, Row, Divider,
} from '../components/UI';

export function DashboardScreen() {
  const { user, logout, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [attData, setAttData] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [targetGpa, setTargetGpa] = useState('');
  const [targetAtt, setTargetAtt] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [gpaData, prof, att, tt] = await Promise.all([
      get(`/users/${user.id}/gpa`),
      get(`/users/${user.id}/profile`).catch(() => user),
      get(`/users/${user.id}/attendance-logs`).catch(() => []),
      get(`/users/${user.id}/timetables`).catch(() => []),
    ]);
    setData(gpaData);
    setProfile(prof);
    setAttData(att || []);
    setTimetables(tt || []);
    trackUsage('page_view', 'dashboard', null, user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const saveGoals = async () => {
    const tg = parseFloat(targetGpa);
    const ta = parseInt(targetAtt, 10);
    if (!isNaN(tg) && (tg < 0 || tg > 4)) { Alert.alert('Error', 'Target GPA must be 0–4'); return; }
    if (!isNaN(ta) && (ta < 0 || ta > 100)) { Alert.alert('Error', 'Target attendance must be 0–100'); return; }
    await put(`/users/${user.id}/profile`, {
      target_gpa: isNaN(tg) ? null : tg,
      target_attendance: isNaN(ta) ? 80 : ta,
    });
    updateUser({ target_gpa: tg, target_attendance: ta });
    setEditingGoals(false);
    load();
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This will permanently delete your account and all data. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await import('../utils/api').then(m => m.del(`/users/${user.id}`));
          logout();
        }
      },
    ]);
  };

  if (!data) return <Loader />;

  const cgpa = data.overall?.gpa ?? 0;
  const modules = data.modules || [];
  const currentSem = Math.max(1, ...modules.map(m => parseInt(m.semester, 10) || 1));
  const currentModules = modules.filter(m => (parseInt(m.semester, 10) || 1) === currentSem);

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Profile Card */}
      <Card>
        <Text style={styles.name}>{profile?.name || user?.name || 'Student'}</Text>
        <Text style={styles.email}>{profile?.email || user?.email}</Text>
        {profile?.index_number ? <Text style={styles.index}>Index: {profile.index_number}</Text> : null}
      </Card>

      {/* Stats */}
      <Row style={{ flexWrap: 'wrap' }}>
        <StatCard label="Current GPA" value={cgpa} />
        <StatCard label="Target GPA" value={profile?.target_gpa ?? '–'} />
        <StatCard label="Target Att." value={(profile?.target_attendance ?? 80) + '%'} />
        <StatCard label="Modules" value={currentModules.length} />
      </Row>

      {/* Goals */}
      <Card>
        <SectionHeader title="Academic Goals" />
        {editingGoals ? (
          <>
            <Input label="Target GPA (0–4)" value={targetGpa} onChangeText={setTargetGpa} keyboardType="decimal-pad" placeholder="e.g. 3.5" />
            <Input label="Target Attendance %" value={targetAtt} onChangeText={setTargetAtt} keyboardType="number-pad" placeholder="e.g. 80" />
            <Row>
              <Btn title="Save" onPress={saveGoals} style={{ flex: 1 }} />
              <Btn title="Cancel" onPress={() => setEditingGoals(false)} variant="ghost" style={{ flex: 1 }} />
            </Row>
          </>
        ) : (
          <Btn title="Edit Goals" onPress={() => {
            setTargetGpa(String(profile?.target_gpa ?? ''));
            setTargetAtt(String(profile?.target_attendance ?? 80));
            setEditingGoals(true);
          }} variant="ghost" />
        )}
      </Card>

      {/* Attendance Summary */}
      <Card>
        <SectionHeader title="Attendance Summary" />
        {attData.length === 0 ? (
          <Text style={styles.muted}>No attendance records yet</Text>
        ) : (
          attData.slice(0, 6).map((a, i) => {
            const pct = Math.round((a.attended / (a.total_sessions || 1)) * 100);
            const color = pct >= 80 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.error;
            return (
              <View key={i} style={styles.attRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attModule}>{a.module_name}</Text>
                  <Text style={styles.attMode}>{a.delivery_mode === 'online' ? 'Online' : 'Physical'}</Text>
                </View>
                <Text style={[styles.attPct, { color }]}>{pct}%</Text>
              </View>
            );
          })
        )}
      </Card>

      {/* Recent Modules */}
      <Card>
        <SectionHeader title="Current Semester Modules" />
        {currentModules.length === 0 ? (
          <Text style={styles.muted}>No modules yet. Add them in GPA Calculator.</Text>
        ) : (
          currentModules.slice(0, 8).map((m, i) => (
            <View key={i} style={styles.moduleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleName}>{m.name}</Text>
                {m.code ? <Text style={styles.muted}>{m.code} · {m.credits} credits</Text> : null}
              </View>
              <Text style={[styles.grade, { color: m.grade_letter ? COLORS.primary : COLORS.textMuted }]}>
                {m.grade_letter || '–'}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Timetables */}
      {timetables.length > 0 && (
        <Card>
          <SectionHeader title="My Timetable Uploads" />
          {timetables.map((t, i) => (
            <View key={i} style={styles.moduleRow}>
              <Text style={{ color: COLORS.text }}>{t.university_name || '—'}</Text>
              <Text style={{ color: COLORS.textMuted }}>Sem {t.semester} · Year {t.year_number || t.academic_year || '—'}</Text>
            </View>
          ))}
        </Card>
      )}

      <Divider />

      {/* Danger zone */}
      <Btn title="Delete My Account" onPress={handleDeleteAccount} variant="danger" style={{ marginBottom: 8 }} />
      <Btn title="Logout" onPress={logout} variant="ghost" style={{ marginBottom: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16 },
  name: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  email: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  index: { color: COLORS.primary, fontSize: 12, marginTop: 4 },
  muted: { color: COLORS.textMuted, fontSize: 13 },
  attRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  attModule: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  attMode: { color: COLORS.textMuted, fontSize: 11 },
  attPct: { fontSize: 16, fontWeight: '700' },
  moduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  moduleName: { color: COLORS.text, fontSize: 13 },
  grade: { fontSize: 16, fontWeight: '700', minWidth: 32, textAlign: 'right' },
});