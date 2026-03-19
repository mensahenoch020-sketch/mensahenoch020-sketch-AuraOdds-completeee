import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Award, Activity, Trophy, ThumbsUp, ThumbsDown } from 'lucide-react';

const RESULTS_KEY = 'pick_results';

function getResults() {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY) || '{}'); } catch { return {}; }
}
function saveResult(key, result) {
  const r = getResults();
  r[key] = result;
  localStorage.setItem(RESULTS_KEY, JSON.stringify(r));
}
function removeResult(key) {
  const r = getResults();
  delete r[key];
  localStorage.setItem(RESULTS_KEY, JSON.stringify(r));
}

function Gauge({ pct, label }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 55 ? '#22c55e' : pct >= 40 ? '#f0b429' : '#ef4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={64} cy={64} r={r} fill="none" stroke="#1a1a1a" strokeWidth={10} />
        <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s' }} />
        <text x={64} y={64} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={20} fontWeight={700}>
          {Math.round(pct)}%
        </text>
      </svg>
      <div style={{ fontSize: 12, color: '#666', marginTop: -8 }}>{label}</div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {Icon && <Icon size={13} color={color || '#666'} />}
        <span style={{ color: '#666', fontSize: 11 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#fff' }}>{value}</div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#888' }
};

function ResultButtons({ pickKey, results, onToggle }) {
  const result = results[pickKey];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={() => onToggle(pickKey, 'won')} style={{
        background: result === 'won' ? 'rgba(34,197,94,0.15)' : '#1a1a1a',
        border: `1px solid ${result === 'won' ? '#22c55e' : '#2a2a2a'}`,
        color: result === 'won' ? '#22c55e' : '#555',
        borderRadius: 6, padding: '3px 6px', fontSize: 10, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3
      }}>
        <ThumbsUp size={10} /> W
      </button>
      <button onClick={() => onToggle(pickKey, 'lost')} style={{
        background: result === 'lost' ? 'rgba(239,68,68,0.15)' : '#1a1a1a',
        border: `1px solid ${result === 'lost' ? '#ef4444' : '#2a2a2a'}`,
        color: result === 'lost' ? '#ef4444' : '#555',
        borderRadius: 6, padding: '3px 6px', fontSize: 10, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3
      }}>
        <ThumbsDown size={10} /> L
      </button>
    </div>
  );
}

export default function Stats() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(getResults());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/picks/all');
        const data = await res.json();
        const parsed = (data.picks || []).map(p => {
          const pd = p.parsed || {};
          return { ...p, ...pd };
        }).filter(p => p.home && p.away);
        setPicks(parsed);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
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
    return `${p.home}_${p.away}_${(p.created_at || '').split('T')[0]}`;
  }

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Statistics</h1>
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
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Statistics</h1>
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 16, color: '#ef4444' }}>{error}</div>
      </div>
    );
  }

  // Use manually marked results for win/loss stats
  const markedPicks = picks.filter(p => results[getPickKey(p)]);
  const won = markedPicks.filter(p => results[getPickKey(p)] === 'won');
  const lost = markedPicks.filter(p => results[getPickKey(p)] === 'lost');
  const winRate = markedPicks.length ? (won.length / markedPicks.length) * 100 : 0;

  // Best streak from marked picks (chronological)
  const sorted = [...picks].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  let bestStreak = 0, streak = 0;
  for (const p of sorted) {
    const r = results[getPickKey(p)];
    if (r === 'won') { streak++; bestStreak = Math.max(bestStreak, streak); }
    else if (r === 'lost') { streak = 0; }
  }

  // Avg edge for won vs lost
  const wonEdge = won.length ? (won.reduce((s, p) => s + (parseFloat(p.edge) || 0), 0) / won.length).toFixed(1) : '—';
  const lostEdge = lost.length ? (lost.reduce((s, p) => s + (parseFloat(p.edge) || 0), 0) / lost.length).toFixed(1) : '—';

  // P/L over time using marked results
  const byDay = {};
  for (const p of sorted) {
    const day = (p.created_at || '').split('T')[0];
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { date: day, profit: 0 };
    const r = results[getPickKey(p)];
    const s = parseFloat(p.stake) || 2;
    const o = parseFloat(p.odds) || 1.9;
    if (r === 'won') byDay[day].profit += s * o - s;
    else if (r === 'lost') byDay[day].profit -= s;
  }
  let cumulative = 0;
  const plData = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).map(d => {
    cumulative += d.profit;
    return { date: d.date.slice(5), pl: parseFloat(cumulative.toFixed(2)) };
  });

  // League performance (marked only)
  const leagueMap = {};
  for (const p of markedPicks) {
    const l = p.league || 'Unknown';
    if (!leagueMap[l]) leagueMap[l] = { league: l, wins: 0, total: 0 };
    leagueMap[l].total++;
    if (results[getPickKey(p)] === 'won') leagueMap[l].wins++;
  }
  const leagueData = Object.values(leagueMap)
    .map(l => ({ ...l, winRate: parseFloat(((l.wins / l.total) * 100).toFixed(1)) }))
    .sort((a, b) => b.winRate - a.winRate).slice(0, 8);

  // Market performance (marked only)
  const marketMap = {};
  for (const p of markedPicks) {
    const m = p.market || 'Unknown';
    if (!marketMap[m]) marketMap[m] = { market: m, wins: 0, total: 0 };
    marketMap[m].total++;
    if (results[getPickKey(p)] === 'won') marketMap[m].wins++;
  }
  const marketData = Object.values(marketMap)
    .map(m => ({ ...m, winRate: parseFloat(((m.wins / m.total) * 100).toFixed(1)) }))
    .sort((a, b) => b.winRate - a.winRate).slice(0, 8);

  // Activity calendar from all picks
  const calendarDays = {};
  for (const p of picks) {
    const day = (p.created_at || '').split('T')[0];
    if (!day) continue;
    if (!calendarDays[day]) calendarDays[day] = { wins: 0, losses: 0, total: 0 };
    calendarDays[day].total++;
    const r = results[getPickKey(p)];
    if (r === 'won') calendarDays[day].wins++;
    else if (r === 'lost') calendarDays[day].losses++;
  }

  const total = picks.length;

  if (total === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Statistics</h1>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444', background: '#111', border: '1px solid #1a1a1a', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No data yet</div>
          <div style={{ fontSize: 13 }}>Run Today's Picks to generate predictions</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Statistics</h1>
        <p style={{ color: '#555', fontSize: 13 }}>
          {total} predictions · {markedPicks.length} marked · Mark picks Won/Lost below to track your record
        </p>
      </div>

      {/* Stats overview */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Gauge pct={winRate} label="Win Rate" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="Total Picks" value={total} icon={Activity} />
            <StatCard label="Marked Won" value={won.length} icon={TrendingUp} color="#22c55e" />
            <StatCard label="Marked Lost" value={lost.length} icon={TrendingDown} color="#ef4444" />
            <StatCard label="Best Streak" value={bestStreak} icon={Award} color="#f0b429" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="Avg Edge (Won)" value={`${wonEdge}%`} icon={Trophy} color="#22c55e" />
            <StatCard label="Avg Edge (Lost)" value={`${lostEdge}%`} color="#ef4444" />
          </div>
        </div>
      </div>

      {/* P/L chart */}
      {plData.length > 1 && (
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Cumulative Profit / Loss</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={plData}>
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#555', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="pl" stroke="#f0b429" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {leagueData.length > 0 && (
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>League Performance</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={leagueData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <YAxis dataKey="league" type="category" tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => `${v}%`} />
                <Bar dataKey="winRate" radius={4}>
                  {leagueData.map((_, i) => <Cell key={i} fill={i === 0 ? '#f0b429' : '#2a2a2a'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {marketData.length > 0 && (
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Market Performance</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={marketData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <YAxis dataKey="market" type="category" tick={{ fill: '#888', fontSize: 9 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => `${v}%`} />
                <Bar dataKey="winRate" radius={4}>
                  {marketData.map((_, i) => <Cell key={i} fill={i === 0 ? '#22c55e' : '#2a2a2a'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Activity calendar */}
      {Object.keys(calendarDays).length > 0 && (
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Activity Calendar</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(calendarDays).sort(([a], [b]) => a.localeCompare(b)).map(([day, data]) => {
              const hasMarked = data.wins + data.losses > 0;
              const wr = (data.wins + data.losses) ? (data.wins / (data.wins + data.losses)) * 100 : 0;
              const color = hasMarked ? (wr >= 55 ? '#22c55e' : wr >= 40 ? '#f0b429' : '#ef4444') : '#2a2a2a';
              return (
                <div key={day} title={`${day}: ${data.total} picks, ${data.wins}W ${data.losses}L`}
                  style={{ width: 28, height: 28, borderRadius: 4, background: color + '33', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color, fontWeight: 600 }}>
                  {parseInt(day.split('-')[2])}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[['#22c55e', '55%+ win rate'], ['#f0b429', 'Mixed'], ['#ef4444', 'Loss day'], ['#2a2a2a', 'No results marked']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c + '44', border: `1px solid ${c}` }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent picks list with mark Won/Lost */}
      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Recent Predictions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {picks.slice(0, 30).map((p, i) => {
            const key = getPickKey(p);
            const result = results[key];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 8, background: result === 'won' ? 'rgba(34,197,94,0.05)' : result === 'lost' ? 'rgba(239,68,68,0.05)' : 'transparent',
                border: `1px solid ${result === 'won' ? 'rgba(34,197,94,0.15)' : result === 'lost' ? 'rgba(239,68,68,0.15)' : 'transparent'}`
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.home} vs {p.away}
                  </div>
                  <div style={{ fontSize: 10, color: '#555' }}>
                    {p.market} · {p.odds} · {p.confidence}% conf
                    {p.edge != null && ` · Edge ${p.edge}%`}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>{(p.created_at || '').split('T')[0]}</div>
                <ResultButtons pickKey={key} results={results} onToggle={handleToggle} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
