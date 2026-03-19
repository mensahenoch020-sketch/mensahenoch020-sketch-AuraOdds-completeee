import React, { useState, useEffect } from 'react';

const SUPABASE_LOGOS = 'https://ttxvmugwypsubqsoipgw.supabase.co/storage/v1/object/public/logos/logos/';

const COLORS = ['#e63946','#2a9d8f','#e9c46a','#f4a261','#264653','#6a4c93','#1982c4','#ff6b6b','#06d6a0'];

function getPrimaryLogoUrl(name) {
  if (!name) return null;
  const normalized = name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${SUPABASE_LOGOS}${normalized}.png`;
}

function getStrippedUrl(name) {
  if (!name) return null;
  const normalized = name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/-(fc|cf|sc|ac|afc|utd|united|city|town|rovers|wanderers|athletic|albion|hotspur|county|real|club)$/g, '')
    .replace(/^-+|-+$/g, '');
  return `${SUPABASE_LOGOS}${normalized}.png`;
}

function getShortUrl(name) {
  if (!name) return null;
  const first = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return first ? `${SUPABASE_LOGOS}${first}.png` : null;
}

function InitialsAvatar({ name, size }) {
  const initials = (name || '??').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const color = COLORS[(name || '').charCodeAt(0) % COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.35,
      fontWeight: 700, color: 'white', flexShrink: 0,
      userSelect: 'none'
    }}>
      {initials}
    </div>
  );
}

export default function TeamLogo({ name, size = 32 }) {
  const fallbacks = [
    getPrimaryLogoUrl(name),
    getStrippedUrl(name),
    getShortUrl(name),
    null
  ].filter((v, i, a) => v !== null && a.indexOf(v) === i);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [name]);

  function handleError() {
    const next = index + 1;
    if (next < fallbacks.length) {
      setIndex(next);
    } else {
      setFailed(true);
    }
  }

  if (failed || fallbacks.length === 0) {
    return <InitialsAvatar name={name} size={size} />;
  }

  return (
    <img
      key={fallbacks[index]}
      src={fallbacks[index]}
      alt={name}
      width={size}
      height={size}
      onError={handleError}
      style={{
        borderRadius: '50%', objectFit: 'contain',
        background: '#111', flexShrink: 0
      }}
    />
  );
}
