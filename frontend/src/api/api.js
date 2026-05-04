import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://your-app-name.onrender.com'; // ← change this

async function getHeaders(isFormData = false) {
  const token = await AsyncStorage.getItem('token');
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function get(url) {
  const headers = await getHeaders();
  const res = await fetch(API_BASE + url, { headers });
  return res.json();
}

export async function post(url, data) {
  const headers = await getHeaders();
  const res = await fetch(API_BASE + url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function put(url, data) {
  const headers = await getHeaders();
  const res = await fetch(API_BASE + url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function patch(url, data) {
  const headers = await getHeaders();
  const res = await fetch(API_BASE + url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function del(url) {
  const headers = await getHeaders();
  await fetch(API_BASE + url, { method: 'DELETE', headers });
}

export async function postForm(url, formData) {
  const token = await AsyncStorage.getItem('token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + url, {
    method: 'POST',
    headers,
    body: formData,
  });
  return res.json();
}

export async function trackUsage(event_type, page, meta, userId) {
  if (!userId) return;
  try {
    await post('/analytics/event', {
      user_id: userId,
      event_type,
      page: page || null,
      meta: meta || null,
    });
  } catch (_) {}
}

export const GRADE_POINTS = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  D: 1.0, E: 0.5, F: 0,
};

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeCode(code) {
  return (code || '').trim().toUpperCase();
}

export function isGradeBelowC(gradeLetter) {
  if (!gradeLetter) return false;
  const gp = GRADE_POINTS[gradeLetter];
  return gp != null && gp < 2.0;
}