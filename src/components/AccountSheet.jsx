import { FONT, MONO } from "../lib/fonts.js";
/**
 * AccountSheet — the borrower account surface on the public calculator.
 *
 * Signed OUT → sign-in card: Google OAuth + magic link + Terms/Privacy consent.
 * Signed IN  → profile: cloud-sync toggle, export data, sign out, delete account.
 *
 * Rendered as a full-screen overlay sheet (mobile-first, works on desktop).
 * Brand Kit: pill buttons, Inter labels, Geist Mono for the email,
 * indigo #3B6BF5 accent, no emojis.
 */

import { useState } from 'react';
import { signInWithMagicLink, signInWithGoogle, verifyEmailCode } from '../lib/supabaseClient';
import { exportMyData } from '../lib/cloudScenarios';


const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function AccountSheet({ open, onClose, accountHook, onResetSync, T, darkMode }) {
  const {
    session, account, isSignedIn, syncEnabled,
    setSyncEnabled, signOut, deleteAccount,
  } = accountHook;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [consented, setConsented] = useState(false);
  const [phase, setPhase] = useState('main'); // main | magic-sent | delete-confirm
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [exportCount, setExportCount] = useState(null);
  const [resetMsg, setResetMsg] = useState('');

  if (!open) return null;

  const card = {
    background: T?.card || (darkMode ? '#121c30' : '#FFFFFF'),
    border: `1px solid ${T?.separator || 'rgba(255,255,255,0.06)'}`,
    borderRadius: 16, padding: 24,
  };
  const textColor = T?.text || (darkMode ? '#EDEDED' : '#171717');
  const secondary = T?.textSecondary || (darkMode ? '#A1A1A1' : '#525252');
  const tertiary = T?.textTertiary || (darkMode ? '#666666' : '#737373');
  const inputBg = darkMode ? '#162034' : '#F0F0F0';
  const accent = '#3B6BF5';
  const red = '#e5484d';

  const pill = (bg, color, extra = {}) => ({
    padding: '12px 20px', borderRadius: 9999, border: 'none',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
    background: bg, color, width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...extra,
  });

  async function handleGoogle() {
    if (!consented) { setError('Please agree to the Terms & Privacy Policy first'); return; }
    try {
      setError('');
      try { localStorage.setItem('bp_pending_consent', '1'); } catch { /* noop */ }
      await signInWithGoogle();
    } catch (e) {
      setError(e.message || 'Google sign-in failed');
    }
  }

  async function handleMagic(e) {
    e.preventDefault();
    if (!consented) { setError('Please agree to the Terms & Privacy Policy first'); return; }
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      try { localStorage.setItem('bp_pending_consent', '1'); } catch { /* noop */ }
      await signInWithMagicLink(email.trim());
      setPhase('magic-sent');
    } catch (e2) {
      setError(e2.message || 'Could not send sign-in link');
    }
    setBusy(false);
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      await verifyEmailCode(email, code);
      // Auth state change flips the sheet to the signed-in view via accountHook.
      setPhase('main');
      setCode('');
    } catch (e2) {
      setError(e2.message || 'That code didn’t work — check for a newer email');
    }
    setBusy(false);
  }

  async function handleExport() {
    setBusy(true);
    setError('');
    try {
      const n = await exportMyData(account);
      setExportCount(n);
    } catch (e) {
      setError(e.message || 'Export failed');
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (deleteText !== 'DELETE') return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      onClose();
    } catch (e) {
      setError(e.message || 'Deletion failed');
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...card, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: textColor, letterSpacing: '-0.03em' }}>
            {isSignedIn ? 'My Account' : 'Save your Blueprint'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: tertiary, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* ── SIGNED OUT ── */}
        {!isSignedIn && phase === 'main' && (
          <>
            <div style={{ fontSize: 14, color: secondary, lineHeight: 1.6, marginBottom: 20 }}>
              Create a free account to keep your blueprints backed up and in sync on every device. No account needed to keep using the calculator — everything stays on this device.
            </div>

            <button onClick={handleGoogle} style={pill('#fff', '#3c4043', { border: '1px solid #dadce0' })}>
              <GoogleIcon /> Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: tertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <div style={{ flex: 1, height: 1, background: T?.separator || 'rgba(255,255,255,0.08)' }} />
              or
              <div style={{ flex: 1, height: 1, background: T?.separator || 'rgba(255,255,255,0.08)' }} />
            </div>

            <form onSubmit={handleMagic}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                style={{
                  width: '100%', padding: '12px 16px', boxSizing: 'border-box',
                  background: inputBg, color: textColor,
                  border: `1px solid ${T?.separator || 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 12, fontSize: 15, fontFamily: FONT, outline: 'none',
                  marginBottom: 10,
                }}
              />
              <button
                type="submit"
                disabled={!email.trim() || busy}
                style={pill(
                  email.trim() && !busy ? 'linear-gradient(135deg, #3B6BF5, #2B4FCE)' : 'rgba(59,107,245,0.2)',
                  '#fff'
                )}
              >
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>

            {/* Consent */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => { setConsented(e.target.checked); setError(''); }}
                style={{ marginTop: 2, accentColor: accent }}
              />
              <span style={{ fontSize: 12, color: secondary, lineHeight: 1.5 }}>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: accent }}>Terms</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: accent }}>Privacy Policy</a>
                , including storing my blueprint data securely in the cloud.
              </span>
            </label>
          </>
        )}

        {/* ── MAGIC LINK SENT ── */}
        {!isSignedIn && phase === 'magic-sent' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: textColor, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 14, color: secondary, lineHeight: 1.6 }}>
              We sent a sign-in code to
            </div>
            <div style={{ fontFamily: FONT, fontSize: 14, color: accent, margin: '8px 0 16px' }}>{email}</div>
            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                placeholder="6-digit code"
                style={{
                  width: '100%', padding: '12px 16px', boxSizing: 'border-box',
                  background: inputBg, color: textColor,
                  border: `1px solid ${T?.separator || 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 12, fontSize: 18, fontFamily: FONT, outline: 'none',
                  marginBottom: 10, textAlign: 'center', letterSpacing: '0.35em',
                }}
              />
              <button
                type="submit"
                disabled={code.trim().length < 6 || busy}
                style={pill(
                  code.trim().length >= 6 && !busy ? 'linear-gradient(135deg, #3B6BF5, #2B4FCE)' : 'rgba(59,107,245,0.2)',
                  '#fff'
                )}
              >
                {busy ? 'Verifying…' : 'Verify code'}
              </button>
            </form>
            <div style={{ fontSize: 12, color: tertiary, lineHeight: 1.6, marginTop: 14 }}>
              Enter the 6-digit code from the email, or tap the link in it — either signs you in.
            </div>
            <button onClick={() => { setPhase('main'); setCode(''); }} style={{ ...pill('transparent', secondary, { border: `1px solid ${T?.separator || 'rgba(255,255,255,0.1)'}` }), marginTop: 16 }}>
              Back
            </button>
          </div>
        )}

        {/* ── SIGNED IN ── */}
        {isSignedIn && phase === 'main' && (
          <>
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #3B6BF5, #2B4FCE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 17,
              }}>
                {(account?.name || account?.email || session?.user?.email || '?').trim()[0]?.toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {account?.name || 'Homebuyer'}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: tertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {account?.email || session?.user?.email}
                </div>
              </div>
            </div>

            {/* Sync toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12, marginBottom: 12,
              background: darkMode ? '#1a2740' : '#F5F5F5',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Cloud sync</div>
                <div style={{ fontSize: 12, color: tertiary, marginTop: 2 }}>
                  {syncEnabled ? 'Your blueprints sync across devices' : 'Blueprints stay on this device only'}
                </div>
              </div>
              <button
                onClick={() => setSyncEnabled(!syncEnabled)}
                aria-label="Toggle cloud sync"
                style={{
                  width: 46, height: 26, borderRadius: 9999, border: 'none', cursor: 'pointer',
                  background: syncEnabled ? accent : (darkMode ? '#333' : '#D4D4D4'),
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: syncEnabled ? 23 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Export */}
            <button onClick={handleExport} disabled={busy} style={{ ...pill('transparent', secondary, { border: `1px solid ${T?.separator || 'rgba(255,255,255,0.1)'}` }), marginBottom: 10 }}>
              {exportCount != null ? `Exported ${exportCount} blueprint${exportCount === 1 ? '' : 's'}` : 'Export my data (JSON)'}
            </button>

            {/* Reset sync (troubleshooting) — clears cloud copies so you can
                re-sync a clean set from one device. Local blueprints are kept. */}
            {onResetSync && (
              <button
                onClick={async () => {
                  if (busy) return;
                  setBusy(true); setError(''); setResetMsg('');
                  try {
                    const n = await onResetSync();
                    setResetMsg(`Cleared ${n} cloud copy${n === 1 ? '' : 's'}. Turn Cloud sync on to re-upload a clean set.`);
                  } catch (e) { setError(e.message || 'Reset failed'); }
                  setBusy(false);
                }}
                disabled={busy}
                style={{ ...pill('transparent', tertiary, { border: `1px solid ${T?.separator || 'rgba(255,255,255,0.1)'}`, fontSize: 13 }), marginBottom: 10 }}
              >
                {busy ? 'Working…' : 'Reset cloud sync'}
              </button>
            )}
            {resetMsg && (
              <div style={{ fontSize: 12, color: secondary, lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center' }}>{resetMsg}</div>
            )}

            {/* Sign out */}
            <button onClick={async () => { await signOut(); onClose(); }} style={{ ...pill('transparent', secondary, { border: `1px solid ${T?.separator || 'rgba(255,255,255,0.1)'}` }), marginBottom: 10 }}>
              Sign out
            </button>

            {/* Delete */}
            <button onClick={() => setPhase('delete-confirm')} style={pill('transparent', red, { border: '1px solid rgba(229,72,77,0.25)' })}>
              Delete my account
            </button>

            <div style={{ fontSize: 11, color: tertiary, lineHeight: 1.6, marginTop: 16 }}>
              Deleting your account permanently removes your cloud blueprints and sign-in. If you're working with a loan officer, records they maintain for your loan file are kept separately as required by law.
            </div>
          </>
        )}

        {/* ── DELETE CONFIRM ── */}
        {isSignedIn && phase === 'delete-confirm' && (
          <>
            <div style={{ fontSize: 14, color: secondary, lineHeight: 1.6, marginBottom: 16 }}>
              This permanently deletes your account and every blueprint stored in the cloud. Local copies on this device are kept. This cannot be undone.
            </div>
            <div style={{ fontSize: 12, color: tertiary, marginBottom: 8 }}>Type <span style={{ fontFamily: FONT, color: red, fontWeight: 700 }}>DELETE</span> to confirm:</div>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="DELETE"
              style={{
                width: '100%', padding: '12px 16px', boxSizing: 'border-box',
                background: inputBg, color: textColor, fontFamily: FONT,
                border: `1px solid rgba(229,72,77,0.3)`,
                borderRadius: 12, fontSize: 14, outline: 'none', marginBottom: 12,
              }}
            />
            <button
              onClick={handleDelete}
              disabled={deleteText !== 'DELETE' || busy}
              style={pill(deleteText === 'DELETE' && !busy ? red : 'rgba(229,72,77,0.2)', '#fff')}
            >
              {busy ? 'Deleting…' : 'Permanently delete my account'}
            </button>
            <button onClick={() => { setPhase('main'); setDeleteText(''); }} style={{ ...pill('transparent', secondary, { border: `1px solid ${T?.separator || 'rgba(255,255,255,0.1)'}` }), marginTop: 10 }}>
              Cancel
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)',
            color: red, fontSize: 13, textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
