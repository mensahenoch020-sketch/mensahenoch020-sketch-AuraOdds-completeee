import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import MatchCard from '../components/MatchCard.jsx';
import { RefreshCw, TrendingUp, Zap, Target } from 'lucide-react';

const AUTO_REFRESH_MS = 30 * 60 * 1000;

function StatBox({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={14} color={color || '#777'} />
        <span style={{ color: '#777', fontSize: 11 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#FFD700' }}>{value}</div>
    </div>
  );
}

const SORT_OPTIONS = [
  { key: 'edge', label: 'Sort by Edge' },
  { key: 'confidence', label: 'Sort by Confidence' },
  { key: 'odds', label: 'Sort by Odds' }
];

export default function Today() {
  const [matches, setMatches] = useState([]);
  const [predictionsList, setPredictionsList] = useState([]);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState({});
  const [error, setError] = useState(null);
  const [leagueFilter, setLeagueFilter] = useState('All');
  const [activeSort, setActiveSort] = useState('edge');
  const [lastRefresh, setLastRefresh] = useState(null);

  function getKey(m) { return `${m.home}_${m.away}`; }

  function applySort(list, s) {
    return [...list].sort((a, b) => {
      const ap = a.prediction, bp = b.prediction;
      if (!ap && !bp) return 0;
      if (!ap) return 1;
      if (!bp) return -1;
      if (s === 'edge') return (bp.edge || 0) - (ap.edge || 0);
      if (s === 'confidence') return (bp.confidence || 0) - (ap.confidence || 0);
      if (s === 'odds') return (bp.odds || 0) - (ap.odds || 0);
      return 0;
    });
  }

  function handleSort(key) {
    if (key === 'confidence') {
      const sorted = [...predictionsList].sort((a, b) => {
        const ap = a.prediction, bp = b.prediction;
        if (!ap && !bp) return 0;
        if (!ap) return 1;
        if (!bp) return -1;
        return (bp.confidence || 0) - (ap.confidence || 0);
      });
      setPredictionsList(sorted);
      setActiveSort('confidence');
    } else if (key === 'edge') {
      setPredictionsList(prev => applySort(prev, 'edge'));
      setActiveSort('edge');
    } else if (key === 'odds') {
      setPredictionsList(prev => applySort(prev, 'odds'));
      setActiveSort('odds');
    }
  }

  const loadTodaysPredictions = useCallback(async () => {
    try {
      setLoadingFixtures(true);
      setError(null);
      const data = await api.getFixturesToday();
      const ms = data.matches || [];
      setMatches(ms);
      setLastRefresh(new Date());
      const initial = ms.map(m => ({ match: m, prediction: null }));
      setPredictionsList(initial);
      setLoadingFixtures(false);
      for (const m of ms) {
        const key = getKey(m);
        setLoadingKeys(prev => ({ ...prev, [key]: true }));
        try {
          const pred = await api.predict(m);
          setPredictionsList(prev => {
            const updated = prev.map(item =>
              getKey(item.match) === key ? { ...item, prediction: pred } : item
            );
            return applySort(updated, activeSort);
          });
        } catch {}
        setLoadingKeys(prev => ({ ...prev, [key]: false }));
      }
    } catch (e) {
      setError(e.message);
      setLoadingFixtures(false);
    }
  }, [activeSort]);

  useEffect(() => {
    loadTodaysPredictions();
    const interval = setInterval(loadTodaysPredictions, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const leagues = ['All', ...new Set(matches.map(m => m.league).filter(Boolean))];
  const filtered = predictionsList.filter(({ match }) =>
    leagueFilter === 'All' || match.league === leagueFilter
  );

  const predictions = predictionsList.map(p => p.prediction).filter(Boolean);
  const sharpPicks = predictions.filter(p => (p.edge || 0) >= 10).length;
  const avgEdge = predictions.length
    ? (predictions.reduce((s, p) => s + (p.edge || 0), 0) / predictions.length).toFixed(1)
    : '0.0';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#FFD700' }}>Today's Picks</h1>
          <p style={{ color: '#777', fontSize: 12 }}>
            {lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={loadTodaysPredictions}
          disabled={loadingFixtures}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#1c1c1c',
            border: '1px solid #333', color: '#aaa', borderRadius: 8, padding: '8px 14px',
            fontSize: 12, fontWeight: 500, cursor: 'pointer'
          }}
        >
          <RefreshCw size={13} style={{ animation: loadingFixtures ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatBox label="Total Picks" value={matches.length} icon={TrendingUp} />
        <StatBox label="Sharp Picks (Edge 10%+)" value={sharpPicks} icon={Zap} color="#F5A623" />
        <StatBox label="Avg Edge" value={`${avgEdge}%`} icon={Target} color="#22c55e" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
          {leagues.map(l => (
            <button key={l} onClick={() => setLeagueFilter(l)} style={{
              background: leagueFilter === l ? 'rgba(245,166,35,0.15)' : '#1c1c1c',
              border: `1px solid ${leagueFilter === l ? '#F5A623' : '#222'}`,
              color: leagueFilter === l ? '#F5A623' : '#777',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer'
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {SORT_OPTIONS.map(({ key, label }) => (
            <button key={key} onClick={() => handleSort(key)} style={{
              background: activeSort === key ? '#F5A623' : '#1c1c1c',
              border: `1px solid ${activeSort === key ? '#F5A623' : '#333'}`,
              color: activeSort === key ? '#000' : '#777',
              borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s'
            }}>{label}</button>
          ))}
        </div>
      </div>

      {loadingFixtures ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: '#1c1c1c', border: '1px solid #222', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 13, width: '50%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '30%' }} />
                </div>
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              </div>
              <div className="skeleton" style={{ height: 10, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 10, width: '60%' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6, color: '#FFD700' }}>No fixtures found</div>
          <div style={{ fontSize: 13 }}>Check the Fixtures Calendar for upcoming matches</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(({ match, prediction }) => {
            const key = getKey(match);
            return (
              <MatchCard
                key={key}
                match={match}
                prediction={prediction}
                loading={loadingKeys[key]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
