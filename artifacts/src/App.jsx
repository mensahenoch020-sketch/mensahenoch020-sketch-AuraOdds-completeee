import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { TrendingUp, Calendar, Layers, AlertTriangle, BarChart2 } from 'lucide-react';
import Today from './pages/Today.jsx';
import Fixtures from './pages/Fixtures.jsx';
import Accumulator from './pages/Accumulator.jsx';
import Avoid from './pages/Avoid.jsx';
import Stats from './pages/Stats.jsx';
import { AccumulatorProvider, useAccumulator } from './lib/AccumulatorContext.jsx';

const navItems = [
  { to: '/', label: "Today's Picks", icon: TrendingUp, exact: true },
  { to: '/fixtures', label: 'Fixtures', icon: Calendar },
  { to: '/accumulator', label: 'Accumulator', icon: Layers },
  { to: '/avoid', label: 'Avoid', icon: AlertTriangle },
  { to: '/stats', label: 'Stats', icon: BarChart2 }
];

function NavBar() {
  const { legs } = useAccumulator();
  return (
    <>
      <header style={{
        borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 100,
        background: '#000', display: 'none'
      }} className="desktop-nav">
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 32, height: 56 }}>
          <NavLink to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px', color: '#FFD700' }}>
              Aura<span style={{ color: '#F5A623' }}>Odds</span>
            </span>
          </NavLink>
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {navItems.map(({ to, label, icon: Icon, exact }) => (
              <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                color: isActive ? '#F5A623' : '#777',
                background: isActive ? 'rgba(245,166,35,0.12)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s'
              })}>
                <Icon size={15} />
                {label}
                {to === '/accumulator' && legs.length > 0 && (
                  <span style={{
                    background: '#F5A623', color: '#000', borderRadius: 10,
                    fontSize: 10, fontWeight: 700, padding: '1px 5px', minWidth: 16,
                    textAlign: 'center', lineHeight: '14px'
                  }}>{legs.length}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <nav className="mobile-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#000', borderTop: '1px solid #222',
        display: 'flex', justifyContent: 'space-around', padding: '6px 0 env(safe-area-inset-bottom, 6px)'
      }}>
        {navItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '4px 8px', borderRadius: 8, color: isActive ? '#F5A623' : '#555',
            textDecoration: 'none', fontSize: 10, fontWeight: 500, position: 'relative', minWidth: 52
          })}>
            {({ isActive }) => (
              <>
                <div style={{ position: 'relative' }}>
                  <Icon size={20} />
                  {to === '/accumulator' && legs.length > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -6,
                      background: '#F5A623', color: '#000', borderRadius: 10,
                      fontSize: 9, fontWeight: 700, padding: '0 4px', minWidth: 14,
                      textAlign: 'center', lineHeight: '14px'
                    }}>{legs.length}</span>
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export default function App() {
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const msUntilMidnight = midnight - now;
    const t = setTimeout(() => {
      localStorage.removeItem('fixtures_cache');
      localStorage.removeItem('fixtures_cache_time');
      window.location.reload();
    }, msUntilMidnight);
    return () => clearTimeout(t);
  }, []);

  return (
    <AccumulatorProvider>
      <BrowserRouter>
        <style>{`
          @media (min-width: 768px) {
            .desktop-nav { display: block !important; }
            .mobile-nav { display: none !important; }
            .page-content { padding-bottom: 24px !important; }
          }
        `}</style>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
          <NavBar />
          <main className="page-content" style={{
            flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto',
            padding: '20px 16px 80px'
          }}>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/fixtures" element={<Fixtures />} />
              <Route path="/accumulator" element={<Accumulator />} />
              <Route path="/avoid" element={<Avoid />} />
              <Route path="/stats" element={<Stats />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AccumulatorProvider>
  );
}
