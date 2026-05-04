import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { get, post, patch, del, trackUsage, normalizeCode } from '../utils/api';
import { COLORS, Card, Btn, Input, SectionHeader, Loader, Row, Badge, EmptyState } from '../components/UI';

export function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [modules, setModules] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add form
  const [title, setTitle] = useState('');
  const [moduleCode, setModuleCode] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('5');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [t, m] = await Promise.all([
      get(`/users/${user.id}/tasks`),
      get(`/users/${user.id}/modules`),
    ]);
    const sorted = (t || []).sort((a, b) => {
      const pa = parseInt(a.priority_score, 10) || 0;
      const pb = parseInt(b.priority_score, 10) || 0;
      if (pa !== pb) return pb - pa;
      const da = a.due_date ? String(a.due_date) : '9999-12-31';
      const db = b.due_date ? String(b.due_date) : '9999-12-31';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    setTasks(sorted);
    setModules(m || []);
    trackUsage('page_view', 'tasks', null, user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addTask = async () => {
    const t = title.trim();
    const code = normalizeCode(moduleCode);
    const p = parseInt(priority, 10) || 5;
    if (!t || t.length > 500) { Alert.alert('Error', 'Task title required (1–500 chars)'); return; }
    if (!code) { Alert.alert('Error', 'Module code required'); return; }
    if (p < 1 || p > 10) { Alert.alert('Error', 'Priority must be 1–10'); return; }
    const res = await post('/tasks', { user_id: user.id, module_code: code, title: t, due_date: dueDate || null, priority_score: p });
    if (res?.error) { Alert.alert('Error', res.error); return; }
    setTitle(''); setModuleCode(''); setDueDate(''); setPriority('5'); setShowForm(false);
    trackUsage('task_add', 'tasks', { due_date: dueDate }, user.id);
    load();
  };

  const toggleTask = async (task) => {
    const newCompleted = !task.completed;
    await patch(`/tasks/${task.id}`, { completed: newCompleted });
    trackUsage(newCompleted ? 'task_complete' : 'task_uncomplete', 'tasks', { task_id: task.id }, user.id);
    load();
  };

  const deleteTask = (id) => {
    Alert.alert('Delete Task', 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await del(`/tasks/${id}`); trackUsage('task_delete', 'tasks', { task_id: id }, user.id); load(); } },
    ]);
  };

  // Group by credit weight
  const moduleByCode = new Map((modules || []).map(m => [normalizeCode(m.code), m]));
  const grouped = {};
  tasks.forEach(t => {
    const mod = moduleByCode.get(normalizeCode(t.module_code));
    const credits = mod?.credits || 0;
    const key = credits > 0 ? `${credits} Credits` : 'Unassigned';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  const groupKeys = Object.keys(grouped).sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));

  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Progress */}
      {total > 0 && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: COLORS.text, fontWeight: '600' }}>Progress</Text>
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{completed}/{total} done</Text>
          </Row>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${total > 0 ? (completed / total) * 100 : 0}%` }]} />
          </View>
        </Card>
      )}

      {/* Add Task */}
      <Btn title={showForm ? 'Cancel' : '+ Add Task'} onPress={() => setShowForm(v => !v)} variant={showForm ? 'ghost' : 'primary'} style={{ marginBottom: 8 }} />
      {showForm && (
        <Card>
          <SectionHeader title="New Task" />
          <Input label="Task Title *" value={title} onChangeText={setTitle} placeholder="e.g. Assignment 1 submission" />
          <Input label="Module Code *" value={moduleCode} onChangeText={setModuleCode} placeholder="e.g. CS301" autoCapitalize="characters" />
          <Input label="Due Date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2024-12-01" />
          <Text style={styles.inputLabel}>Priority (1–10)</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={priority} onValueChange={setPriority} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
              {[1,2,3,4,5,6,7,8,9,10].map(p => (
                <Picker.Item key={p} label={`${p} — ${p >= 8 ? 'High' : p >= 5 ? 'Medium' : 'Low'}`} value={String(p)} color={COLORS.text} />
              ))}
            </Picker>
          </View>
          <Btn title="Add Task" onPress={addTask} />
        </Card>
      )}

      {/* Task List */}
      {total === 0 && !showForm && <EmptyState msg="No tasks yet. Add your first task above." />}
      {groupKeys.map(group => (
        <Card key={group}>
          <Text style={styles.groupTitle}>{group}</Text>
          {grouped[group].map((task, i) => {
            const badgeType = task.priority_score >= 8 ? 'high' : task.priority_score >= 5 ? 'medium' : 'low';
            const today = new Date(); today.setHours(0,0,0,0);
            const due = task.due_date ? new Date(task.due_date) : null;
            const diffDays = due ? Math.ceil((due - today) / 86400000) : null;
            const overdue = diffDays != null && diffDays < 0 && !task.completed;

            return (
              <View key={task.id} style={[styles.taskRow, i < grouped[group].length - 1 && styles.taskBorder]}>
                <TouchableOpacity onPress={() => toggleTask(task)} style={styles.checkbox}>
                  <View style={[styles.checkboxInner, task.completed && { backgroundColor: COLORS.primary }]}>
                    {task.completed && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, task.completed && styles.completed]}>{task.title}</Text>
                  <Row style={{ marginTop: 2, flexWrap: 'wrap', gap: 6 }}>
                    {task.module_code ? <Text style={styles.muted}>{task.module_code}</Text> : null}
                    {task.due_date ? (
                      <Text style={[styles.muted, overdue && { color: COLORS.error }]}>
                        {overdue ? '⚠ ' : ''}Due: {task.due_date}
                      </Text>
                    ) : null}
                    <Badge label={`P${task.priority_score}`} type={badgeType} />
                  </Row>
                </View>
                <TouchableOpacity onPress={() => deleteTask(task.id)} style={{ padding: 8 }}>
                  <Text style={{ color: COLORS.error, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </Card>
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16 },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  pickerWrap: { backgroundColor: '#243048', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  picker: { color: COLORS.text, height: 48 },
  groupTitle: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  taskBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  checkbox: { marginRight: 10 },
  checkboxInner: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { color: COLORS.text, fontSize: 14 },
  completed: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  progressBar: { height: 8, backgroundColor: COLORS.cardBorder, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
});