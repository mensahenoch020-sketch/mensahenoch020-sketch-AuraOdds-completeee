import React, { useState } from 'react';
import TeamLogo from './TeamLogo.jsx';
import { Plus, Check, Share2 } from 'lucide-react';
import { useAccumulator } from '../lib/AccumulatorContext.jsx';

function ConfidenceBar({ pct }) {
  const color = pct >= 65 ? '#22c55e' : pct >= 50 ? '#F5A623' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function Badge({ children, color = '#222', text = '#aaa', border }) {
  return (
    <span style={{
      background: color, color: text,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
      display: 'inline-block', border: border || 'none'
    }}>{children}</span>
  );
}

export default function MatchCard({ match, prediction, loading, onPredict, compact }) {
  const { isInAccumulator, addLeg, removeLegByKey } = useAccumulator();
  const inAccum = isInAccumulator(match);
  const [toast, setToast] = useState(null);

  function handleAccumClick(e) {
    e.stopPropagation();
    if (inAccum) removeLegByKey(match);
    else addLeg(match);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function handleShare(e) {
    e.stopPropagation();
    if (!prediction) return;
    const shareText =
`🔥 AURA SHARP PREDICTION 🔥
⚽ ${prediction.home} vs ${prediction.away}
🏆 ${prediction.league || match.league || ''}
━━━━━━━━━━━━━━━━━━━━
✅ PICK: ${prediction.market}
💰 ODDS: ${prediction.odds}
📊 CONFIDENCE: ${prediction.confidence}%
— Edge identified: ${prediction.edge}%
━━━━━━━━━━━━━━━━━━━━
📈 SHARP ANGLE:
${(prediction.bullets || []).map(b => '• ' + b.replace(/^•\s*/, '')).join('\n')}
━━━━━━━━━━━━━━━━━━━━
💎 ${prediction.edge}% Expected Value Edge
Recommended stake: ${prediction.stake}% of your bankroll
---
Powered by AuraOdds`;

    navigator.clipboard.writeText(shareText)
      .then(() => showToast('Copied ✓'))
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = shareText;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('Copied ✓');
      });
  }

  const hasOdds = match.home_odds && match.draw_odds && match.away_odds;

  return (
    <div className="fade-in" style={{
      background: '#1c1c1c', border: '1px solid #222', borderRadius: 12,
      padding: compact ? '12px 14px' : '16px 18px', transition: 'border-color 0.2s',
      position: 'relative'
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#F5A623'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
    >
      {toast && (
        <div style={{
          position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
          background: '#F5A623', color: '#000', padding: '4px 12px',
          borderRadius: 12, fontSize: 11, fontWeight: 600, zIndex: 10,
          whiteSpace: 'nowrap'
        }}>{toast}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: prediction || loading ? 12 : 0 }}>
        <TeamLogo name={match.home} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#FFD700' }}>{match.home}</span>
            <span style={{ color: '#555', fontSize: 11 }}>vs</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#FFD700' }}>{match.away}</span>
          </div>
          <div style={{ color: '#777', fontSize: 11, marginTop: 2 }}>
            {match.league}
            {match.time && ` · ${match.time}`}
            {hasOdds && (
              <span style={{ marginLeft: 8, color: '#555' }}>
                {match.home_odds} / {match.draw_odds} / {match.away_odds}
              </span>
            )}
          </div>
        </div>
        <TeamLogo name={match.away} size={28} />
        <button
          onClick={handleAccumClick}
          style={{
            background: inAccum ? 'rgba(245,166,35,0.15)' : '#222',
            border: `1px solid ${inAccum ? '#F5A623' : '#333'}`,
            color: inAccum ? '#F5A623' : '#777',
            borderRadius: 8, padding: '5px 8px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 500, flexShrink: 0, transition: 'all 0.15s'
          }}
        >
          {inAccum ? <><Check size={12} /> Added ✓</> : <><Plus size={12} /> Add</>}
        </button>
      </div>

      {loading ? (
        <div>
          <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 6, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '75%' }} />
        </div>
      ) : prediction ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <Badge color="rgba(245,166,35,0.15)" text="#F5A623">{prediction.market}</Badge>
            <Badge>{prediction.odds}</Badge>
            {prediction.edge >= 10 && (
              <Badge color="rgba(34,197,94,0.12)" text="#22c55e">Edge {prediction.edge}%</Badge>
            )}
            {prediction.stake > 0 && (
              <Badge color="#222" text="#777">Stake {prediction.stake}%</Badge>
            )}
            {prediction.h2hMatches > 0 && (
              <Badge color="#222" text="#666">{prediction.h2hMatches} H2H</Badge>
            )}
            <button
              onClick={handleShare}
              title="Copy prediction"
              style={{
                background: '#222', border: '1px solid #333', color: '#777',
                borderRadius: 6, padding: '3px 7px', display: 'flex', alignItems: 'center',
                gap: 4, fontSize: 10, fontWeight: 500, cursor: 'pointer', marginLeft: 'auto',
                flexShrink: 0, transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5A623'; e.currentTarget.style.color = '#F5A623'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#777'; }}
            >
              <Share2 size={10} /> Share
            </button>
          </div>
          <ConfidenceBar pct={prediction.confidence} />
          {!compact && prediction.bullets?.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #222' }}>
              {prediction.bullets.map((b, i) => (
                <div key={i} style={{ color: '#aaa', fontSize: 12, lineHeight: 1.6, marginBottom: 2 }}>{b}</div>
              ))}
            </div>
          )}
          {!compact && prediction.homeForm && (
            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: '#777' }}>
              <span>{match.home}: <span style={{ color: '#aaa' }}>{prediction.homeForm}</span></span>
              <span>{match.away}: <span style={{ color: '#aaa' }}>{prediction.awayForm}</span></span>
            </div>
          )}
        </div>
      ) : onPredict ? (
        <button
          onClick={onPredict}
          style={{
            background: 'transparent', border: '1px dashed #333', color: '#777',
            borderRadius: 8, padding: '8px 16px', width: '100%', fontSize: 12,
            transition: 'all 0.15s', cursor: 'pointer'
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#F5A623'; e.target.style.color = '#F5A623'; }}
          onMouseLeave={e => { e.target.style.borderColor = '#333'; e.target.style.color = '#777'; }}
        >
          Get Prediction
        </button>
      ) : null}
    </div>
  );
}
