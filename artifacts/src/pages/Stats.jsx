import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Award, Activity, Trophy, ThumbsUp, ThumbsDown } from 'lucide-react';

function getResults(picks) {
  const r = {};
  for (const p of (picks || [])) {
    const key = `result_${p.id}`;
    const val = localStorage.getItem(key);
    if (val) r[`picks_${p.id}`] = val;
  }
  return r;
}
function saveResult(key, result) {
  const id = key.replace('picks_', '');
  localStorage.setItem(`result_${id}`, result);
}
function removeResult(key) {
  const id = key.replace('picks_', '');
  localStorage.removeItem(`result_${id}`);
}

function Gauge({ pct, label }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 55 ? '#22c55e' : pct >= 40 ? '#F5A623' : '#ef4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={64} cy={64} r={r} fill="none" stroke="#222" strokeWidth={10} />
        <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s' }} />
        <text x={64} y={64} textAnchor="middle" dominantBaseline="middle" fill="#FFD700" fontSize={20} fontWeight={700}>
          {Math.round(pct)}%
        </text>
      </svg>
      <div style={{ fontSize: 12, color: '#777', marginTop: -8 }}>{label}</div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {Icon && <Icon size={13} color={color || '#777'} />}
        <span style={{ color: '#777', fontSize: 11 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#FFD700' }}>{value}</div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12, color: '#FFD700' },
  labelStyle: { color: '#aaa' }
};

function ResultButtons({ pickKey, results, onToggle }) {
  const result = results[pickKey];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={() => onToggle(pickKey, 'won')} style={{
        background: result === 'won' ? 'rgba(34,197,94,0.15)' : '#222',
        border: `1px solid ${result === 'won' ? '#22c55e' : '#333'}`,
        color: result === 'won' ? '#22c55e' : '#666',
        borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3
      }}>
        <ThumbsUp size={10} /> Won ✓
      </button>
      <button onClick={() => onToggle(pickKey, 'lost')} style={{
        background: result === 'lost' ? 'rgba(239,68,68,0.15)' : '#222',
        border: `1px solid ${result === 'lost' ? '#ef4444' : '#333'}`,
        color: result === 'lost' ? '#ef4444' : '#666',
        borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3
      }}>
        <ThumbsDown size={10} /> Lost ✗
      </button>
    </div>
  );
}

export default function Stats() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({});

  async function loadPicks() {
    try {
      setLoading(true);
      const res = await fetch('/aura-api/picks/all');
      const data = await res.json();
      const parsed = (data.picks || []).map(p => {
        let analysisObj = {};
        try { analysisObj = JSON.parse(p.analysis || '{}'); } catch {}
        return {
          ...p,
          edge: analysisObj.edge ?? p.edge ?? 0,
          market: analysisObj.market ?? p.market ?? 'Unknown',
          odds: analysisObj.odds ?? p.odds,
          confidence: analysisObj.confidence ?? p.confidence,
          home: analysisObj.home ?? p.home ?? (p.user_input || '').split(' vs ')[0]?.trim(),
          away: analysisObj.away ?? p.away ?? (p.user_input || '').split(' vs ')[1]?.trim(),
        };
      }).filter(p => p.home && p.away);
      setPicks(parsed);
      setResults(getResults(parsed));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPicks();
  }, []);

  function handleToggle(key, val) {
    setResults(prev => {
      const updated = { ...prev };
      if (updated[key] === val) {
        delete updated[key];
        removeResult(key);
      } else {
        updated[key] = val;
        saveResult(key, val);
      }
      return updated;
    });
  }

  function getPickKey(p) {
    return `picks_${p.id}`;
  }

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#FFD700' }}>Statistics</h1>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 82, flex: 1, minWidth: 110, borderRadius: 12 }} />)}
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#FFD700' }}>Statistics</h1>
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 16, color: '#ef4444' }}>{error}</div>
      </div>
    );
  }

  const total = picks.length;
  const marked = picks.filter(p => results[getPickKey(p)]);
  const wins = marked.filter(p => results[getPickKey(p)] === 'won');
  const losses = marked.filter(p => results[getPickKey(p)] === 'lost');
  const winRate = marked.length > 0 ? ((wins.length / marked.length) * 100) : 0;
  const avgEdge = total > 0
    ? (picks.reduce((sum, p) => sum + parseFloat(p.edge || 0), 0) / total).toFixed(1)
    : '0.0';

  const sorted = [...picks].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  let bestStreak = 0, streak = 0;
  for (const p of sorted) {
    const r = results[getPickKey(p)];
    if (r === 'won') { streak++; bestStreak = Math.max(bestStreak, streak); }
    else if (r === 'lost') { streak = 0; }
  }

  const wonEdge = wins.length ? (wins.reduce((s, p) => s + (parseFloat(p.edge) || 0), 0) / wins.length).toFixed(1) : '—';
  const lostEdge = losses.length ? (losses.reduce((s, p) => s + (parseFloat(p.edge) || 0), 0) / losses.length).toFixed(1) : '—';

  const byDay = {};
  for (const p of sorted) {
    const day = (p.created_at || '').split('T')[0];
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { date: day, total: 0, wins: 0 };
    byDay[day].total++;
    const r = results[getPickKey(p)];
    if (r === 'won') byDay[day].wins++;
  }
  let cumTotal = 0, cumWins = 0;
  const cumulativeData = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).map(d => {
    cumTotal += d.total;
    cumWins += d.wins;
    return { date: d.date.slice(5), total: cumTotal, wins: cumWins };
  });

  const marketMap = {};
  for (const p of marked) {
    const m = p.market || 'Unknown';
    if (!marketMap[m]) marketMap[m] = { market: m, wins: 0, total: 0 };
    marketMap[m].total++;
    if (results[getPickKey(p)] === 'won') marketMap[m].wins++;
  }
  const marketData = Object.values(marketMap)
    .map(m => ({ ...m, winRate: parseFloat(((m.wins / m.total) * 100).toFixed(1)) }))
    .sort((a, b) => b.winRate - a.winRate).slice(0, 8);

  if (total === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#FFD700' }}>Statistics</h1>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555', background: '#1c1c1c', border: '1px solid #222', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6, color: '#FFD700' }}>No data yet</div>
          <div style={{ fontSize: 13 }}>Run Today's Picks to generate predictions</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#FFD700' }}>Statistics</h1>
        <p style={{ color: '#777', fontSize: 13 }}>
          {total} predictions · {marked.length} marked · Mark picks Won/Lost below to track your record
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Gauge pct={winRate} label="Win Rate" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="Total Predictions" value={total} icon={Activity} />
            <StatCard label="Wins" value={wins.length} icon={TrendingUp} color="#22c55e" />
            <StatCard label="Losses" value={losses.length} icon={TrendingDown} color="#ef4444" />
            <StatCard label="Best Streak" value={`${bestStreak} wins`} icon={Award} color="#F5A623" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} icon={Trophy} color="#22c55e" />
            <StatCard label="Avg Edge" value={`${avgEdge}%`} color="#F5A623" />
            <StatCard label="Edge (Won)" value={`${wonEdge}%`} color="#22c55e" />
            <StatCard label="Edge (Lost)" value={`${lostEdge}%`} color="#ef4444" />
          </div>
        </div>
      </div>

      {cumulativeData.length > 1 && (
        <div style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#FFD700' }}>Cumulative Picks Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={cumulativeData}>
              <XAxis dataKey="date" tick={{ fill: '#777', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#777', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="total" stroke="#F5A623" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="wins" stroke="#22c55e" strokeWidth={2} dot={false} name="Wins" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {marketData.length > 0 && (
        <div style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, color: '#FFD700' }}>Win Rate by Market Type</div>
          <ResponsiveContainer width="100%" height={Math.max(160, marketData.length * 32)}>
            <BarChart data={marketData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#777', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="market" type="category" tick={{ fill: '#aaa', fontSize: 9 }} tickLine={false} axisLine={false} width={120} />
              <Tooltip {...TOOLTIP_STYLE} formatter={v => `${v}%`} />
              <Bar dataKey="winRate" radius={4}>
                {marketData.map((_, i) => <Cell key={i} fill={i === 0 ? '#22c55e' : '#333'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, color: '#FFD700' }}>Recent Predictions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {picks.slice(0, 50).map((p, i) => {
            const key = getPickKey(p);
            const result = results[key];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 8,
                background: result === 'won' ? 'rgba(34,197,94,0.05)' : result === 'lost' ? 'rgba(239,68,68,0.05)' : 'transparent',
                border: `1px solid ${result === 'won' ? 'rgba(34,197,94,0.15)' : result === 'lost' ? 'rgba(239,68,68,0.15)' : 'transparent'}`
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#FFD700' }}>
                    {p.home} vs {p.away}
                  </div>
                  <div style={{ fontSize: 10, color: '#666' }}>
                    {p.market || '—'} · {p.odds ? `@ ${p.odds}` : ''} · {p.confidence ? `${p.confidence}% conf` : ''}
                    {p.edge != null && ` · Edge ${p.edge}%`}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>{(p.created_at || '').split('T')[0]}</div>
                <ResultButtons pickKey={key} results={results} onToggle={handleToggle} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
