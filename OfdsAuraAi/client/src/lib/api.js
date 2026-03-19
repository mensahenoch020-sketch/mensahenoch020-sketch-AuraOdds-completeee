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
  getFixtures: () => request('/api/fixtures'),
  getFixturesToday: () => request('/api/fixtures/today'),
  predict: (match) => request('/api/predict', { method: 'POST', body: JSON.stringify(match) }),
  accumulator: (matches) => request('/api/accumulator', { method: 'POST', body: JSON.stringify({ matches }) }),
  picksToday: () => request('/api/picks/today'),
  picksAll: () => request('/api/picks/all')
};
