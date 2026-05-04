import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { get, post, put, del, trackUsage, GRADE_POINTS, isGradeBelowC, normalizeCode } from '../utils/api';
import { COLORS, Card, Btn, Input, SectionHeader, Row, Divider, EmptyState, StatCard } from '../components/UI';

const GRADES = ['', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'F'];

export function RepeatScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Improve form
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [markAsNormal, setMarkAsNormal] = useState(true);

  // Add repeat module form
  const [showAdd, setShowAdd] = useState(false);
  const [addUni, setAddUni] = useState('');
  const [addName, setAddName] = useState('');
  const [addCode, setAddCode] = useState('');
  const [addYear, setAddYear] = useState('1');
  const [addSem, setAddSem] = useState('1');
  const [addCredits, setAddCredits] = useState('3');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [mods, unis] = await Promise.all([
      get(`/users/${user.id}/modules`),
      get('/universities').catch(() => []),
    ]);
    setModules(mods || []);
    setUniversities(unis || []);
    trackUsage('page_view', 'repeat', null, user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const repeatCandidates = modules.filter(
    m => Boolean(m.is_repeat) || isGradeBelowC(m.grade_letter) || m.source_type === 'repeat_add'
  );
  const normalCount = modules.length - repeatCandidates.length;

  const improveModule = async () => {
    if (!selectedModuleId || !newGrade) { Alert.alert('Error', 'Select a module and new grade'); return; }
    const gradePoint = GRADE_POINTS[newGrade] ?? null;
    const res = await put(`/modules/${selectedModuleId}`, {
      grade_letter: newGrade,
      grade_point: gradePoint,
      is_repeat: markAsNormal ? 0 : 1,
    });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    setSelectedModuleId(''); setNewGrade('');
    trackUsage('repeat_improve', 'repeat', { module_id: selectedModuleId, grade_letter: newGrade }, user.id);
    load();
  };

  const removeModule = (id) => {
    Alert.alert('Remove Module', 'Remove this entry from your academic history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await del(`/modules/${id}`);
          trackUsage('module_remove', 'repeat', { module_id: id }, user.id);
          load();
        }
      },
    ]);
  };

  const addRepeatModule = async () => {
    if (!addUni || !addName.trim() || !addCode.trim()) { Alert.alert('Error', 'Fill all fields'); return; }
    const ay = parseInt(addYear, 10);
    const si = parseInt(addSem, 10);
    const cr = parseInt(addCredits, 10);
    const res = await post('/modules', {
      user_id: user.id,
      university_id: addUni,
      academic_year: ay,
      semester_in_year: si,
      source_type: 'repeat_add',
      name: addName.trim(),
      code: addCode.trim().toUpperCase(),
      credits: cr,
      semester: (ay - 1) * 2 + si,
      is_repeat: 1,
    });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    if (res?.updated) Alert.alert('Updated', 'Existing module record updated.');
    setAddName(''); setAddCode(''); setAddYear('1'); setAddSem('1'); setAddCredits('3'); setShowAdd(false);
    load();
  };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Stats */}
      <Row style={{ flexWrap: 'wrap' }}>
        <StatCard label="Total Modules" value={modules.length} />
        <StatCard label="Normal" value={normalCount} />
        <StatCard label="Repeat/Below C" value={repeatCandidates.length} />
      </Row>

      {/* Repeat Modules List */}
      <Card>
        <SectionHeader title="Modules Needing Attention" />
        {repeatCandidates.length === 0 ? (
          <EmptyState msg="No repeat modules. Add modules in GPA Calculator first." />
        ) : (
          repeatCandidates.map((m, i) => (
            <View key={m.id} style={[styles.modRow, i < repeatCandidates.length - 1 && styles.border]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modName}>{m.name}</Text>
                <Text style={styles.muted}>
                  {m.code || '–'} · {m.credits} cr · Y{m.academic_year}/S{m.semester_in_year}
                  {m.is_repeat ? ' · 🔁 Repeat' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.grade, { color: m.grade_letter ? COLORS.error : COLORS.textMuted }]}>{m.grade_letter || '–'}</Text>
                <TouchableOpacity onPress={() => setSelectedModuleId(String(m.id))}>
                  <Text style={{ color: COLORS.primary, fontSize: 11 }}>Improve</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeModule(m.id)}>
                  <Text style={{ color: COLORS.error, fontSize: 11 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Record Improvement */}
      <Card>
        <SectionHeader title="Record Grade Improvement" />
        <Text style={styles.inputLabel}>Select Module</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedModuleId} onValueChange={setSelectedModuleId} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            <Picker.Item label="Select module" value="" color={COLORS.textMuted} />
            {repeatCandidates.map(m => (
              <Picker.Item key={m.id} label={`${m.name}${m.code ? ` (${m.code})` : ''} — ${m.grade_letter || '–'}`} value={String(m.id)} color={COLORS.text} />
            ))}
          </Picker>
        </View>

        <Text style={styles.inputLabel}>New Grade</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={newGrade} onValueChange={setNewGrade} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            {GRADES.map(g => <Picker.Item key={g} label={g || 'Select grade'} value={g} color={COLORS.text} />)}
          </Picker>
        </View>

        <TouchableOpacity onPress={() => setMarkAsNormal(v => !v)} style={styles.checkRow}>
          <View style={[styles.checkBox, markAsNormal && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
            {markAsNormal && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
          </View>
          <Text style={{ color: COLORS.text, fontSize: 14, marginLeft: 8 }}>Mark as no longer a repeat</Text>
        </TouchableOpacity>

        <Btn title="Record Improvement" onPress={improveModule} style={{ marginTop: 12 }} />
      </Card>

      <Divider />

      {/* Add Repeat Module */}
      <Btn title={showAdd ? 'Cancel' : '+ Add Repeat Module'} onPress={() => setShowAdd(v => !v)} variant="ghost" />
      {showAdd && (
        <Card style={{ marginTop: 8 }}>
          <SectionHeader title="Add Repeat / Historical Module" />
          <Text style={styles.inputLabel}>University</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={addUni} onValueChange={setAddUni} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
              <Picker.Item label="Select university" value="" color={COLORS.textMuted} />
              {universities.map(u => <Picker.Item key={u.id} label={u.name} value={String(u.id)} color={COLORS.text} />)}
            </Picker>
          </View>
          <Input label="Module Name" value={addName} onChangeText={setAddName} />
          <Input label="Module Code" value={addCode} onChangeText={setAddCode} autoCapitalize="characters" />
          <Row>
            <Input label="Academic Year" value={addYear} onChangeText={setAddYear} keyboardType="number-pad" style={{ flex: 1 }} />
            <Input label="Semester" value={addSem} onChangeText={setAddSem} keyboardType="number-pad" style={{ flex: 1 }} />
            <Input label="Credits" value={addCredits} onChangeText={setAddCredits} keyboardType="number-pad" style={{ flex: 1 }} />
          </Row>
          <Btn title="Add Module" onPress={addRepeatModule} />
        </Card>
      )}

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
  modRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  modName: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  grade: { fontSize: 18, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});