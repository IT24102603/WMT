import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { post } from '../utils/api';
import { COLORS, Input, Btn, ErrorText } from '../components/UI';

// ─── Login ───────────────────────────────────────────────────────────────────

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || 'Invalid login');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>UniNavigator</Text>
        <Text style={styles.sub}>Student Academic Companion</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>
          <ErrorText msg={error} />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@university.ac"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <Btn title={loading ? 'Signing in…' : 'Sign In'} onPress={handleLogin} disabled={loading} />
          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.link}>
            <Text style={styles.linkText}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

export function RegisterScreen({ navigation }) {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name.trim() || name.length > 255) { setError('Name is required (1–255 characters)'); return; }
    if (!emailRegex.test(email.trim())) { setError('Enter a valid email address'); return; }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await post('/register', { name: name.trim(), email: email.trim(), password });
      if (res.error) { setError(res.error); setLoading(false); return; }
      // Auto-login after registration
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>UniNavigator</Text>
        <Text style={styles.sub}>Create your account</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Register</Text>
          <ErrorText msg={error} />
          <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@university.ac"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Min 6 characters"
          />
          <Btn title={loading ? 'Creating account…' : 'Create Account'} onPress={handleRegister} disabled={loading} />
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: COLORS.primary, fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  sub: { color: COLORS.textMuted, textAlign: 'center', marginBottom: 32, fontSize: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: COLORS.primary, fontSize: 14 },
});