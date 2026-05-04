import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { get, post, trackUsage } from '../utils/api';
import { COLORS, Card, Btn, Input, SectionHeader, Loader, EmptyState } from '../components/UI';

const CATEGORIES = ['General', 'Timetable', 'Attendance', 'Grading', 'Facilities', 'Other'];

export function ConcernsScreen() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [selectedUni, setSelectedUni] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [c, u] = await Promise.all([
      get(`/users/${user.id}/concerns`).catch(() => []),
      get('/universities').catch(() => []),
    ]);
    setConcerns(c || []);
    setUniversities(u || []);
    setLoading(false);
    trackUsage('page_view', 'concerns', null, user.id);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submitConcern = async () => {
    if (!selectedUni) { Alert.alert('Error', 'Select a university'); return; }
    if (!message.trim() || message.trim().length < 3) { Alert.alert('Error', 'Message is too short'); return; }
    if (message.length > 2000) { Alert.alert('Error', 'Message must be under 2000 characters'); return; }
    setSubmitting(true);
    const res = await post('/concerns', {
      user_id: user.id,
      university_id: selectedUni,
      category,
      message: message.trim(),
    });
    setSubmitting(false);
    if (res?.error) { Alert.alert('Error', res.error); return; }
    Alert.alert('Submitted', 'Your concern has been submitted.');
    setSelectedUni(''); setCategory('General'); setMessage('');
    trackUsage('concern_submit', 'concerns', { university_id: selectedUni, category }, user.id);
    load();
  };

  if (loading) return <Loader />;

  const uniMap = new Map((universities || []).map(u => [String(u.id), u.name]));
  const statusColor = { open: COLORS.warning, forwarded: COLORS.info, resolved: COLORS.success };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Submit Form */}
      <Card>
        <SectionHeader title="Submit a Concern" />
        <Text style={styles.inputLabel}>University</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedUni} onValueChange={setSelectedUni} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            <Picker.Item label="Select university" value="" color={COLORS.textMuted} />
            {universities.map(u => <Picker.Item key={u.id} label={u.name} value={String(u.id)} color={COLORS.text} />)}
          </Picker>
        </View>

        <Text style={styles.inputLabel}>Category</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker} dropdownIconColor={COLORS.textMuted}>
            {CATEGORIES.map(c => <Picker.Item key={c} label={c} value={c} color={COLORS.text} />)}
          </Picker>
        </View>

        <Input
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your concern (3–2000 characters)…"
          multiline
          numberOfLines={5}
          inputStyle={{ height: 120, textAlignVertical: 'top' }}
        />
        <Text style={styles.charCount}>{message.length}/2000</Text>

        <Btn
          title={submitting ? 'Submitting…' : 'Submit Concern'}
          onPress={submitConcern}
          disabled={submitting}
        />
      </Card>

      {/* Previous Concerns */}
      <Card>
        <SectionHeader title="My Concerns" />
        {concerns.length === 0 ? (
          <EmptyState msg="No concerns submitted yet." />
        ) : (
          concerns.map((c, i) => (
            <View key={i} style={[styles.concernRow, i < concerns.length - 1 && styles.border]}>
              <View style={styles.concernHeader}>
                <Text style={styles.uniName}>{uniMap.get(String(c.university_id)) || '—'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor[c.status] || COLORS.textMuted }]}>
                  <Text style={styles.statusText}>{c.status || 'open'}</Text>
                </View>
              </View>
              <Text style={styles.category}>{c.category || '—'}</Text>
              <Text style={styles.message} numberOfLines={4}>{c.message || ''}</Text>
              <Text style={styles.date}>{c.created_at ? String(c.created_at).slice(0, 10) : '—'}</Text>
            </View>
          ))
        )}
      </Card>

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
  charCount: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right', marginTop: -8, marginBottom: 8 },
  concernRow: { paddingVertical: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  concernHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  uniName: { color: COLORS.text, fontWeight: '600', fontSize: 13, flex: 1 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  category: { color: COLORS.primary, fontSize: 12, marginBottom: 4 },
  message: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  date: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
});