const BASE = '';

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getFixtures: () => request('/aura-api/fixtures'),
  getFixturesToday: () => request('/aura-api/fixtures/today'),
  predict: (match) => request('/aura-api/predict', { method: 'POST', body: JSON.stringify(match) }),
  accumulator: (matches) => request('/aura-api/accumulator', { method: 'POST', body: JSON.stringify({ matches }) }),
  picksToday: () => request('/aura-api/picks/today'),
  picksAll: () => request('/aura-api/picks/all')
};
