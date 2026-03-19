/**
 * API helper for Blueprint ↔ Pipeline Supabase communication.
 * All authenticated calls go through Ops API routes at ops.realstack.app.
 * Share link calls are public (no auth needed).
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';

// ─── Authenticated API calls (LO only) ─────────────────────────────────────

function getToken() {
  return localStorage.getItem('bp_token');
}

async function authFetch(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    // Token expired — clear and signal re-auth needed
    localStorage.removeItem('bp_token');
    throw new Error('Session expired — please sign in again');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Borrowers ──────────────────────────────────────────────────────────────

export async function fetchBorrowers(filter = {}) {
  const params = new URLSearchParams();
  if (filter.id) params.set('id', filter.id);
  if (filter.email) params.set('email', filter.email);
  if (filter.status) params.set('status', filter.status);
  const qs = params.toString();
  return authFetch(`/api/borrowers${qs ? '?' + qs : ''}`);
}

export async function createBorrower(data) {
  return authFetch('/api/borrowers', { method: 'POST', body: data });
}

export async function updateBorrower(data) {
  return authFetch('/api/borrowers', { method: 'PATCH', body: data });
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

export async function fetchScenarios(borrowerId) {
  return authFetch(`/api/scenarios?borrower_id=${borrowerId}`);
}

export async function fetchScenario(id) {
  return authFetch(`/api/scenarios?id=${id}`);
}

export async function createScenario(data) {
  return authFetch('/api/scenarios', { method: 'POST', body: data });
}

export async function updateScenario(data) {
  return authFetch('/api/scenarios', { method: 'PATCH', body: data });
}

export async function deleteScenarioAPI(id) {
  return authFetch('/api/scenarios', { method: 'DELETE', body: { id } });
}

// ─── Share (public, no auth) ────────────────────────────────────────────────

export async function fetchSharedData(shareToken) {
  const res = await fetch(`${API_BASE}/api/share?token=${shareToken}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || 'Share link not found');
  }
  return res.json();
}

export async function saveSharedScenario(shareToken, data) {
  const res = await fetch(`${API_BASE}/api/share?token=${shareToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || 'Could not save scenario');
  }
  return res.json();
}

// ─── Field Locks (LO only) ──────────────────────────────────────────────────

export async function lockField(scenarioId, fieldKey, action = 'locked') {
  return authFetch('/api/collab?resource=locks', {
    method: 'POST',
    body: { scenario_id: scenarioId, field_key: fieldKey, action },
  });
}

export async function fetchLockHistory(scenarioId) {
  return authFetch(`/api/collab?resource=locks&scenario_id=${scenarioId}`);
}

// ─── Version History ────────────────────────────────────────────────────────

export async function fetchScenarioChanges(scenarioId, limit = 100) {
  return authFetch(`/api/collab?resource=changes&scenario_id=${scenarioId}&limit=${limit}`);
}

export async function createScenarioChange(data) {
  return authFetch('/api/collab?resource=changes', { method: 'POST', body: data });
}

// ─── Share Sync (public, no auth — for borrower live editing) ───────────────

export async function syncSharedScenario(shareToken, scenarioId, stateData, calcSummary, fieldDiffs, userInfo = {}) {
  const res = await fetch(`${API_BASE}/api/collab?resource=sync`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: shareToken,
      scenario_id: scenarioId,
      state_data: stateData,
      calc_summary: calcSummary,
      field_diffs: fieldDiffs,
      changed_by: 'borrower',
      changed_by_name: userInfo.name || '',
      changed_by_email: userInfo.email || '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || 'Could not sync scenario');
  }
  return res.json();
}

// ─── Activity Digest (LO only) ─────────────────────────────────────────────

export async function fetchActivityDigest(days = 7) {
  return authFetch(`/api/collab?resource=digest&days=${days}&unsent=false`);
}

export async function computeActivityDigest(date = null) {
  const d = date || new Date().toISOString().split('T')[0];
  return authFetch('/api/collab?resource=digest&action=compute', {
    method: 'POST',
    body: { date: d },
  });
}

// ─── Borrower Auth (public, no LO auth needed) ─────────────────────────────

export async function requestBorrowerMagicLink(email, name = '', shareToken = null) {
  const res = await fetch(`${API_BASE}/api/collab?resource=borrower-auth&action=request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, share_token: shareToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not send magic link');
  }
  return res.json();
}

export async function verifyBorrowerMagicLink(token, email) {
  const res = await fetch(`${API_BASE}/api/collab?resource=borrower-auth&action=verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Invalid or expired magic link');
  }
  return res.json();
}

export async function fetchBorrowerPrefill(borrowerId) {
  return authFetch(`/api/collab?resource=borrower-prefill&borrower_id=${borrowerId}`);
}

export async function authenticateBorrowerGoogle(credential, shareToken = null) {
  const res = await fetch(`${API_BASE}/api/collab?resource=borrower-auth&action=google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, share_token: shareToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Google sign-in failed');
  }
  return res.json();
}

export async function fetchBorrowerProfile(sessionToken) {
  const res = await fetch(`${API_BASE}/api/collab?resource=borrower-auth&action=me`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
  if (!res.ok) throw new Error('Session expired');
  return res.json();
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

export function isAuthenticated() {
  return !!getToken();
}

export function setToken(token) {
  localStorage.setItem('bp_token', token);
}

export function clearToken() {
  localStorage.removeItem('bp_token');
}
