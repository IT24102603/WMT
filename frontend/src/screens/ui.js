import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, TextInput, ScrollView,
} from 'react-native';

export const COLORS = {
  primary: '#00c9a7',
  primaryDark: '#009d82',
  bg: '#0f1923',
  card: '#1a2535',
  cardBorder: '#243048',
  text: '#e2e8f0',
  textMuted: '#8899aa',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#10b981',
  danger: '#dc2626',
};

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children, style }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Value({ children, style }) {
  return <Text style={[styles.value, style]}>{children}</Text>;
}

export function Btn({ title, onPress, variant = 'primary', style, disabled, small }) {
  const bgColor = {
    primary: COLORS.primary,
    danger: COLORS.danger,
    ghost: 'transparent',
    warning: COLORS.warning,
  }[variant] || COLORS.primary;
  const txtColor = variant === 'ghost' ? COLORS.primary : '#fff';
  const border = variant === 'ghost' ? { borderWidth: 1, borderColor: COLORS.primary } : {};
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        { backgroundColor: bgColor },
        border,
        small && { paddingVertical: 6, paddingHorizontal: 12 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: txtColor }, small && { fontSize: 12 }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Input({ label, style, inputStyle, ...props }) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.input, inputStyle]}
        placeholderTextColor={COLORS.textMuted}
        {...props}
      />
    </View>
  );
}

export function SelectRow({ label, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

export function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function ErrorText({ msg }) {
  if (!msg) return null;
  return <Text style={styles.errorText}>{msg}</Text>;
}

export function Loader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

export function EmptyState({ msg }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{msg}</Text>
    </View>
  );
}

export function StatCard({ label, value, color }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statValue} numberOfLines={1}>{String(value ?? '–')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export function Badge({ label, type = 'default' }) {
  const bg = { high: '#dc2626', medium: '#f59e0b', low: '#3b82f6', default: '#374151' }[type];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', gap: 8 }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 12 }} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  label: { color: COLORS.textMuted, fontSize: 12, marginBottom: 2 },
  value: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { fontWeight: '600', fontSize: 14 },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#243048',
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionHeader: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  errorText: { color: COLORS.error, fontSize: 13, marginBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    minWidth: 80,
  },
  statValue: { color: COLORS.primary, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});