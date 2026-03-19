import React, { useEffect, useState } from 'react';
import MatchCard from '../components/MatchCard.jsx';
import { Search } from 'lucide-react';

const CACHE_KEY = 'fixtures_cache';
const CACHE_TIME_KEY = 'fixtures_cache_time';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function fmtDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return { label: 'Today', sub: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) };
  if (dateStr === tomorrow) return { label: 'Tomorrow', sub: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) };
  return {
    label: d.toLocaleDateString('en', { weekday: 'short' }),
    sub: d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  };
}

export default function Fixtures() {
  const [byDate, setByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState({});
  const [predicting, setPredicting] = useState({});
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('All');
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Check localStorage cache first
        const cached = localStorage.getItem(CACHE_KEY);
        const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
        if (cached && cacheTime && Date.now() - parseInt(cacheTime) < CACHE_TTL) {
          const data = JSON.parse(cached);
          setByDate(data);
          // Select today if data exists for today, else first date
          const today = new Date().toISOString().split('T')[0];
          const firstDate = Object.keys(data).sort()[0];
          setSelectedDay(data[today] ? today : firstDate || today);
          setLoading(false);
          return;
        }

        // Fetch fresh
        const res = await fetch('/api/fixtures');
        if (!res.ok) throw new Error('Failed to load fixtures');
        const data = await res.json();
        const dateMap = data.by_date || {};

        setByDate(dateMap);

        // Cache in localStorage
        localStorage.setItem(CACHE_KEY, JSON.stringify(dateMap));
        localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));

        // Select today or first date
        const today = new Date().toISOString().split('T')[0];
        const firstDate = Object.keys(dateMap).sort()[0];
        setSelectedDay(dateMap[today] ? today : firstDate || today);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Get all dates with fixtures, sorted
  const allDates = Object.keys(byDate).sort();

  // All leagues across all fixtures for filter
  const matchesForDay = byDate[selectedDay] || [];
  const allLeagues = ['All', ...new Set(
    Object.values(byDate).flat().map(m => m.league).filter(Boolean)
  )].sort();

  const filtered = matchesForDay.filter(m => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (m.home || '').toLowerCase().includes(q) || (m.away || '').toLowerCase().includes(q);
    const matchesLeague = leagueFilter === 'All' || m.league === leagueFilter;
    return matchesSearch && matchesLeague;
  });

  async function predictOne(match) {
    const key = `${match.home}_${match.away}_${match.date}`;
    setPredicting(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(match)
      });
      const p = await res.json();
      setPredictions(prev => ({ ...prev, [key]: p }));
    } catch {}
    setPredicting(prev => ({ ...prev, [key]: false }));
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Fixtures Calendar</h1>
        <p style={{ color: '#555', fontSize: 13 }}>
          {allDates.length > 0 ? `${Object.values(byDate).flat().length} matches across ${allDates.length} days` : 'Browse upcoming matches and get instant predictions'}
        </p>
      </div>

      {/* Day strip — ALL dates with fixtures */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {allDates.map(day => {
          const count = (byDate[day] || []).length;
          const { label, sub } = fmtDay(day);
          const active = day === selectedDay;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                background: active ? 'rgba(240,180,41,0.12)' : '#111',
                border: `1px solid ${active ? '#f0b429' : '#1a1a1a'}`,
                borderRadius: 10, padding: '8px 14px', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: 10, color: active ? '#f0b429' : '#666', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 12, color: active ? '#fff' : '#888', fontWeight: 500 }}>{sub}</span>
              {count > 0 && (
                <span style={{
                  background: active ? '#f0b429' : '#1a1a1a', color: active ? '#000' : '#666',
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, marginTop: 1
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams..."
            style={{ width: '100%', paddingLeft: 30, fontSize: 12 }}
          />
        </div>
        <select
          value={leagueFilter}
          onChange={e => setLeagueFilter(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', flexShrink: 0, maxWidth: 180 }}
        >
          {allLeagues.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <div className="skeleton" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: '50%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '30%' }} />
                </div>
                <div className="skeleton" style={{ width: 26, height: 26, borderRadius: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No matches found</div>
          <div style={{ fontSize: 13 }}>{search ? 'Try different search terms' : 'No fixtures for this day with current filters'}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(match => {
              const key = `${match.home}_${match.away}_${match.date}`;
              return (
                <MatchCard
                  key={key}
                  match={match}
                  prediction={predictions[key]}
                  loading={predicting[key]}
                  onPredict={() => predictOne(match)}
                  compact
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
