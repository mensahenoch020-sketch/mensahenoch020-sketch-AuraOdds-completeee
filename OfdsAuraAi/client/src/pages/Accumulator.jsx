import React, { useState } from 'react';
import { Layers, X, Loader2, Share2, Trash2, Target } from 'lucide-react';
import TeamLogo from '../components/TeamLogo.jsx';
import { useAccumulator } from '../lib/AccumulatorContext.jsx';
import { useNavigate } from 'react-router-dom';

function LocalToast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#22c55e', color: '#000', padding: '10px 20px',
      borderRadius: 20, fontWeight: 600, fontSize: 13, zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease'
    }}>{msg}</div>
  );
}

export default function Accumulator() {
  const { legs, removeLeg, clearLegs } = useAccumulator();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [analysisBullets, setAnalysisBullets] = useState([]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function analyse() {
    if (!legs.length) return;
    setAnalysing(true);
    setAnalysis(null);
    setAnalysisBullets([]);
    try {
      const res = await fetch('/api/accumulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: legs.map(l => ({
            home: l.home, away: l.away, league: l.league, date: l.date,
            home_odds: l.home_odds, draw_odds: l.draw_odds, away_odds: l.away_odds
          }))
        })
      });
      const data = await res.json();
      setAnalysis(data);
      setAnalysisBullets(data.bullets || []);
    } catch {
      setAnalysisBullets(['• Unable to analyse — please try again']);
    } finally {
      setAnalysing(false);
    }
  }

  function share() {
    const combinedOdds = analysis
      ? analysis.combined_odds
      : legs.reduce((acc, l) => acc * (l.home_odds || 1.9), 1).toFixed(2);

    const lines = [
      '🎯 AURA ACCUMULATOR',
      '━━━━━━━━━━━━━━━━━━━━',
      ...legs.map((l, i) => {
        const pick = analysis?.picks?.[i];
        if (pick) return `⚽ ${l.home} vs ${l.away} — ${pick.market} @ ${pick.odds}`;
        return `⚽ ${l.home} vs ${l.away}`;
      }),
      '━━━━━━━━━━━━━━━━━━━━',
      `Combined Odds: ${typeof combinedOdds === 'number' ? combinedOdds.toFixed(2) : combinedOdds}`
    ].join('\n');

    navigator.clipboard.writeText(lines)
      .then(() => showToast('Copied to clipboard ✓'))
      .catch(() => showToast('Copy failed'));
  }

  function doClear() {
    clearLegs();
    setAnalysis(null);
    setAnalysisBullets([]);
    setConfirmClear(false);
  }

  const estimatedOdds = legs.reduce((acc, l) => acc * (l.home_odds || 1.9), 1);
  const displayOdds = analysis ? analysis.combined_odds : parseFloat(estimatedOdds.toFixed(2));

  return (
    <div>
      <LocalToast msg={toast} />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Layers size={20} color="#f0b429" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Accumulator Builder</h1>
        </div>
        <p style={{ color: '#555', fontSize: 13 }}>
          {legs.length === 0 ? 'Add matches from Fixtures to build your accumulator' : `${legs.length} leg${legs.length > 1 ? 's' : ''} added`}
        </p>
      </div>

      {legs.length === 0 ? (
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No legs added</div>
          <div style={{ color: '#555', fontSize: 13, marginBottom: 20 }}>Visit the Fixtures page and click "+ Add" on any match</div>
          <button onClick={() => navigate('/fixtures')} style={{
            background: '#f0b429', color: '#000', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer'
          }}>Browse Fixtures</button>
        </div>
      ) : (
        <>
          {/* Payout summary */}
          <div style={{
            background: 'rgba(240,180,41,0.06)', border: '1px solid rgba(240,180,41,0.2)',
            borderRadius: 12, padding: '14px 18px', marginBottom: 16,
            display: 'flex', gap: 24, flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>Legs</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{legs.length}</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>Est. Combined Odds</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#f0b429' }}>{displayOdds}</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: 11, marginBottom: 2 }}>£10 returns</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#22c55e' }}>£{(10 * displayOdds).toFixed(2)}</div>
            </div>
          </div>

          {/* Legs list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {legs.map((leg, i) => {
              const pick = analysis?.picks?.[i];
              return (
                <div key={i} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TeamLogo name={leg.home} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{leg.home} vs {leg.away}</div>
                    <div style={{ color: '#555', fontSize: 11 }}>{leg.league}</div>
                    {pick && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(240,180,41,0.12)', color: '#f0b429', fontSize: 10, padding: '2px 7px', borderRadius: 12, fontWeight: 500 }}>{pick.market}</span>
                        <span style={{ background: '#1a1a1a', color: '#888', fontSize: 10, padding: '2px 7px', borderRadius: 12 }}>@ {pick.odds}</span>
                        <span style={{ background: '#1a1a1a', color: '#666', fontSize: 10, padding: '2px 7px', borderRadius: 12 }}>{pick.confidence}% conf</span>
                      </div>
                    )}
                  </div>
                  <TeamLogo name={leg.away} size={24} />
                  <button onClick={() => removeLeg(i)} style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666',
                    borderRadius: 8, padding: 5, display: 'flex', cursor: 'pointer'
                  }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={analyse} disabled={analysing} style={{
              flex: 1, background: '#f0b429', border: 'none', color: '#000',
              borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: analysing ? 'not-allowed' : 'pointer', opacity: analysing ? 0.7 : 1, minWidth: 160
            }}>
              {analysing
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analysing...</>
                : <><Target size={16} /> Analyse Accumulator</>
              }
            </button>
            <button onClick={share} style={{
              background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#999',
              borderRadius: 10, padding: '12px 14px', fontWeight: 500, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
            }}>
              <Share2 size={14} /> Share
            </button>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666',
                borderRadius: 10, padding: '12px 14px', fontWeight: 500, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
              }}>
                <Trash2 size={14} /> Clear all
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={doClear} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Confirm Clear</button>
                <button onClick={() => setConfirmClear(false)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 8, padding: '8px 14px', fontWeight: 500, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
          </div>

          {/* Analysis results */}
          {analysisBullets.length > 0 && (
            <div className="fade-in" style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#888' }}>AI Analysis</div>
              {analysisBullets.map((b, i) => (
                <div key={i} style={{ color: '#999', fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>{b}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
