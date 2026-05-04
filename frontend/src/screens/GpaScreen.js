import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { get, post, put, del, trackUsage, GRADE_POINTS, normalizeCode } from '../utils/api';
import {
  COLORS, Card, Btn, Input, SectionHeader, Loader, Row, Divider,
  StatCard, EmptyState,
} from '../components/UI';

const GRADES = ['', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'F'];

export function GpaScreen() {
  const { user } = useAuth();
  const [gpaData, setGpaData] = useState(null);
  const [universities, setUniversities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGoal, setShowGoal] = useState(false);

  // Add form state
  const [modName, setModName] = useState('');
  const [modCode, setModCode] = useState('');
  const [modUniversity, setModUniversity] = useState('');
  const [modYear, setModYear] = useState('1');
  const [modSemInYear, setModSemInYear] = useState('1');
  const [modCredits, setModCredits] = useState('3');
  const [modCa, setModCa] = useState('');
  const [modGrade, setModGrade] = useState('');

  // Goal planner
  const [goalTargetGpa, setGoalTargetGpa] = useState('');
  const [goalModuleCount, setGoalModuleCount] = useState('');
  const [goalCreditsPerMod, setGoalCreditsPerMod] = useState('3');
  const [goalResult, setGoalResult] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [gpa, unis] = await Promise.all([
      get(`/users/${user.id}/gpa`),
      get('/universities').catch(() => []),
    ]);
    setGpaData(gpa);
    setUniversities(unis || []);
    trackUsage('page_view', 'gpa', null, user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addModule = async () => {
    const name = modName.trim();
    const code = normalizeCode(modCode);
    const academic_year = parseInt(modYear, 10);
    const semester_in_year = parseInt(modSemInYear, 10);
    const credits = parseInt(modCredits, 10);
    const ca = modCa ? parseInt(modCa, 10) : null;
    const grade_letter = modGrade || null;
    const grade_point = grade_letter ? (GRADE_POINTS[grade_letter] ?? null) : null;
    const semester = (academic_year - 1) * 2 + semester_in_year;

    if (!name || name.length > 255) { Alert.alert('Error', 'Module name required (1–255 chars)'); return; }
    if (!code) { Alert.alert('Error', 'Module code required'); return; }
    if (!modUniversity) { Alert.alert('Error', 'Select a university'); return; }
    if (isNaN(academic_year) || academic_year < 1 || academic_year > 10) { Alert.alert('Error', 'Academic year must be 1–10'); return; }
    if (isNaN(semester_in_year) || semester_in_year < 1 || semester_in_year > 3) { Alert.alert('Error', 'Semester must be 1–3'); return; }
    if (isNaN(credits) || credits < 1 || credits > 30) { Alert.alert('Error', 'Credits must be 1–30'); return; }
    if (ca != null && (isNaN(ca) || ca < 0 || ca > 100)) { Alert.alert('Error', 'CA% must be 0–100'); return; }

    const res = await post('/modules', {
      user_id: user.id,
      university_id: modUniversity,
      academic_year,
      semester_in_year,
      name,
      code,
      credits,
      grade_letter,
      grade_point,
      ca_percentage: ca,
      semester,
    });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    if (res?.updated) Alert.alert('Updated', 'Existing module record was updated for this code.');
    setModName(''); setModCode(''); setModUniversity(''); setModYear('1');
    setModSemInYear('1'); setModCredits('3'); setModCa(''); setModGrade('');
    setShowAddForm(false);
    trackUsage('module_add', 'gpa', { credits, semester }, user.id);
    load();
  };

  const deleteModule = (id) => {
    Alert.alert('Delete Module', 'Remove this module from your record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await del(`/modules/${id}`); load(); } },
    ]);
  };

  const calculateGoal = () => {
    const target = parseFloat(goalTargetGpa);
    const moduleCount = parseInt(goalModuleCount, 10);
    const creditsPerMod = parseInt(goalCreditsPerMod, 10) || 3;
    if (isNaN(target) || isNaN(moduleCount) || moduleCount < 1) {
      Alert.alert('Error', 'Enter target GPA and number of remaining modules');
      return;
    }
    const modules = gpaData?.modules || [];
    let completedCredits = 0, currentPoints = 0;
    modules.forEach(m => {
      if (m.grade_point != null) {
        completedCredits += m.credits;
        currentPoints += m.grade_point * m.credits;
      }
    });
    const remainingCredits = moduleCount * creditsPerMod;
    const totalCredits = completedCredits + remainingCredits;
    const requiredTotalPoints = target * totalCredits;
    const remainingPoints = requiredTotalPoints - currentPoints;
    if (remainingPoints <= 0) {
      setGoalResult({ message: '🎉 You have already achieved your target GPA!' });
      return;
    }
    const requiredGpaPerModule = remainingPoints / remainingCredits;
    const clamp = Math.min(4.0, Math.max(0, requiredGpaPerModule));
    let suggestedGrade = 'F';
    for (const [g, p] of Object.entries(GRADE_POINTS)) {
      if (p >= clamp) { suggestedGrade = g; break; }
    }
    setGoalResult({
      requiredRemainingGPA: clamp.toFixed(2),
      suggestedGrade,
      remainingPoints: remainingPoints.toFixed(2),
      totalCredits,
      completedCredits,
      remainingCredits,
    });
  };

  if (!gpaData) return <Loader />;

  const modules = gpaData.modules || [];
  const semesters = gpaData.semesters || [];
  const cgpa = gpaData.overall?.gpa ?? 0;
  const totalCredits = gpaData.overall?.credits ?? 0;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Summary */}
      <Row style={{ flexWrap: 'wrap' }}>
        <StatCard label="CGPA" value={cgpa} />
        <StatCard label="Total Credits" value={totalCredits} />
        <StatCard label="Semesters" value={semesters.length} />
      </Row>

      {/* Semester breakdown */}
      {semesters.map((sem, si) => {
        const year = Math.ceil(sem.semester / 2);
        const semInYear = sem.semester % 2 === 0 ? 2 : 1;
        return (
          <Card key={si}>
            <Text style={styles.semTitle}>Year {year} · Semester {semInYear} · GPA: <Text style={{ color: COLORS.primary }}>{sem.gpa}</Text></Text>
            {sem.modules.map((m, mi) => (
              <View key={mi} style={styles.moduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moduleName}>{m.name}</Text>
                  <Text style={styles.muted}>{m.code || '–'} · {m.credits} cr{m.ca_percentage != null ? ` · CA: ${m.ca_percentage}%` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.grade, { color: m.grade_letter ? COLORS.primary : COLORS.textMuted }]}>{m.grade_letter || '–'}</Text>
                  <TouchableOpacity onPress={() => deleteModule(m.id)}>
                    <Text style={{ color: COLORS.error, fontSize: 11, marginTop: 2 }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
        );
      })}

      {modules.length === 0 && <EmptyState msg="No modules yet. Add your first module below." />}

      {/* Add Module */}
      <Btn
        title={showAddForm ? 'Cancel' : '+ Add Module'}
        onPress={() => setShowAddForm(v => !v)}
        variant={showAddForm ? 'ghost' : 'primary'}
        style={{ marginBottom: 8 }}
      />
      {showAddForm && (
        <Card>
          <SectionHeader title="Add Module" />
          <Input label="Module Name *" value={modName} onChangeText={setModName} placeholder="e.g. Data Structures" />
          <Input label="Module Code *" value={modCode} onChangeText={setModCode} placeholder="e.g. CS301" autoCapitalize="characters" />

          <Text style={styles.inputLabel}>University *</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={modUniversity} onValueChange={setModUniversity} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
              <Picker.Item label="Select university" value="" color={COLORS.textMuted} />
              {universities.map(u => <Picker.Item key={u.id} label={u.name} value={String(u.id)} color={COLORS.text} />)}
            </Picker>
          </View>

          <Row>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Academic Year</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={modYear} onValueChange={setModYear} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
                  {[1,2,3,4,5,6].map(y => <Picker.Item key={y} label={`Year ${y}`} value={String(y)} color={COLORS.text} />)}
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Semester</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={modSemInYear} onValueChange={setModSemInYear} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
                  {[1,2,3].map(s => <Picker.Item key={s} label={`Sem ${s}`} value={String(s)} color={COLORS.text} />)}
                </Picker>
              </View>
            </View>
          </Row>

          <Row>
            <Input label="Credits" value={modCredits} onChangeText={setModCredits} keyboardType="number-pad" style={{ flex: 1 }} />
            <Input label="CA %" value={modCa} onChangeText={setModCa} keyboardType="number-pad" placeholder="0–100" style={{ flex: 1 }} />
          </Row>

          <Text style={styles.inputLabel}>Grade</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={modGrade} onValueChange={setModGrade} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
              {GRADES.map(g => <Picker.Item key={g} label={g || 'No grade yet'} value={g} color={COLORS.text} />)}
            </Picker>
          </View>

          <Btn title="Add Module" onPress={addModule} style={{ marginTop: 8 }} />
        </Card>
      )}

      <Divider />

      {/* Goal Planner */}
      <Btn title={showGoal ? 'Hide Goal Planner' : '📊 GPA Goal Planner'} onPress={() => setShowGoal(v => !v)} variant="ghost" />
      {showGoal && (
        <Card style={{ marginTop: 8 }}>
          <SectionHeader title="Goal Planner" />
          <Text style={styles.muted}>Calculate what grades you need in remaining modules to hit your target GPA.</Text>
          <Input label="Target CGPA" value={goalTargetGpa} onChangeText={setGoalTargetGpa} keyboardType="decimal-pad" placeholder="e.g. 3.5" style={{ marginTop: 12 }} />
          <Row>
            <Input label="Remaining Modules" value={goalModuleCount} onChangeText={setGoalModuleCount} keyboardType="number-pad" style={{ flex: 1 }} />
            <Input label="Credits/Module" value={goalCreditsPerMod} onChangeText={setGoalCreditsPerMod} keyboardType="number-pad" style={{ flex: 1 }} />
          </Row>
          <Btn title="Calculate" onPress={calculateGoal} />

          {goalResult && (
            <View style={styles.goalResult}>
              {goalResult.message ? (
                <Text style={{ color: COLORS.success, fontSize: 15, fontWeight: '600' }}>{goalResult.message}</Text>
              ) : (
                <>
                  <Text style={styles.goalTitle}>To achieve GPA {goalTargetGpa}:</Text>
                  <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    <StatCard label="Required GPA/Module" value={goalResult.requiredRemainingGPA} />
                    <StatCard label="Suggested Grade" value={goalResult.suggestedGrade} />
                    <StatCard label="Points Needed" value={goalResult.remainingPoints} />
                  </Row>
                  <Text style={[styles.muted, { marginTop: 8 }]}>This is an estimate based on current records.</Text>
                </>
              )}
            </View>
          )}
        </Card>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16 },
  semTitle: { color: COLORS.text, fontWeight: '600', marginBottom: 8 },
  moduleRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  moduleName: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  grade: { fontSize: 16, fontWeight: '700' },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  pickerWrap: { backgroundColor: '#243048', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  picker: { color: COLORS.text, height: 48 },
  goalResult: { marginTop: 16, padding: 12, backgroundColor: '#243048', borderRadius: 8 },
  goalTitle: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
});