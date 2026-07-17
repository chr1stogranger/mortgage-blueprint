import { FONT, MONO } from "../lib/fonts.js";
/**
 * CloudMergeSheet — first-sign-in merge wizard.
 *
 * Appears once, when a user signs in with local blueprints that have never
 * been uploaded. They choose exactly what goes to the cloud — nothing is
 * uploaded silently. Skipping keeps everything local (and never asks again;
 * re-run available from Account settings later).
 */

import { useState } from 'react';


export default function CloudMergeSheet({ candidates = [], onUpload, onSkip, T, darkMode }) {
  const [checked, setChecked] = useState(() => new Set(candidates));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const textColor = T?.text || (darkMode ? '#EDEDED' : '#171717');
  const secondary = T?.textSecondary || (darkMode ? '#A1A1A1' : '#525252');
  const tertiary = T?.textTertiary || (darkMode ? '#666666' : '#737373');
  const accent = '#6366F1';

  const toggle = (name) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  async function handleUpload() {
    setBusy(true);
    setError('');
    try {
      await onUpload([...checked]);
    } catch (e) {
      setError(e.message || 'Upload failed');
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: FONT,
    }}>
      <div style={{
        background: T?.card || (darkMode ? '#0F0F0F' : '#FFFFFF'),
        border: `1px solid ${T?.separator || 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: textColor, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Back up your blueprints?
        </div>
        <div style={{ fontSize: 13, color: secondary, lineHeight: 1.6, marginBottom: 18 }}>
          You have {candidates.length} blueprint{candidates.length === 1 ? '' : 's'} saved on this device. Choose which ones to upload to your account so they sync everywhere. Unchecked ones stay on this device only.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {candidates.map(name => (
            <label
              key={name}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '12px 14px', borderRadius: 12,
                background: darkMode ? '#141414' : '#F5F5F5',
                border: `1px solid ${checked.has(name) ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                transition: 'border-color 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(name)}
                onChange={() => toggle(name)}
                style={{ accentColor: accent }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: textColor, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: checked.has(name) ? accent : tertiary, textTransform: 'uppercase', letterSpacing: 1 }}>
                {checked.has(name) ? 'Upload' : 'Local'}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={handleUpload}
          disabled={busy || checked.size === 0}
          style={{
            width: '100%', padding: '13px 20px', borderRadius: 9999, border: 'none',
            background: checked.size > 0 && !busy ? 'linear-gradient(135deg, #6366F1, #3B82F6)' : 'rgba(99,102,241,0.2)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: checked.size > 0 && !busy ? 'pointer' : 'default',
            fontFamily: FONT, marginBottom: 10,
            boxShadow: checked.size > 0 && !busy ? '0 0 20px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          {busy ? 'Uploading…' : `Upload ${checked.size} blueprint${checked.size === 1 ? '' : 's'}`}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          style={{
            width: '100%', padding: '12px 20px', borderRadius: 9999,
            background: 'transparent', color: secondary,
            border: `1px solid ${T?.separator || 'rgba(255,255,255,0.1)'}`,
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
          }}
        >
          Keep everything local
        </button>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#EF4444', fontSize: 13, textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
