import React, { useEffect, useState } from 'react';
import TeamLogo from '../components/TeamLogo.jsx';
import { AlertTriangle, ShieldOff } from 'lucide-react';

const api = {
  getBetsToAvoid: () => fetch('/api/bets-to-avoid').then(r => r.json())
};

function DangerBar({ score }) {
  const color = score >= 70 ? '#ef4444' : score >= 50 ? '#f97316' : '#f0b429';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#666' }}>Danger Score</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}/100</span>
      </div>
      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function Avoid() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api.getBetsToAvoid();
        setFixtures(data.fixtures || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <AlertTriangle size={20} color="#ef4444" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Bets To Avoid</h1>
        </div>
        <p style={{ color: '#555', fontSize: 13 }}>
          Matches with high statistical risk — skip these for today and tomorrow
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 18 }}>
              <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 11, width: '80%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 11, width: '65%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      ) : fixtures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444' }}>
          <ShieldOff size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No high-risk matches found</div>
          <div style={{ fontSize: 13 }}>All today's fixtures look statistically sound</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fixtures.map((m, i) => (
            <div key={i} className="fade-in" style={{
              background: '#111', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <TeamLogo name={m.home} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.home} vs {m.away}</div>
                  <div style={{ color: '#555', fontSize: 11 }}>{m.league} · {m.date}</div>
                </div>
                <TeamLogo name={m.away} size={26} />
              </div>

              <DangerBar score={m.danger} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {m.reasons.map((reason, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#999' }}>
                    <span style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef4444',
                fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <AlertTriangle size={13} />
                No edge found — skip this bet
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
