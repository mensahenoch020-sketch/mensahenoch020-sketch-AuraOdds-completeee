import React, { useState, useEffect } from 'react';

const SUPABASE_LOGOS = 'https://ttxvmugwypsubqsoipgw.supabase.co/storage/v1/object/public/logos/logos/';
const COLORS = ['#e63946','#2a9d8f','#e9c46a','#f4a261','#264653','#6a4c93','#1982c4','#c77dff'];

let teamLogosMemory = {};
let logosFetched = false;

async function ensureLogosLoaded() {
  if (logosFetched) return;
  logosFetched = true;
  try {
    const cached = localStorage.getItem('team_logos_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.assign(teamLogosMemory, parsed);
    }
    const res = await fetch('/aura-api/team-logos');
    if (res.ok) {
      const data = await res.json();
      Object.assign(teamLogosMemory, data);
      localStorage.setItem('team_logos_cache', JSON.stringify(teamLogosMemory));
    }
  } catch {}
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/-(fc|cf|sc|ac|afc|fk|utd|united|city|town|rovers|wanderers|athletic|albion|hotspur|county|cp|rv|cf)$/g, '')
    .replace(/^(fc|ac|sc|afc)-/, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getUrls(teamName) {
  if (!teamName) return [];
  const normalized = normalizeName(teamName);
  const firstWord = teamName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const apiFootballUrl = teamLogosMemory[normalized] || teamLogosMemory[normalizeName(teamName.split(' ')[0])];
  const urls = [];
  if (apiFootballUrl) urls.push(apiFootballUrl);
  urls.push(`${SUPABASE_LOGOS}${normalized}.png`);
  if (firstWord && firstWord !== normalized) urls.push(`${SUPABASE_LOGOS}${firstWord}.png`);
  return [...new Set(urls)];
}

function InitialsAvatar({ name, size = 32 }) {
  const words = (name || '??').trim().split(' ')
    .filter(w => !['FC','AC','SC','CF','United','City','Town','AFC','BC'].includes(w));
  const initials = words.slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || '??';
  const colorIndex = (name || '').charCodeAt(0) % COLORS.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: COLORS[colorIndex],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.35), fontWeight: 'bold', color: '#000',
      flexShrink: 0, userSelect: 'none'
    }}>
      {initials}
    </div>
  );
}

export default function TeamLogo({ name, size = 32 }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [urls, setUrls] = useState(() => getUrls(name));

  useEffect(() => {
    ensureLogosLoaded().then(() => {
      setUrls(getUrls(name));
    });
  }, []);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    setUrls(getUrls(name));
  }, [name]);

  if (failed || urls.length === 0) return <InitialsAvatar name={name} size={size} />;

  return (
    <img
      key={`${urls[attempt]}_${attempt}`}
      src={urls[attempt]}
      alt={name}
      width={size}
      height={size}
      style={{ objectFit: 'contain', borderRadius: 4, flexShrink: 0, background: '#1c1c1c' }}
      onError={() => {
        if (attempt < urls.length - 1) setAttempt(attempt + 1);
        else setFailed(true);
      }}
    />
  );
}
