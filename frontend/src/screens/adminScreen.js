import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { get, post, put } from '../utils/api';
import { COLORS, Card, Btn, Input, SectionHeader, Loader, Row, StatCard, EmptyState } from '../components/UI';

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [users, unis, concerns] = await Promise.all([
      get(`/admin/users?admin_user_id=${user.id}`).catch(() => []),
      get('/universities').catch(() => []),
      get(`/admin/concerns?admin_user_id=${user.id}&status=open`).catch(() => []),
    ]);
    // Count total halls across all universities
    let halls = 0;
    for (const u of (unis || []).slice(0, 10)) {
      const h = await get(`/universities/${u.id}/halls`).catch(() => []);
      halls += h.length;
    }
    setStats({ users: users.length, unis: unis.length, concerns: concerns.length, halls });
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!stats) return <Loader />;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <Text style={styles.welcomeText}>Admin Panel</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        <StatCard label="Total Users" value={stats.users} />
        <StatCard label="Universities" value={stats.unis} />
        <StatCard label="Open Concerns" value={stats.concerns} />
        <StatCard label="Lecture Halls" value={stats.halls} />
      </Row>
      <Card>
        <Text style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 20 }}>
          Use the tabs below to manage users, lecture halls, concerns, and timetables. Switch to the Usage tab to view analytics.
        </Text>
      </Card>
    </ScrollView>
  );
}

// ─── Admin Users ──────────────────────────────────────────────────────────────

export function AdminUsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const u = await get(`/admin/users?admin_user_id=${user.id}`).catch(() => []);
    setUsers(u || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateRole = async (userId, role) => {
    const res = await put(`/admin/users/${userId}/role`, { admin_user_id: user.id, role });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    load();
  };

  if (loading) return <Loader />;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <SectionHeader title={`Users (${users.length})`} />
      {users.map((u, i) => (
        <Card key={u.id || i}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.name || '—'}</Text>
              <Text style={styles.userEmail}>{u.email || '—'}</Text>
              {u.index_number ? <Text style={styles.userIndex}>#{u.index_number}</Text> : null}
              <Text style={styles.userDate}>Joined: {u.created_at ? String(u.created_at).slice(0, 10) : '—'}</Text>
            </View>
            <View style={{ minWidth: 120 }}>
              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={u.role || 'student'}
                  onValueChange={(role) => updateRole(u.id, role)}
                  style={[styles.picker, { height: 40 }]}
                  dropdownIconColor={COLORS.textMuted}
                >
                  <Picker.Item label="student" value="student" color={COLORS.text} />
                  <Picker.Item label="admin" value="admin" color={COLORS.text} />
                </Picker>
              </View>
            </View>
          </Row>
        </Card>
      ))}
      {users.length === 0 && <EmptyState msg="No users found." />}
    </ScrollView>
  );
}

// ─── Admin Concerns ───────────────────────────────────────────────────────────

