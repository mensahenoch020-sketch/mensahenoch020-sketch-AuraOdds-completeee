import React, { createContext, useContext, useState, useEffect } from 'react';

const AccumulatorContext = createContext();

function getMatchKey(match) {
  return `${match.home}_${match.away}_${match.date || ''}`;
}

export function AccumulatorProvider({ children }) {
  const [legs, setLegs] = useState(() => {
    try {
      const saved = localStorage.getItem('accumulator');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('accumulator', JSON.stringify(legs)); } catch {}
  }, [legs]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function addLeg(match) {
    const key = getMatchKey(match);
    setLegs(prev => {
      if (prev.find(l => getMatchKey(l) === key)) return prev;
      return [...prev, match];
    });
    showToast('Added to Accumulator ✓');
    return true;
  }

  function removeLeg(index) {
    setLegs(prev => prev.filter((_, i) => i !== index));
  }

  function removeLegByKey(match) {
    const key = getMatchKey(match);
    setLegs(prev => prev.filter(l => getMatchKey(l) !== key));
  }

  function isInAccumulator(match) {
    const key = getMatchKey(match);
    return legs.some(l => getMatchKey(l) === key);
  }

  function clearLegs() { setLegs([]); }

  return (
    <AccumulatorContext.Provider value={{ legs, addLeg, removeLeg, removeLegByKey, isInAccumulator, clearLegs, toast }}>
      {children}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#22c55e', color: '#000', padding: '10px 20px',
          borderRadius: 20, fontWeight: 600, fontSize: 13, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease'
        }}>{toast}</div>
      )}
    </AccumulatorContext.Provider>
  );
}

export function useAccumulator() {
  return useContext(AccumulatorContext);
}
