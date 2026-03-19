import React from 'react';
import { useNavigate } from 'react-router-dom';
import TeamLogo from './TeamLogo.jsx';
import { Plus, Check, X } from 'lucide-react';
import { useAccumulator } from '../lib/AccumulatorContext.jsx';

function ConfidenceBar({ pct }) {
  const color = pct >= 65 ? '#22c55e' : pct >= 50 ? '#f0b429' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function Badge({ children, color = '#1a1a1a', text = '#888', border }) {
  return (
    <span style={{
      background: color, color: text,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
      display: 'inline-block', border: border || 'none'
    }}>{children}</span>
  );
}

export default function MatchCard({ match, prediction, loading, onPredict, compact }) {
  const navigate = useNavigate();
  const { isInAccumulator, addLeg, removeLegByKey } = useAccumulator();
  const inAccum = isInAccumulator(match);

  function handleAccumClick(e) {
    e.stopPropagation();
    if (inAccum) {
      removeLegByKey(match);
    } else {
      addLeg(match);
      navigate('/accumulator');
    }
  }

  const hasOdds = match.home_odds && match.draw_odds && match.away_odds;

  return (
    <div className="fade-in" style={{
      background: '#111', border: '1px solid #1a1a1a', borderRadius: 12,
      padding: compact ? '12px 14px' : '16px 18px',
      transition: 'border-color 0.2s'
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a1a'}
    >
      {/* Match header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: prediction || loading ? 12 : 0 }}>
        <TeamLogo name={match.home} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{match.home}</span>
            <span style={{ color: '#444', fontSize: 11 }}>vs</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{match.away}</span>
          </div>
          <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
            {match.league}
            {match.time && ` · ${match.time}`}
            {hasOdds && (
              <span style={{ marginLeft: 8, color: '#3a3a3a' }}>
                {match.home_odds} / {match.draw_odds} / {match.away_odds}
              </span>
            )}
          </div>
        </div>
        <TeamLogo name={match.away} size={28} />
        <button
          onClick={handleAccumClick}
          style={{
            background: inAccum ? 'rgba(34,197,94,0.15)' : '#1a1a1a',
            border: `1px solid ${inAccum ? '#22c55e' : '#2a2a2a'}`,
            color: inAccum ? '#22c55e' : '#666',
            borderRadius: 8, padding: '5px 8px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 500, flexShrink: 0, transition: 'all 0.15s'
          }}
        >
          {inAccum ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add</>}
        </button>
      </div>

      {/* Prediction */}
      {loading ? (
        <div>
          <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 6, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '75%' }} />
        </div>
      ) : prediction ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <Badge color="rgba(240,180,41,0.12)" text="#f0b429">{prediction.market}</Badge>
            <Badge>{prediction.odds}</Badge>
            {prediction.edge >= 10 && (
              <Badge color="rgba(34,197,94,0.12)" text="#22c55e">Edge {prediction.edge}%</Badge>
            )}
            {prediction.stake > 0 && (
              <Badge color="#1a1a1a" text="#666">Stake {prediction.stake}%</Badge>
            )}
            {prediction.h2hMatches > 0 && (
              <Badge color="#1a1a1a" text="#555">{prediction.h2hMatches} H2H</Badge>
            )}
          </div>
          <ConfidenceBar pct={prediction.confidence} />
          {!compact && prediction.bullets?.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
              {prediction.bullets.map((b, i) => (
                <div key={i} style={{ color: '#888', fontSize: 12, lineHeight: 1.6, marginBottom: 2 }}>{b}</div>
              ))}
            </div>
          )}
          {!compact && prediction.homeForm && (
            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: '#555' }}>
              <span>{match.home}: <span style={{ color: '#888' }}>{prediction.homeForm}</span></span>
              <span>{match.away}: <span style={{ color: '#888' }}>{prediction.awayForm}</span></span>
            </div>
          )}
        </div>
      ) : onPredict ? (
        <button
          onClick={onPredict}
          style={{
            background: 'transparent', border: '1px dashed #2a2a2a', color: '#555',
            borderRadius: 8, padding: '8px 16px', width: '100%', fontSize: 12,
            transition: 'all 0.15s', cursor: 'pointer'
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#f0b429'; e.target.style.color = '#f0b429'; }}
          onMouseLeave={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.color = '#555'; }}
        >
          Get Prediction
        </button>
      ) : null}
    </div>
  );
}