export function AdminConcernsScreen() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const c = await get(`/admin/concerns?admin_user_id=${user.id}&status=${status}`).catch(() => []);
    setConcerns(c || []);
    setLoading(false);
  }, [user?.id, status]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const forwardConcern = async (id) => {
    const res = await post(`/admin/concerns/${id}/forward`, { admin_user_id: user.id });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    load();
  };

  const statusColor = { open: COLORS.warning, forwarded: COLORS.info, resolved: COLORS.success };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.pickerWrap}>
        <Picker selectedValue={status} onValueChange={v => { setStatus(v); setLoading(true); }} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
          <Picker.Item label="Open" value="open" color={COLORS.text} />
          <Picker.Item label="Forwarded" value="forwarded" color={COLORS.text} />
          <Picker.Item label="Resolved" value="resolved" color={COLORS.text} />
        </Picker>
      </View>

      {loading ? <Loader /> : concerns.length === 0 ? <EmptyState msg="No concerns." /> : (
        concerns.map((c, i) => (
          <Card key={i}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.userName}>{c.student_name || '—'}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor[c.status] || COLORS.textMuted }]}>
                <Text style={styles.badgeText}>{c.status}</Text>
              </View>
            </Row>
            <Text style={styles.userEmail}>{c.university_name || '—'} · {c.category || '—'}</Text>
            <Text style={styles.concernMsg} numberOfLines={5}>{c.message || ''}</Text>
            {c.status !== 'forwarded' && (
              <Btn
                title="Forward to University"
                onPress={() => forwardConcern(c.id)}
                variant="ghost"
                small
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

// ─── Admin Usage Analytics ────────────────────────────────────────────────────

export function AdminUsageScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await get(`/admin/analytics/usage-summary?admin_user_id=${user.id}&days=7`).catch(() => null);
    setSummary(s);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!summary) return <Loader />;

  const rows = summary.rows || [];
  const count = (type) => rows.filter(r => r.event_type === type).reduce((acc, r) => acc + (parseInt(r.count, 10) || 0), 0);

  const total = rows.reduce((acc, r) => acc + (parseInt(r.count, 10) || 0), 0);
  const pageViews = count('page_view');
  const taskAdds = count('task_add');
  const taskCompletes = count('task_complete');
  const attMarks = count('attendance_mark');
  const concerns = count('concern_submit');

  // Day breakdown
  const days = [...new Set(rows.map(r => r.day))].sort();

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <Text style={styles.welcomeText}>Last 7 Days Analytics</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        <StatCard label="Total Events" value={total} />
        <StatCard label="Page Views" value={pageViews} />
        <StatCard label="Task Adds" value={taskAdds} />
        <StatCard label="Task Completes" value={taskCompletes} />
        <StatCard label="Attendance Marks" value={attMarks} />
        <StatCard label="Concerns" value={concerns} />
      </Row>

      <Card>
        <SectionHeader title="Daily Breakdown" />
        {days.map(day => {
          const pv = rows.filter(r => r.day === day && r.event_type === 'page_view').reduce((acc, r) => acc + (parseInt(r.count, 10) || 0), 0);
          const ta = rows.filter(r => r.day === day && r.event_type === 'task_add').reduce((acc, r) => acc + (parseInt(r.count, 10) || 0), 0);
          const dayTotal = rows.filter(r => r.day === day).reduce((acc, r) => acc + (parseInt(r.count, 10) || 0), 0);
          return (
            <View key={day} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${total > 0 ? (dayTotal / total) * 100 : 0}%` }]} />
                </View>
              </View>
              <Text style={styles.dayCount}>{dayTotal} events</Text>
            </View>
          );
        })}
        {days.length === 0 && <Text style={{ color: COLORS.textMuted }}>No data yet.</Text>}
      </Card>
    </ScrollView>
  );
}

// ─── Admin Attendance Queue ───────────────────────────────────────────────────

export function AdminAttendanceQueueScreen() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const url = status
      ? `/admin/attendance-queue?admin_user_id=${user.id}&status=${status}`
      : `/admin/attendance-queue?admin_user_id=${user.id}`;
    const rows = await get(url).catch(() => []);
    setQueue(rows || []);
    setLoading(false);
  }, [user?.id, status]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const approve = async (id) => {
    const res = await post(`/admin/attendance-queue/${id}/approve`, { admin_user_id: user.id });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    load();
  };

  const reject = async (id) => {
    const res = await post(`/admin/attendance-queue/${id}/reject`, { admin_user_id: user.id });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    load();
  };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.pickerWrap}>
        <Picker selectedValue={status} onValueChange={v => { setStatus(v); setLoading(true); }} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
          <Picker.Item label="Pending" value="pending" color={COLORS.text} />
          <Picker.Item label="Timetable Missing" value="timetable_missing" color={COLORS.text} />
          <Picker.Item label="Auto Verified" value="auto_verified" color={COLORS.text} />
          <Picker.Item label="All" value="" color={COLORS.text} />
        </Picker>
      </View>

      {loading ? <Loader /> : queue.length === 0 ? <EmptyState msg="No items in queue." /> : (
        queue.map((r, i) => {
          const canModerate = r.verification_status === 'pending' || r.verification_status === 'timetable_missing';
          return (
            <Card key={i}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.userName}>{r.student_name || '—'}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>{r.lecture_date ? String(r.lecture_date).slice(0, 10) : '—'}</Text>
              </Row>
              <Text style={styles.userEmail}>{r.module_name || '—'} · {r.university_name || '—'}</Text>
              <Text style={styles.userIndex}>{r.hall_name ? `Hall: ${r.hall_name}` : ''} · Mode: {r.delivery_mode || '—'}</Text>
              <Text style={{ color: COLORS.text, fontSize: 13, marginTop: 4 }}>Attendance: {r.attended}/{r.total_sessions}</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Status: {r.verification_status}</Text>
              {canModerate && (
                <Row style={{ marginTop: 8 }}>
                  <Btn title="✓ Approve" onPress={() => approve(r.id)} style={{ flex: 1 }} small />
                  <Btn title="✕ Reject" onPress={() => reject(r.id)} variant="danger" style={{ flex: 1 }} small />
                </Row>
              )}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── Admin Halls ──────────────────────────────────────────────────────────────

export function AdminHallsScreen() {
  const { user } = useAuth();
  const [universities, setUniversities] = useState([]);
  const [selectedUni, setSelectedUni] = useState('');
  const [halls, setHalls] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add hall form
  const [hallName, setHallName] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('80');
  const [showForm, setShowForm] = useState(false);

  // Add university form
  const [uniName, setUniName] = useState('');
  const [uniEmail, setUniEmail] = useState('');
  const [showUniForm, setShowUniForm] = useState(false);

  const loadUnis = useCallback(async () => {
    const u = await get('/universities').catch(() => []);
    setUniversities(u || []);
  }, []);

  const loadHalls = useCallback(async () => {
    if (!selectedUni) { setHalls([]); return; }
    const h = await get(`/universities/${selectedUni}/halls`).catch(() => []);
    setHalls(h || []);
  }, [selectedUni]);

  useEffect(() => { loadUnis(); }, [loadUnis]);
  useEffect(() => { loadHalls(); }, [loadHalls]);

  const addHall = async () => {
    if (!selectedUni || !hallName || !lat || !lng || !radius) { Alert.alert('Error', 'Fill all required fields'); return; }
    const res = await post('/admin/lecture-halls', {
      admin_user_id: user.id,
      university_id: selectedUni,
      hall_name: hallName,
      building_name: building || null,
      floor_number: floor ? parseInt(floor, 10) : null,
      center_lat: parseFloat(lat),
      center_lng: parseFloat(lng),
      radius_m: parseInt(radius, 10),
    });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    setHallName(''); setBuilding(''); setFloor(''); setLat(''); setLng(''); setRadius('80');
    setShowForm(false);
    loadHalls();
  };

  const removeHall = (id) => {
    Alert.alert('Remove Hall', 'Remove this lecture hall?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await fetch(`${require('../utils/api').API_BASE}/admin/lecture-halls/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await require('@react-native-async-storage/async-storage').default.getItem('token')}` },
            body: JSON.stringify({ admin_user_id: user.id }),
          });
          loadHalls();
        }
      },
    ]);
  };

  const addUniversity = async () => {
    if (!uniName.trim() || !uniEmail.trim()) { Alert.alert('Error', 'Name and email required'); return; }
    const res = await post('/admin/universities', { admin_user_id: user.id, name: uniName.trim(), general_email: uniEmail.trim() });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    setUniName(''); setUniEmail(''); setShowUniForm(false);
    loadUnis();
  };

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content}>
      {/* University selector */}
      <Card>
        <SectionHeader title="Lecture Hall Geofences" />
        <Text style={styles.inputLabel}>University</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedUni} onValueChange={v => setSelectedUni(v)} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            <Picker.Item label="Select university" value="" color={COLORS.textMuted} />
            {universities.map(u => <Picker.Item key={u.id} label={u.name} value={String(u.id)} color={COLORS.text} />)}
          </Picker>
        </View>

        {/* Halls list */}
        {halls.length === 0 ? (
          <Text style={styles.muted}>{selectedUni ? 'No halls configured yet.' : 'Select a university.'}</Text>
        ) : (
          halls.map((h, i) => (
            <View key={h.id} style={[styles.hallRow, i < halls.length - 1 && styles.border]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{h.hall_name}</Text>
                <Text style={styles.muted}>{h.building_name || '—'} · Floor {h.floor_number ?? '—'}</Text>
                <Text style={styles.muted}>Lat: {h.center_lat} · Lng: {h.center_lng} · R: {h.radius_m}m</Text>
              </View>
              <TouchableOpacity onPress={() => removeHall(h.id)}>
                <Text style={{ color: COLORS.error, fontSize: 13, padding: 8 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {selectedUni && (
          <>
            <Btn title={showForm ? 'Cancel' : '+ Add Hall'} onPress={() => setShowForm(v => !v)} variant="ghost" style={{ marginTop: 8 }} />
            {showForm && (
              <View style={{ marginTop: 8 }}>
                <Input label="Hall Name *" value={hallName} onChangeText={setHallName} placeholder="Lecture Hall A" />
                <Input label="Building" value={building} onChangeText={setBuilding} placeholder="Main Block" />
                <Input label="Floor" value={floor} onChangeText={setFloor} keyboardType="number-pad" placeholder="0" />
                <Row>
                  <Input label="Latitude *" value={lat} onChangeText={setLat} keyboardType="decimal-pad" placeholder="6.9271" style={{ flex: 1 }} />
                  <Input label="Longitude *" value={lng} onChangeText={setLng} keyboardType="decimal-pad" placeholder="79.8612" style={{ flex: 1 }} />
                </Row>
                <Input label="Radius (meters) *" value={radius} onChangeText={setRadius} keyboardType="number-pad" placeholder="80" />
                <Text style={[styles.muted, { marginBottom: 8 }]}>💡 Get lat/lng from Google Maps by long-pressing your lecture hall location.</Text>
                <Btn title="Add Hall" onPress={addHall} />
              </View>
            )}
          </>
        )}
      </Card>

      {/* Add University */}
      <Card>
        <SectionHeader title="Add University" />
        <Btn title={showUniForm ? 'Cancel' : '+ Add University'} onPress={() => setShowUniForm(v => !v)} variant="ghost" />
        {showUniForm && (
          <View style={{ marginTop: 8 }}>
            <Input label="University Name *" value={uniName} onChangeText={setUniName} />
            <Input label="General Email *" value={uniEmail} onChangeText={setUniEmail} keyboardType="email-address" autoCapitalize="none" />
            <Btn title="Add University" onPress={addUniversity} />
          </View>
        )}
        {universities.length > 0 && (
          <>
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>All Universities</Text>
            {universities.map((u, i) => (
              <View key={u.id} style={[styles.hallRow, i < universities.length - 1 && styles.border]}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.muted}>{u.general_email}</Text>
              </View>
            ))}
          </>
        )}
      </Card>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16 },
  welcomeText: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  pickerWrap: { backgroundColor: '#243048', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  picker: { color: COLORS.text, height: 48 },
  userName: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  userEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  userIndex: { color: COLORS.primary, fontSize: 12 },
  userDate: { color: COLORS.textMuted, fontSize: 11 },
  hallRow: { paddingVertical: 10 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  concernMsg: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dayLabel: { color: COLORS.textMuted, fontSize: 12, minWidth: 70 },
  barTrack: { height: 8, backgroundColor: COLORS.cardBorder, borderRadius: 4, flex: 1, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  dayCount: { color: COLORS.textMuted, fontSize: 12, minWidth: 70, textAlign: 'right' },
});