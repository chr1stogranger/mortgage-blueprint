/**
 * BorrowerAccountPrompt — Nudges borrowers to save their Blueprint to an account.
 *
 * Shown to borrowers on the share portal after they've been using it for a bit.
 * Flow: Enter email → Magic link sent → Click link → Logged in.
 *
 * Benefits displayed:
 *   - Access from any device
 *   - Get notified when LO makes changes
 *   - See all your scenarios in one place
 */

import React, { useState, useCallback } from 'react';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';

export default function BorrowerAccountPrompt({
  shareToken = null,
  borrowerName = '',
  onAccountCreated = null,
  style = {},
}) {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('prompt');   // prompt → email → sent → done
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleRequestMagicLink = useCallback(async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/collab?resource=borrower-auth&action=request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: borrowerName,
          share_token: shareToken,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not send magic link');
      }

      setPhase('sent');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [email, borrowerName, shareToken]);

  if (dismissed) return null;

  return (
    <div style={{
      background: '#0F0F0F',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      borderRadius: 14,
      padding: 20,
      ...style,
    }}>
      {/* Prompt phase */}
      {phase === 'prompt' && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 12,
          }}>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: '#EDEDED', fontFamily: FONT,
              letterSpacing: '-0.2px',
            }}>
              Save your Blueprint
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: 'none', border: 'none',
                color: '#666666', fontSize: 16,
                cursor: 'pointer', padding: '0 4px',
              }}
            >&times;</button>
          </div>

          <div style={{
            fontSize: 13, color: '#A1A1A1',
            lineHeight: 1.5, marginBottom: 16,
            fontFamily: FONT,
          }}>
            Create a free account to access your mortgage scenarios from any device,
            get notified when your loan officer makes updates, and keep everything in one place.
          </div>

          {/* Benefits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[
              { icon: '&#9889;', text: 'Access from phone, tablet, or computer' },
              { icon: '&#9993;', text: 'Get notified when changes are made' },
              { icon: '&#9734;', text: 'See all your scenarios in one dashboard' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 14, width: 28, height: 28,
                    background: 'rgba(99, 102, 241, 0.08)',
                    borderRadius: 7, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: b.icon }}
                />
                <span style={{ fontSize: 12, color: '#EDEDED', fontFamily: FONT }}>
                  {b.text}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setPhase('email')}
            style={{
              width: '100%', padding: '12px',
              background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
              border: 'none', borderRadius: 9999,
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
            }}
          >
            Save my Blueprint
          </button>

          <div
            onClick={() => setDismissed(true)}
            style={{
              textAlign: 'center', marginTop: 10,
              fontSize: 12, color: '#666666',
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Maybe later
          </div>
        </>
      )}

      {/* Email input phase */}
      {phase === 'email' && (
        <>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: '#EDEDED', marginBottom: 12,
            fontFamily: FONT,
          }}>
            Enter your email
          </div>
          <div style={{
            fontSize: 12, color: '#A1A1A1',
            marginBottom: 12, fontFamily: FONT,
          }}>
            We'll send you a sign-in link — no password needed.
          </div>

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRequestMagicLink()}
            placeholder="you@email.com"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px',
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: '#EDEDED',
              fontSize: 14, fontFamily: FONT,
              outline: 'none', marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{
              fontSize: 12, color: '#EF4444',
              marginBottom: 8, fontFamily: FONT,
            }}>{error}</div>
          )}

          <button
            onClick={handleRequestMagicLink}
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: '#6366F1', border: 'none',
              borderRadius: 9999, color: '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontFamily: FONT,
            }}
          >
            {loading ? 'Sending...' : 'Send sign-in link'}
          </button>

          <div
            onClick={() => setPhase('prompt')}
            style={{
              textAlign: 'center', marginTop: 10,
              fontSize: 12, color: '#666666',
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            &#8592; Back
          </div>
        </>
      )}

      {/* Success phase */}
      {phase === 'sent' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 22,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <div style={{
            fontSize: 15, fontWeight: 700,
            color: '#EDEDED', marginBottom: 6,
            fontFamily: FONT,
          }}>
            Check your email
          </div>
          <div style={{
            fontSize: 13, color: '#A1A1A1',
            lineHeight: 1.5, fontFamily: FONT,
          }}>
            We sent a sign-in link to <span style={{ color: '#EDEDED', fontWeight: 500 }}>{email}</span>.
            Click it to save your Blueprint to your account.
          </div>
          <div style={{
            fontSize: 11, color: '#666666',
            marginTop: 12, fontFamily: FONT,
          }}>
            Didn't get it? Check spam or{' '}
            <span
              onClick={() => { setPhase('email'); setError(''); }}
              style={{ color: '#6366F1', cursor: 'pointer' }}
            >try again</span>.
          </div>
        </div>
      )}
    </div>
  );
}
