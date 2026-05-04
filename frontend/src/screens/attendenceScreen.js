import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { get, post, postForm, trackUsage, haversineMeters } from '../utils/api';
import {
  COLORS, Card, Btn, Input, SectionHeader, Loader, Row,
  Divider, EmptyState,
} from '../components/UI';

export function AttendanceScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [halls, setHalls] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Selections
  const [selectedUni, setSelectedUni] = useState('');
  const [selectedHall, setSelectedHall] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('offline');
  const [lectureDate, setLectureDate] = useState('');
  const [semester, setSemester] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [attended, setAttended] = useState('');
  const [totalSessions, setTotalSessions] = useState('');

  // Geofence
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | checking | within | outside
  const [geoMessage, setGeoMessage] = useState('');
  const [canMark, setCanMark] = useState(false);

  // Schedule slots
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');

  // Add module form
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModName, setNewModName] = useState('');
  const [newModCode, setNewModCode] = useState('');
  const [newModYear, setNewModYear] = useState('1');
  const [newModSem, setNewModSem] = useState('1');

  // Add slot form
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotDay, setSlotDay] = useState('Monday');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotModule, setSlotModule] = useState('');
  const [slotMode, setSlotMode] = useState('physical');
  const [slotSemester, setSlotSemester] = useState('');
  const [slotYear, setSlotYear] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [mods, unis, att] = await Promise.all([
      get(`/users/${user.id}/modules`),
      get('/universities').catch(() => []),
      get(`/users/${user.id}/attendance-logs`).catch(() => []),
    ]);
    setModules(mods || []);
    setUniversities(unis || []);
    setAttendance(att || []);
    trackUsage('page_view', 'attendance', null, user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const loadHalls = async (uniId) => {
    if (!uniId) { setHalls([]); return; }
    const h = await get(`/universities/${uniId}/halls`).catch(() => []);
    setHalls(h || []);
  };

  const loadSlots = async () => {
    if (!selectedUni || !slotSemester || !slotYear) return;
    const rows = await get(`/attendance/slots?user_id=${user.id}&university_id=${selectedUni}&semester=${slotSemester}&year_number=${slotYear}`).catch(() => []);
    setSlots(rows || []);
  };

  useEffect(() => { loadSlots(); }, [selectedUni, slotSemester, slotYear]);

  const checkGeofence = async () => {
    if (deliveryMode === 'online') {
      setGeoStatus('within');
      setGeoMessage('Online lecture mode — geofence not required.');
      setCanMark(true);
      return;
    }
    if (!selectedUni) { Alert.alert('Error', 'Select a university first'); return; }
    if (halls.length === 0) { Alert.alert('No halls', 'No lecture halls configured for this university.'); return; }

    setGeoStatus('checking');
    setGeoMessage('Getting your GPS position…');
    setCanMark(false);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGeoStatus('outside');
      setGeoMessage('Location permission denied. Please enable it in settings.');
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const selectedHallObj = halls.find(h => String(h.id) === String(selectedHall));
      const hallsToCheck = selectedHallObj ? [selectedHallObj] : halls;

      let within = false, nearestHall = null, nearestDist = Infinity;
      for (const h of hallsToCheck) {
        const dist = haversineMeters(latitude, longitude, parseFloat(h.center_lat), parseFloat(h.center_lng));
        if (dist <= parseFloat(h.radius_m)) {
          within = true;
          if (dist < nearestDist) { nearestDist = dist; nearestHall = h; }
        }
      }

      if (within) {
        setGeoStatus('within');
        setGeoMessage(`✓ Inside: ${nearestHall.hall_name}${nearestHall.building_name ? ` (${nearestHall.building_name})` : ''}`);
        setCanMark(true);
        trackUsage('attendance_geofence_ok', 'attendance', { hall_id: nearestHall?.id }, user.id);
      } else {
        setGeoStatus('outside');
        setGeoMessage('Outside lecture hall geofences. Move to the designated area.');
        setCanMark(false);
      }
    } catch (e) {
      setGeoStatus('outside');
      setGeoMessage('Could not get location. Please try again.');
    }
  };

  const markAttendance = async () => {
    if (!lectureDate) { Alert.alert('Error', 'Select lecture date'); return; }
    if (!selectedModule) { Alert.alert('Error', 'Select a module'); return; }
    if (!selectedSlot) { Alert.alert('Error', 'Select a verified schedule slot'); return; }
    const att = parseInt(attended, 10) || 0;
    const tot = parseInt(totalSessions, 10) || 0;
    if (att > tot) { Alert.alert('Error', 'Attended cannot exceed total sessions'); return; }
    if (deliveryMode === 'offline' && !selectedHall) { Alert.alert('Error', 'Select lecture hall for offline mode'); return; }

    const fd = new FormData();
    fd.append('user_id', user.id);
    fd.append('slot_id', selectedSlot);
    fd.append('module_name', selectedModule);
    fd.append('attended', att);
    fd.append('total_sessions', tot);
    fd.append('semester', semester);
    fd.append('academic_year', academicYear);
    fd.append('delivery_mode', deliveryMode);
    if (selectedUni) fd.append('university_id', selectedUni);
    if (selectedHall) fd.append('hall_id', selectedHall);
    fd.append('lecture_date', lectureDate);

    const res = await postForm('/attendance/mark', fd);
    if (res?.error) { Alert.alert('Error', res.error); return; }

    const statusMsg = {
      auto_verified: 'Attendance marked and verified!',
      pending: 'Submitted for admin verification (online proof needed).',
      timetable_missing: 'Submitted, but timetable verification pending. Upload your timetable PDF.',
    }[res.verification_status] || 'Attendance submitted.';
    Alert.alert('Success', statusMsg);

    setAttended(''); setTotalSessions(''); setSelectedSlot('');
    trackUsage('attendance_mark', 'attendance', { module_name: selectedModule, delivery_mode: deliveryMode }, user.id);
    load();
  };

  const addScheduleSlot = async () => {
    if (!selectedUni || !slotDay || !slotStart || !slotEnd || !slotModule || !slotSemester || !slotYear) {
      Alert.alert('Error', 'Fill all slot fields'); return;
    }
    const res = await post('/attendance/slots', {
      user_id: user.id,
      university_id: selectedUni,
      semester: slotSemester,
      year_number: slotYear,
      day_of_week: slotDay,
      start_time: slotStart,
      end_time: slotEnd,
      module_name: slotModule,
      delivery_mode: slotMode,
      hall_id: slotMode === 'physical' ? selectedHall || null : null,
    });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    setSlotStart(''); setSlotEnd(''); setSlotModule(''); setShowAddSlot(false);
    loadSlots();
  };

  const addModule = async () => {
    if (!newModName.trim() || !newModCode.trim() || !selectedUni) { Alert.alert('Error', 'Fill all module fields'); return; }
    const ay = parseInt(newModYear, 10);
    const si = parseInt(newModSem, 10);
    const res = await post('/modules', {
      user_id: user.id,
      university_id: selectedUni,
      academic_year: ay,
      semester_in_year: si,
      name: newModName.trim(),
      code: newModCode.trim().toUpperCase(),
      credits: 3,
      semester: (ay - 1) * 2 + si,
    });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    setNewModName(''); setNewModCode(''); setShowAddModule(false);
    load();
  };

  const geoColor = { idle: COLORS.textMuted, checking: COLORS.warning, within: COLORS.success, outside: COLORS.error }[geoStatus];

  if (!modules && !universities) return <Loader />;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Attendance Summary */}
      <Card>
        <SectionHeader title="Attendance Summary" />
        {attendance.length === 0 ? (
          <Text style={styles.muted}>No records yet</Text>
        ) : (
          attendance.map((a, i) => {
            const pct = Math.round((a.attended / (a.total_sessions || 1)) * 100);
            const color = pct >= 80 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.error;
            return (
              <View key={i} style={styles.attRow}>
                <Text style={styles.attMod}>{a.module_name} {a.delivery_mode === 'online' ? '(Online)' : '(Physical)'}</Text>
                <Text style={[styles.attPct, { color }]}>{a.attended}/{a.total_sessions} · {pct}%</Text>
              </View>
            );
          })
        )}
      </Card>

      {/* University & Hall Selection */}
      <Card>
        <SectionHeader title="Location Setup" />
        <Text style={styles.inputLabel}>University</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedUni} onValueChange={v => { setSelectedUni(v); loadHalls(v); }} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            <Picker.Item label="Select university" value="" color={COLORS.textMuted} />
            {universities.map(u => <Picker.Item key={u.id} label={u.name} value={String(u.id)} color={COLORS.text} />)}
          </Picker>
        </View>

        {halls.length > 0 && (
          <>
            <Text style={styles.inputLabel}>Lecture Hall (optional)</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedHall} onValueChange={setSelectedHall} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
                <Picker.Item label="Any hall" value="" color={COLORS.textMuted} />
                {halls.map(h => <Picker.Item key={h.id} label={`${h.hall_name}${h.building_name ? ` (${h.building_name})` : ''}`} value={String(h.id)} color={COLORS.text} />)}
              </Picker>
            </View>
            <Text style={styles.muted}>{halls.length} hall(s) configured</Text>
          </>
        )}
      </Card>

      {/* Geofence Check */}
      <Card style={{ borderColor: geoColor, borderWidth: 1.5 }}>
        <SectionHeader title="Location Verification" />
        <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12 }}>Check your GPS before marking attendance for physical lectures.</Text>

        <Text style={styles.inputLabel}>Delivery Mode</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={deliveryMode} onValueChange={v => { setDeliveryMode(v); setGeoStatus('idle'); setCanMark(false); }} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            <Picker.Item label="Offline / Physical" value="offline" color={COLORS.text} />
            <Picker.Item label="Online" value="online" color={COLORS.text} />
          </Picker>
        </View>

        <Btn
          title={geoStatus === 'checking' ? 'Checking…' : 'Check My Location'}
          onPress={checkGeofence}
          disabled={geoStatus === 'checking'}
          variant={canMark ? 'primary' : 'ghost'}
        />
        {geoStatus !== 'idle' && (
          <Text style={[styles.geoMsg, { color: geoColor }]}>{geoMessage}</Text>
        )}
      </Card>

      {/* Mark Attendance Form */}
      {canMark && (
        <Card>
          <SectionHeader title="Mark Attendance" />
          <Input label="Lecture Date (YYYY-MM-DD)" value={lectureDate} onChangeText={setLectureDate} placeholder="2024-11-01" />

          <Row>
            <Input label="Academic Year" value={academicYear} onChangeText={setAcademicYear} keyboardType="number-pad" style={{ flex: 1 }} />
            <Input label="Semester" value={semester} onChangeText={setSemester} keyboardType="number-pad" style={{ flex: 1 }} />
          </Row>

          <Text style={styles.inputLabel}>Module</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={selectedModule} onValueChange={setSelectedModule} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
              <Picker.Item label="Select module" value="" color={COLORS.textMuted} />
              {modules.map((m, i) => <Picker.Item key={i} label={`${m.name}${m.code ? ` (${m.code})` : ''}`} value={m.name} color={COLORS.text} />)}
            </Picker>
          </View>

          {slots.length > 0 && (
            <>
              <Text style={styles.inputLabel}>Schedule Slot</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={selectedSlot} onValueChange={setSelectedSlot} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
                  <Picker.Item label="Select slot" value="" color={COLORS.textMuted} />
                  {slots.map(s => (
                    <Picker.Item
                      key={s.id}
                      label={`${s.module_name} | ${s.start_time}-${s.end_time} | ${s.delivery_mode} ${s.verification_status !== 'auto_verified' ? '(unverified)' : ''}`}
                      value={String(s.id)}
                      color={s.verification_status === 'auto_verified' ? COLORS.text : COLORS.textMuted}
                    />
                  ))}
                </Picker>
              </View>
            </>
          )}

          <Row>
            <Input label="Attended" value={attended} onChangeText={setAttended} keyboardType="number-pad" style={{ flex: 1 }} />
            <Input label="Total Sessions" value={totalSessions} onChangeText={setTotalSessions} keyboardType="number-pad" style={{ flex: 1 }} />
          </Row>

          <Btn title="Mark Attendance" onPress={markAttendance} />
        </Card>
      )}

      <Divider />

      {/* Schedule Slots */}
      <Card>
        <SectionHeader title="My Schedule Slots" />
        <Row>
          <Input label="Semester" value={slotSemester} onChangeText={setSSlot => { setSlotSemester(setSSlot); }} keyboardType="number-pad" style={{ flex: 1 }} />
          <Input label="Year" value={slotYear} onChangeText={setSlotYear} keyboardType="number-pad" style={{ flex: 1 }} />
        </Row>
        {slots.length === 0 ? (
          <Text style={styles.muted}>No slots yet. Add your weekly schedule.</Text>
        ) : (
          slots.map((s, i) => (
            <View key={i} style={styles.slotRow}>
              <Text style={styles.slotDay}>{s.day_of_week}</Text>
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={styles.slotMod}>{s.module_name}</Text>
                <Text style={styles.muted}>{s.start_time}–{s.end_time} · {s.delivery_mode}</Text>
              </View>
              <Text style={{ color: s.verification_status === 'auto_verified' ? COLORS.success : COLORS.warning, fontSize: 11 }}>
                {s.verification_status === 'auto_verified' ? '✓' : '⏳'}
              </Text>
            </View>
          ))
        )}
        <Btn title={showAddSlot ? 'Cancel' : '+ Add Slot'} onPress={() => setShowAddSlot(v => !v)} variant="ghost" style={{ marginTop: 8 }} />
        {showAddSlot && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.inputLabel}>Day</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={slotDay} onValueChange={setSlotDay} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                  <Picker.Item key={d} label={d} value={d} color={COLORS.text} />
                ))}
              </Picker>
            </View>
            <Row>
              <Input label="Start (HH:MM)" value={slotStart} onChangeText={setSlotStart} placeholder="08:30" style={{ flex: 1 }} />
              <Input label="End (HH:MM)" value={slotEnd} onChangeText={setSlotEnd} placeholder="10:30" style={{ flex: 1 }} />
            </Row>
            <Text style={styles.inputLabel}>Module</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={slotModule} onValueChange={setSlotModule} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
                <Picker.Item label="Select module" value="" color={COLORS.textMuted} />
                {modules.map((m, i) => <Picker.Item key={i} label={m.name} value={m.name} color={COLORS.text} />)}
              </Picker>
            </View>
            <Btn title="Add Slot" onPress={addScheduleSlot} />
          </View>
        )}
      </Card>

      {/* Add Module */}
      <Card>
        <SectionHeader title="Add Attendance Module" />
        <Btn title={showAddModule ? 'Cancel' : '+ Add Module'} onPress={() => setShowAddModule(v => !v)} variant="ghost" />
        {showAddModule && (
          <>
            <Input label="Module Name" value={newModName} onChangeText={setNewModName} style={{ marginTop: 8 }} />
            <Input label="Module Code" value={newModCode} onChangeText={setNewModCode} autoCapitalize="characters" />
            <Row>
              <Input label="Academic Year" value={newModYear} onChangeText={setNewModYear} keyboardType="number-pad" style={{ flex: 1 }} />
              <Input label="Semester" value={newModSem} onChangeText={setNewModSem} keyboardType="number-pad" style={{ flex: 1 }} />
            </Row>
            <Btn title="Add Module" onPress={addModule} />
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
  muted: { color: COLORS.textMuted, fontSize: 12 },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  pickerWrap: { backgroundColor: '#243048', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  picker: { color: COLORS.text, height: 48 },
  attRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  attMod: { color: COLORS.text, fontSize: 13, flex: 1 },
  attPct: { fontWeight: '700', fontSize: 13 },
  geoMsg: { marginTop: 8, fontSize: 13, fontWeight: '500' },
  slotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  slotDay: { color: COLORS.primary, fontWeight: '700', fontSize: 12, minWidth: 40 },
  slotMod: { color: COLORS.text, fontSize: 13 },
});