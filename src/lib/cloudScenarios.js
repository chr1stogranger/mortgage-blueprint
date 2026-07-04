/**
 * cloudScenarios — direct, RLS-protected CRUD for SELF-OWNED scenarios.
 *
 * Used when a borrower signs in on the public calculator (no share link).
 * All calls go through supabase-js with the user's own JWT; Row Level
 * Security guarantees they can only ever touch rows where
 * scenarios.owner_account_id belongs to them (see loan-pipeline
 * migrations/010_borrower_auth_rls.sql).
 *
 * LO-shared scenarios still flow through the Ops API — this module is
 * exclusively for the self-serve path.
 */

import { getSupabaseClient } from './supabaseClient';

// Device-local prefs must never sync — strip before any cloud write.
const DEVICE_ONLY_KEYS = ['darkMode', 'themeMode'];

export function stripDevicePrefs(stateData) {
  if (!stateData || typeof stateData !== 'object') return stateData;
  const clean = { ...stateData };
  for (const key of DEVICE_ONLY_KEYS) delete clean[key];
  return clean;
}

/**
 * Build the lightweight calc_summary stored alongside state_data.
 * Mirrors the formula in useBlueprintSync.flush().
 */
export function buildCalcSummary(state) {
  const sp = Number(state.salesPrice) || 0;
  const dp = sp * (Number(state.downPct) || 0) / 100;
  const la = sp - dp;
  const r = Number(state.rate) || 0;
  const t = Number(state.term) || 30;
  const mr = r / 100 / 12;
  const np = t * 12;
  let pi = 0;
  if (mr > 0 && np > 0 && la > 0) {
    pi = la * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
  }
  return {
    salesPrice: sp,
    loanAmount: la,
    downPayment: dp,
    downPct: Number(state.downPct) || 0,
    ltv: sp > 0 ? Math.round((la / sp) * 1000) / 10 : 0,
    rate: r,
    term: t,
    creditScore: Number(state.creditScore) || 0,
    monthlyPI: Math.round(pi),
    loanType: state.loanType || 'Conventional',
  };
}

/** List the signed-in user's own scenarios (newest first). */
export async function listOwnedScenarios(accountId) {
  const supabase = getSupabaseClient();
  if (!supabase || !accountId) return [];
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, type, status, calc_summary, updated_at, created_at')
    .eq('owner_account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** Resolve the cloud id of an owned scenario by name (newest wins), or null. */
export async function findOwnedScenarioIdByName(accountId, name) {
  const supabase = getSupabaseClient();
  if (!supabase || !accountId) return null;
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, updated_at')
    .eq('owner_account_id', accountId)
    .eq('name', name)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data[0] ? data[0].id : null;
}

/** Fetch one owned scenario with full state_data. */
export async function fetchOwnedScenario(id) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Create a new self-owned scenario. Returns the created row. */
export async function createOwnedScenario(accountId, { name, type = 'purchase', stateData }) {
  const supabase = getSupabaseClient();
  if (!supabase || !accountId) throw new Error('Not signed in');
  const clean = stripDevicePrefs(stateData || {});
  const { data, error } = await supabase
    .from('scenarios')
    .insert({
      owner_account_id: accountId,
      borrower_id: null,
      name: (name || 'My Blueprint').slice(0, 120),
      type,
      status: 'active',
      created_by: 'borrower',
      state_data: clean,
      calc_summary: buildCalcSummary(clean),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Atomically create-or-update a self-owned scenario by NAME.
 * Backed by the DB unique constraint on (owner_account_id, name)
 * (loan-pipeline migration 013), so two devices pushing the same name at the
 * same time can never fork duplicate rows — the old find-then-create race
 * behind the "Scenario 1 zombie". Returns the row (with its id).
 */
export async function upsertOwnedScenario(accountId, { name, type = 'purchase', stateData }) {
  const supabase = getSupabaseClient();
  if (!supabase || !accountId) throw new Error('Not signed in');
  const clean = stripDevicePrefs(stateData || {});
  const { data, error } = await supabase
    .from('scenarios')
    .upsert({
      owner_account_id: accountId,
      borrower_id: null,
      name: (name || 'My Blueprint').slice(0, 120),
      type,
      status: 'active',
      created_by: 'borrower',
      state_data: clean,
      calc_summary: buildCalcSummary(clean),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_account_id,name' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Update an owned scenario's state (debounced writes call this). */
export async function updateOwnedScenario(id, { stateData, name }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Not signed in');
  const patch = { updated_at: new Date().toISOString() };
  if (stateData) {
    const clean = stripDevicePrefs(stateData);
    patch.state_data = clean;
    patch.calc_summary = buildCalcSummary(clean);
  }
  if (name) patch.name = name.slice(0, 120);
  const { data, error } = await supabase
    .from('scenarios')
    .update(patch)
    .eq('id', id)
    .select('id, name, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Delete an owned scenario. */
export async function deleteOwnedScenario(id) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Not signed in');
  const { error } = await supabase.from('scenarios').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Export everything the user owns as a downloadable JSON blob.
 * (CCPA/CPRA data-access right; also just a nice feature.)
 */
export async function exportMyData(account) {
  const supabase = getSupabaseClient();
  if (!supabase || !account) throw new Error('Not signed in');
  const { data: scenarios, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('owner_account_id', account.id);
  if (error) throw new Error(error.message);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      email: account.email,
      name: account.name,
      created_via: 'RealStack Blueprint',
    },
    scenarios: scenarios || [],
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `realstack-blueprint-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return payload.scenarios.length;
}
