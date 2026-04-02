import { ImageResponse } from '@vercel/og';

export const config = { maxDuration: 10 };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    // Decode challenge data from URL
    const token = searchParams.get('c');
    if (!token) {
      return new Response('Missing challenge token', { status: 400 });
    }

    let data;
    try {
      data = JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return new Response('Invalid token', { status: 400 });
    }

    const {
      hood = 'Unknown',
      beds = 0,
      baths = 0,
      sqft = 0,
      acc = 0,
      label = '',
      type = '',
      mode = 'daily',
      dn = 0,
    } = data;

    const accuracy = parseFloat(acc).toFixed(1);
    const modeLabel = mode === 'daily' ? `Daily #${dn}` : 'Free Play';

    // Color based on accuracy
    const accNum = parseFloat(accuracy);
    const accColor = accNum >= 95 ? '#10B981' : accNum >= 90 ? '#06B6D4' : accNum >= 80 ? '#F59E0B' : '#EF4444';

    // Bar visualization
    const pctOff = 100 - accNum;
    const bars = pctOff <= 2 ? '|||||' : pctOff <= 5 ? '||||.' : pctOff <= 10 ? '|||..' : pctOff <= 20 ? '||...' : '|....';

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200',
            height: '630',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #050505 0%, #0A0A0A 50%, #0F0F0F 100%)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle gradient glow */}
          <div
            style={{
              position: 'absolute',
              top: '-200',
              right: '-200',
              width: '600',
              height: '600',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-200',
              left: '-200',
              width: '600',
              height: '600',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
              display: 'flex',
            }}
          />

          {/* Top bar */}
          <div
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '4',
              background: 'linear-gradient(90deg, #6366F1, #3B82F6, #06B6D4, #10B981)',
              display: 'flex',
            }}
          />

          {/* Mode badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8',
              marginBottom: '12',
            }}
          >
            <div
              style={{
                fontSize: '18',
                fontWeight: '700',
                letterSpacing: '3',
                color: mode === 'daily' ? '#6366F1' : '#06B6D4',
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              PRICEPOINT {modeLabel}
            </div>
          </div>

          {/* Accuracy — the hero number */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '8',
            }}
          >
            <div
              style={{
                fontSize: '140',
                fontWeight: '900',
                letterSpacing: '-6',
                lineHeight: '1',
                color: accColor,
                display: 'flex',
              }}
            >
              {accuracy}%
            </div>
            <div
              style={{
                fontSize: '24',
                fontWeight: '600',
                letterSpacing: '4',
                color: accColor,
                marginTop: '8',
                display: 'flex',
              }}
            >
              {bars}
            </div>
          </div>

          {/* Property details */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16',
              marginTop: '24',
              padding: '16 32',
              borderRadius: '16',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div
              style={{
                fontSize: '22',
                fontWeight: '700',
                color: '#EDEDED',
                display: 'flex',
              }}
            >
              {hood}
            </div>
            <div
              style={{
                width: '1',
                height: '24',
                background: 'rgba(255,255,255,0.12)',
                display: 'flex',
              }}
            />
            <div
              style={{
                fontSize: '18',
                color: '#A1A1A1',
                display: 'flex',
              }}
            >
              {beds}BR/{baths}BA · {Number(sqft).toLocaleString()}sf
              {type ? ` · ${type}` : ''}
            </div>
          </div>

          {/* Challenge CTA */}
          <div
            style={{
              marginTop: '40',
              padding: '14 48',
              borderRadius: '9999',
              background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
              display: 'flex',
              alignItems: 'center',
              gap: '10',
            }}
          >
            <div
              style={{
                fontSize: '22',
                fontWeight: '700',
                color: '#FFFFFF',
                display: 'flex',
              }}
            >
              Can you beat me? Tap to play
            </div>
          </div>

          {/* Location label */}
          {label && (
            <div
              style={{
                position: 'absolute',
                bottom: '28',
                left: '48',
                fontSize: '16',
                color: '#666666',
                display: 'flex',
              }}
            >
              {label}
            </div>
          )}

          {/* Brand */}
          <div
            style={{
              position: 'absolute',
              bottom: '28',
              right: '48',
              display: 'flex',
              alignItems: 'center',
              gap: '6',
            }}
          >
            <div
              style={{
                fontSize: '18',
                fontWeight: '700',
                color: '#EDEDED',
                display: 'flex',
              }}
            >
              Real
            </div>
            <div
              style={{
                fontSize: '18',
                fontWeight: '700',
                color: '#6366F1',
                display: 'flex',
              }}
            >
              Stack
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error('OG image error:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
