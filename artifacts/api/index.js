process.on(‘uncaughtException’, (err) => { console.error(‘Uncaught Exception:’, err); });
process.on(‘unhandledRejection’, (err) => { console.error(‘Unhandled Rejection:’, err); });

import express from ‘express’;
import cors from ‘cors’;
import { createClient } from ‘@supabase/supabase-js’;
import path from ‘path’;
import { fileURLToPath } from ‘url’;
import fs from ‘fs’;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY;
const GEMINI_KEY1 = process.env.GEMINI_KEY1;
const GEMINI_KEY2 = process.env.GEMINI_KEY2;
const GROQ_KEYS = [
process.env.GROQ_KEY_1,
process.env.GROQ_KEY_2,
process.env.GROQ_KEY_3,
process.env.GROQ_KEY_4
];
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

const COMPETITIONS = [2021, 2014, 2002, 2019, 2015, 2001, 2018, 2017, 2003, 2013];
const LEAGUE_NAMES = {
2021: ‘Premier League’, 2014: ‘La Liga’, 2002: ‘Bundesliga’,
2019: ‘Serie A’, 2015: ‘Ligue 1’, 2001: ‘Champions League’,
2018: ‘Europa League’, 2017: ‘Championship’, 2003: ‘Eredivisie’, 2013: ‘Brasileirão’
};
const SPORT_KEYS = [
‘soccer_england_premier_league’, ‘soccer_spain_la_liga’, ‘soccer_germany_bundesliga’,
‘soccer_italy_serie_a’, ‘soccer_france_ligue_one’, ‘soccer_uefa_champs_league’,
‘soccer_england_league1’, ‘soccer_netherlands_eredivisie’
];
const DERBY_PAIRS = [
[‘arsenal’, ‘tottenham’], [‘chelsea’, ‘arsenal’], [‘liverpool’, ‘everton’],
[‘manchester united’, ‘manchester city’], [‘real madrid’, ‘atletico’],
[‘barcelona’, ‘real madrid’], [‘ac milan’, ‘inter’], [‘juventus’, ‘torino’],
[‘boca’, ‘river’], [‘celtic’, ‘rangers’], [‘galatasaray’, ‘fenerbahce’]
];

let oddsCache = { data: [], ts: 0 };
let lastMarketByLeague = {};
let teamLogosCache = {};
let groqKeyIndex = 0;

function getDateStr(daysFromNow = 0) {
const d = new Date();
d.setDate(d.getDate() + daysFromNow);
return d.toISOString().split(‘T’)[0];
}

function normalizeName(name) {
return (name || ‘’).toLowerCase().replace(/\s+/g, ‘-’).replace(/[^a-z0-9-]/g, ‘’);
}

function isKnownDerby(home, away) {
const h = (home || ‘’).toLowerCase();
const a = (away || ‘’).toLowerCase();
return DERBY_PAIRS.some(([t1, t2]) =>
(h.includes(t1) && a.includes(t2)) || (h.includes(t2) && a.includes(t1))
);
}

async function callGemini(prompt) {
for (const key of [GEMINI_KEY1, GEMINI_KEY2]) {
try {
const res = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
{
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({
contents: [{ parts: [{ text: prompt }] }],
generationConfig: { maxOutputTokens: 400, temperature: 0.6 }
})
}
);
if (!res.ok) continue;
const data = await res.json();
const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
if (text) return text;
} catch { continue; }
}
return null;
}

async function callGroq(prompt) {
for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
const key = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
groqKeyIndex++;
try {
const res = await fetch(‘https://api.groq.com/openai/v1/chat/completions’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’, Authorization: `Bearer ${key}` },
body: JSON.stringify({
model: ‘llama-3.3-70b-versatile’,
messages: [{ role: ‘user’, content: prompt }],
max_tokens: 400
})
});
if (!res.ok) continue;
const data = await res.json();
const text = data?.choices?.[0]?.message?.content;
if (text) return text;
} catch { continue; }
}
return null;
}

async function callAI(prompt) {
const gemini = await callGemini(prompt);
if (gemini) return gemini;
return await callGroq(prompt);
}

async function getAllOdds() {
if (Date.now() - oddsCache.ts < 20 * 60 * 1000 && oddsCache.data.length > 0) return oddsCache.data;
const results = await Promise.all(
SPORT_KEYS.map(async key => {
try {
const res = await fetch(
`https://api.the-odds-api.com/v4/sports/${key}/odds/?apiKey=${ODDS_API_KEY}&regions=uk&markets=h2h&oddsFormat=decimal`
);
if (!res.ok) return [];
return await res.json();
} catch { return []; }
})
);
const flat = results.flat();
oddsCache = { data: flat, ts: Date.now() };
return flat;
}

function findOddsForMatch(allOdds, home, away) {
if (!home || !away) return {};
const h0 = home.toLowerCase().split(’ ‘)[0];
const a0 = away.toLowerCase().split(’ ’)[0];
const match = allOdds.find(o => {
const oh = (o.home_team || ‘’).toLowerCase();
const oa = (o.away_team || ‘’).toLowerCase();
return oh.includes(h0) && oa.includes(a0);
});
if (!match?.bookmakers?.[0]?.markets?.[0]?.outcomes) return {};
const outcomes = match.bookmakers[0].markets[0].outcomes;
const result = {};
for (const o of outcomes) {
const n = (o.name || ‘’).toLowerCase();
if (n.includes(h0)) result.home_odds = o.price;
else if (n.includes(a0)) result.away_odds = o.price;
else result.draw_odds = o.price;
}
return result;
}

async function fetchFDFixtures() {
const results = await Promise.all(
COMPETITIONS.map(async id => {
try {
const res = await fetch(
`https://api.football-data.org/v4/competitions/${id}/matches?status=SCHEDULED`,
{ headers: { ‘X-Auth-Token’: FOOTBALL_DATA_KEY } }
);
if (!res.ok) return [];
const data = await res.json();
return (data.matches || [])
.filter(m => [‘TIMED’, ‘SCHEDULED’].includes(m.status) && m.homeTeam?.name && m.awayTeam?.name)
.map(m => ({
fd_home: m.homeTeam.name,
fd_away: m.awayTeam.name,
date: m.utcDate.split(‘T’)[0],
time: m.utcDate.split(‘T’)[1].substring(0, 5),
league: LEAGUE_NAMES[id] || m.competition?.name || ‘Unknown’
}));
} catch { return []; }
})
);
return results.flat();
}

async function fetchAPIFootballFixtures() {
const results = [];
const promises = [];
for (let d = 0; d <= 7; d++) {
const dateStr = getDateStr(d);
promises.push((async () => {
try {
const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?date=${dateStr}`, {
headers: { ‘x-apisports-key’: API_FOOTBALL_KEY }
});
if (!res.ok) return;
const data = await res.json();
for (const f of (data.response || [])) {
const home = f.teams?.home?.name;
const away = f.teams?.away?.name;
if (!home || !away) continue;
const homeLogo = f.teams?.home?.logo;
const awayLogo = f.teams?.away?.logo;
if (homeLogo) teamLogosCache[normalizeName(home)] = homeLogo;
if (awayLogo) teamLogosCache[normalizeName(away)] = awayLogo;
const fixtureDate = f.fixture?.date ? f.fixture.date.slice(0, 10) : dateStr;
const fixtureTime = f.fixture?.date ? new Date(f.fixture.date).toTimeString().slice(0, 5) : ‘20:00’;
results.push({ home, away, league: f.league?.name || ‘Unknown’, date: fixtureDate, time: fixtureTime, homeLogo, awayLogo });
}
} catch {}
})());
}
await Promise.all(promises);
return results;
}

function buildTimeLookup(fdFixtures) {
const map = {};
for (const m of fdFixtures) {
const key = m.fd_home
? `${normalizeName(m.fd_home)}_${normalizeName(m.fd_away)}_${m.date}`
: `${normalizeName(m.home)}_${normalizeName(m.away)}_${m.date}`;
map[key] = m.time;
}
return map;
}

async function getH2H(home, away) {
if (!home || !away) return [];
const firstHome = home.toLowerCase().split(’ ‘)[0];
const firstAway = away.toLowerCase().split(’ ‘)[0];
const { data } = await supabase
.from(‘matches’)
.select(’*’)
.or(`and(team1.ilike.%${firstHome}%,team2.ilike.%${firstAway}%),and(team1.ilike.%${firstAway}%,team2.ilike.%${firstHome}%)`)
.not(‘ft_home’, ‘is’, null)
.order(‘date’, { ascending: false })
.limit(20);
return data || [];
}

async function getTeamForm(team) {
if (!team) return [];
const first = team.toLowerCase().split(’ ‘)[0];
const { data } = await supabase
.from(‘matches’)
.select(’*’)
.or(`team1.ilike.%${first}%,team2.ilike.%${first}%`)
.not(‘ft_home’, ‘is’, null)
.order(‘date’, { ascending: false })
.limit(10);
return data || [];
}

function calcH2HStats(h2h, home) {
const firstHome = (home || ‘’).toLowerCase().split(’ ’)[0];
let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0;
for (const m of h2h) {
const isHomeInTeam1 = (m.team1 || ‘’).toLowerCase().includes(firstHome);
const fh = parseInt(m.ft_home) || 0;
const fa = parseInt(m.ft_away) || 0;
totalGoals += fh + fa;
if (fh > fa) { isHomeInTeam1 ? homeWins++ : awayWins++; }
else if (fa > fh) { isHomeInTeam1 ? awayWins++ : homeWins++; }
else draws++;
}
const total = Math.max(h2h.length, 1);
return {
homeWins, awayWins, draws, totalMatches: h2h.length,
homeWinProb: homeWins / total,
awayWinProb: awayWins / total,
drawProb: draws / total,
avgGoals: totalGoals / total
};
}

function calcFormSummary(form, teamName) {
const first = (teamName || ‘’).toLowerCase().split(’ ‘)[0];
const results = form.slice(0, 5).map(m => {
const isTeam1 = (m.team1 || ‘’).toLowerCase().includes(first);
const fh = parseInt(m.ft_home) || 0;
const fa = parseInt(m.ft_away) || 0;
if (isTeam1) return fh > fa ? ‘W’ : fh < fa ? ‘L’ : ‘D’;
return fa > fh ? ‘W’ : fa < fh ? ‘L’ : ‘D’;
});
return results.join(’ ’) || ‘No data’;
}

const FORM_WEIGHTS = [
0.5/3, 0.5/3, 0.5/3,
0.3/4, 0.3/4, 0.3/4, 0.3/4,
0.2/3, 0.2/3, 0.2/3
];

function calcWeightedGoals(form, teamName, type) {
const first = (teamName || ‘’).toLowerCase().split(’ ’)[0];
let scored = 0, conceded = 0, totalWeight = 0;
for (let i = 0; i < Math.min(form.length, 10); i++) {
const m = form[i];
const w = FORM_WEIGHTS[i] || 0.05;
const isTeam1 = (m.team1 || ‘’).toLowerCase().includes(first);
const fh = parseInt(m.ft_home) || 0;
const fa = parseInt(m.ft_away) || 0;
scored += (isTeam1 ? fh : fa) * w;
conceded += (isTeam1 ? fa : fh) * w;
totalWeight += w;
}
if (totalWeight === 0) return { scored: 1.2, conceded: 1.0 };
return { scored: scored / totalWeight, conceded: conceded / totalWeight };
}

function poissonPMF(lambda, k) {
if (lambda <= 0) return k === 0 ? 1 : 0;
let result = Math.exp(-lambda);
for (let i = 1; i <= k; i++) result = result * lambda / i;
return result;
}

function calcPoissonProbs(lambdaHome, lambdaAway) {
let homeWin = 0, awayWin = 0, draw = 0;
const maxGoals = 8;
for (let i = 0; i <= maxGoals; i++) {
for (let j = 0; j <= maxGoals; j++) {
const p = poissonPMF(lambdaHome, i) * poissonPMF(lambdaAway, j);
if (i > j) homeWin += p;
else if (i < j) awayWin += p;
else draw += p;
}
}
return { homeWin, awayWin, draw };
}

function pickMarketWithRotation(league, homeProb, awayProb, drawProb, totalExpGoals) {
let markets;
if (homeProb > 0.58) {
markets = [‘Home Win’, ‘Asian Handicap Home -0.5’, ‘1UP Home Win’, ‘2UP Home Win’, ‘Double Chance 1X’];
} else if (awayProb > 0.52) {
markets = [‘Away Win’, ‘Asian Handicap Away +0.5’, ‘1UP Away Win’, ‘2UP Away Win’, ‘Double Chance X2’];
} else if (drawProb > 0.38) {
markets = [‘Draw’, ‘Double Chance 1X’, ‘Double Chance X2’, ‘Asian Handicap Away +0.5’];
} else if (totalExpGoals > 2.8) {
markets = [‘Over 2.5 Goals’, ‘BTTS Yes’, ‘Over 1.5 Goals’];
} else if (totalExpGoals < 2.0) {
markets = [‘Under 2.5 Goals’, ‘BTTS No’];
} else {
markets = [‘Home Win’, ‘Away Win’, ‘Draw’, ‘Double Chance 1X’, ‘Double Chance X2’,
‘Over 2.5 Goals’, ‘Under 2.5 Goals’, ‘BTTS Yes’, ‘BTTS No’,
‘Asian Handicap Home -0.5’, ‘Asian Handicap Away +0.5’, ‘Over 1.5 Goals’];
}
const lastMarket = lastMarketByLeague[league];
const available = markets.filter(m => m !== lastMarket);
const pool = available.length > 0 ? available : markets;
const chosen = pool[Math.floor(Math.random() * pool.length)];
lastMarketByLeague[league] = chosen;
return chosen;
}

function getOddsForMarket(market, home_odds, draw_odds, away_odds) {
if (!market) return home_odds || 1.9;
if (market.includes(‘Away’) || market === ‘Double Chance X2’) return away_odds || 2.2;
if (market === ‘Draw’ || market === ‘Double Chance 12’) return draw_odds || 3.2;
if (market.includes(‘Over’) || market === ‘BTTS Yes’) return 1.85;
if (market.includes(‘Under’) || market === ‘BTTS No’) return 1.75;
if (market.includes(‘Double Chance 1X’)) return home_odds ? home_odds * 0.75 : 1.45;
return home_odds || 1.90;
}

function getProbForMarket(market, homeProb, awayProb, drawProb) {
if (!market) return homeProb;
if (market.includes(‘Away Win’) || market.includes(‘Away’)) return awayProb + 0.05;
if (market === ‘Draw’) return drawProb + 0.05;
if (market === ‘Double Chance 1X’) return homeProb + drawProb;
if (market === ‘Double Chance X2’) return awayProb + drawProb;
if (market === ‘Double Chance 12’) return homeProb + awayProb;
if (market.includes(‘Over’) || market === ‘BTTS Yes’) return 0.52;
if (market.includes(‘Under’) || market === ‘BTTS No’) return 0.55;
return homeProb + 0.05;
}

async function checkExistingPick(home, away) {
const today = new Date().toISOString().split(‘T’)[0];
const input = `${home} vs ${away}`;
const { data } = await supabase
.from(‘picks’)
.select(’*’)
.eq(‘user_input’, input)
.gte(‘created_at’, `${today}T00:00:00`)
.order(‘created_at’, { ascending: false })
.limit(1);
if (data?.length > 0) {
try { return JSON.parse(data[0].analysis); } catch { return null; }
}
return null;
}

async function predictMatch({ home, away, league, date, home_odds, draw_odds, away_odds }) {
const existing = await checkExistingPick(home, away);
if (existing && existing.market) return existing;

const [h2h, homeForm, awayForm] = await Promise.all([
getH2H(home, away),
getTeamForm(home),
getTeamForm(away)
]);

const h2hStats = calcH2HStats(h2h, home);
const { homeWins, awayWins, draws, totalMatches } = h2hStats;
const h2hHomeWinProb = h2hStats.homeWinProb;
const h2hAwayWinProb = h2hStats.awayWinProb;
const h2hDrawProb = h2hStats.drawProb;

const homeWeighted = calcWeightedGoals(homeForm, home);
const awayWeighted = calcWeightedGoals(awayForm, away);
const homeAvgScored = homeWeighted.scored;
const homeAvgConceded = homeWeighted.conceded;
const awayAvgScored = awayWeighted.scored;
const awayAvgConceded = awayWeighted.conceded;

const homeExpectedGoals = Math.max(0.3, ((homeAvgScored + awayAvgConceded) / 2) * 1.1);
const awayExpectedGoals = Math.max(0.3, ((awayAvgScored + homeAvgConceded) / 2) * 0.9);
const poissonProbs = calcPoissonProbs(homeExpectedGoals, awayExpectedGoals);

const h2hWeight = Math.min(0.4, totalMatches >= 5 ? 0.4 : totalMatches * 0.08);
const poissonWeight = 1 - h2hWeight;
const finalHomeProb = Math.max(0.05, poissonProbs.homeWin * poissonWeight + h2hHomeWinProb * h2hWeight);
const finalAwayProb = Math.max(0.05, poissonProbs.awayWin * poissonWeight + h2hAwayWinProb * h2hWeight);
const finalDrawProb = Math.max(0.05, 1 - finalHomeProb - finalAwayProb);

const totalExpGoals = homeExpectedGoals + awayExpectedGoals;
const avgGoals = h2hStats.avgGoals || totalExpGoals;

const market = pickMarketWithRotation(league || ‘Unknown’, finalHomeProb, finalAwayProb, finalDrawProb, totalExpGoals);

const odds = parseFloat(getOddsForMarket(market, home_odds, draw_odds, away_odds).toFixed(2));
const ourProb = Math.min(0.95, getProbForMarket(market, finalHomeProb, finalAwayProb, finalDrawProb));

const impliedProb = 1 / odds;
const edge = parseFloat(((ourProb - impliedProb) * 100).toFixed(1));

const b = odds - 1;
const q = 1 - ourProb;
const kelly = Math.max(0, Math.min(5, ((b * ourProb - q) / b) * 100));
const stake = parseFloat(kelly.toFixed(1));

const confidence = Math.min(92, Math.max(45, Math.round(ourProb * 100 + 8)));
const homeFormSummary = calcFormSummary(homeForm, home);
const awayFormSummary = calcFormSummary(awayForm, away);
const limitedH2H = totalMatches === 0;
const h2hNote = limitedH2H ? ‘Limited H2H data’ : `${totalMatches} meetings`;

// 🛑 THE BOUNCER: Block anything under 80% confidence
if (confidence < 80) {
console.log(`[BOUNCER] Skipped ${home} vs ${away} - Confidence: ${confidence}%`);
return {
home, away, league, date,
market: “SKIP (Too Risky)”,
odds: 0, confidence, edge: 0, stake: 0,
bullets: [
“• Match prediction skipped by AuraAI.”,
“• Confidence level below strict 80% threshold.”,
“• Statistical models indicate too much volatility.”
],
h2hMatches: totalMatches,
homeWinProb: parseFloat(finalHomeProb.toFixed(3)),
awayWinProb: parseFloat(finalAwayProb.toFixed(3)),
drawProb: parseFloat(finalDrawProb.toFixed(3)),
avgGoals: parseFloat(avgGoals.toFixed(2)),
homeExpectedGoals: parseFloat(homeExpectedGoals.toFixed(2)),
awayExpectedGoals: parseFloat(awayExpectedGoals.toFixed(2)),
homeForm: homeFormSummary,
awayForm: awayFormSummary
};
}

// MODEL 7 — Gemini/Groq AI with full stats (ONLY RUNS IF CONFIDENCE IS 80%+)
const prompt = `You are AuraAI, a highly strict sports betting analyst. Analyse this match using ONLY the provided statistics.

Match: ${home} vs ${away}
League: ${league || ‘Unknown’}
Selected Pick: ${market} @ ${odds}

H2H (${h2hNote}):

- ${home} wins: ${homeWins} (${(h2hHomeWinProb * 100).toFixed(0)}%)
- ${away} wins: ${awayWins} (${(h2hAwayWinProb * 100).toFixed(0)}%)
- Draws: ${draws} (${(h2hDrawProb * 100).toFixed(0)}%)
- Avg goals: ${avgGoals.toFixed(1)}

Poisson Model:

- Expected goals: ${home} ${homeExpectedGoals.toFixed(2)} — ${away} ${awayExpectedGoals.toFixed(2)}
- Win probabilities: Home ${(finalHomeProb*100).toFixed(0)}% | Away ${(finalAwayProb*100).toFixed(0)}% | Draw ${(finalDrawProb*100).toFixed(0)}%

Form (weighted last 10):

- ${home}: ${homeFormSummary} | scored ${homeAvgScored.toFixed(1)} | conceded ${homeAvgConceded.toFixed(1)} per game
- ${away}: ${awayFormSummary} | scored ${awayAvgScored.toFixed(1)} | conceded ${awayAvgConceded.toFixed(1)} per game

Edge: ${edge}% | Confidence: ${confidence}%

Write exactly 3 bullet points (starting with •) explaining why ${market} is the sharp pick.
If the stats look like a trap, output the exact word “SKIP”.
Each bullet must use the real stats above. No markdown. One line per bullet.${limitedH2H ? ‘\nNote: Limited H2H, rely more on form and Poisson model.’ : ‘’}`;

const aiText = await callAI(prompt);

// Secondary safety net just in case the AI says SKIP
let finalMarket = market;
if (aiText && aiText.includes(“SKIP”)) {
finalMarket = “SKIP (AI Veto)”;
}

const bullets = (aiText || `• Poisson model projects ${homeExpectedGoals.toFixed(1)} vs ${awayExpectedGoals.toFixed(1)} expected goals\n• ${confidence}% confidence based on blended statistical model\n• Manage bankroll: ${stake}% stake recommended`)
.split(’\n’)
.map(l => l.trim())
.filter(l => l.startsWith(’•’))
.slice(0, 3);

const result = {
home, away, league, date,
market: finalMarket, odds,
confidence, edge, stake,
home_odds, draw_odds, away_odds,
bullets,
h2hMatches: totalMatches,
homeWinProb: parseFloat(finalHomeProb.toFixed(3)),
awayWinProb: parseFloat(finalAwayProb.toFixed(3)),
drawProb: parseFloat(finalDrawProb.toFixed(3)),
avgGoals: parseFloat(avgGoals.toFixed(2)),
homeExpectedGoals: parseFloat(homeExpectedGoals.toFixed(2)),
awayExpectedGoals: parseFloat(awayExpectedGoals.toFixed(2)),
homeForm: homeFormSummary,
awayForm: awayFormSummary
};

try {
await supabase.from(‘picks’).insert([{
user_id: ‘web_user’,
user_input: `${home} vs ${away}`,
analysis: JSON.stringify({
home, away, league, market: finalMarket, odds,
confidence, edge, stake, bullets,
date: new Date().toISOString()
}),
created_at: new Date().toISOString()
}]);
} catch {}

return result;
}

// ── ROUTES ──────────────────────────────────────────────────────────────────

app.get(’/aura-api/health’, (req, res) => res.json({ status: ‘ok’ }));

app.get(’/aura-api/fixtures/today’, async (req, res) => {
try {
const today = getDateStr(0);
const tomorrow = getDateStr(1);
let { data: dbMatches } = await supabase
.from(‘matches’)
.select(‘id, team1, team2, league, date, round’)
.is(‘ft_home’, null)
.gte(‘date’, today)
.lte(‘date’, tomorrow)
.order(‘date’, { ascending: true })
.order(‘league’, { ascending: true })
.limit(50);

```
if (!dbMatches || dbMatches.length === 0) {
  const { data: upcoming } = await supabase
    .from('matches')
    .select('id, team1, team2, league, date, round')
    .is('ft_home', null)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(30);
  dbMatches = upcoming || [];
}

const [fdFixtures, allOdds] = await Promise.all([fetchFDFixtures(), getAllOdds()]);
const timeLookup = buildTimeLookup(fdFixtures);
const matches = (dbMatches || []).map(m => {
  const timeKey = `${normalizeName(m.team1)}_${normalizeName(m.team2)}_${m.date}`;
  const time = timeLookup[timeKey] || '20:00';
  const odds = findOddsForMatch(allOdds, m.team1, m.team2);
  return { id: `db_${m.id}`, home: m.team1, away: m.team2, league: m.league || 'Unknown', date: m.date, time, ...odds };
});
res.json({ matches, date: matches[0]?.date || today });
```

} catch (err) {
console.error(‘Today fixtures error:’, err);
res.status(500).json({ error: err.message });
}
});

app.get(’/aura-api/fixtures’, async (req, res) => {
try {
const today = getDateStr(0);
const { data: dbMatches, error: dbErr } = await supabase
.from(‘matches’)
.select(‘id, team1, team2, league, date, round’)
.is(‘ft_home’, null)
.gte(‘date’, today)
.order(‘date’, { ascending: true })
.limit(1000);
if (dbErr) throw dbErr;

```
const [fdFixtures, apfFixtures, allOdds] = await Promise.all([
  fetchFDFixtures(),
  fetchAPIFootballFixtures(),
  getAllOdds()
]);

const timeLookup = buildTimeLookup([...fdFixtures, ...apfFixtures]);
const seen = new Set();
const combined = [];

for (const m of dbMatches || []) {
  const key = `${m.date}_${normalizeName(m.team1)}_${normalizeName(m.team2)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const timeKey = `${normalizeName(m.team1)}_${normalizeName(m.team2)}_${m.date}`;
  const time = timeLookup[timeKey] || '20:00';
  const odds = findOddsForMatch(allOdds, m.team1, m.team2);
  combined.push({ id: `db_${m.id}`, home: m.team1, away: m.team2, league: m.league || 'Unknown', date: m.date, time, ...odds });
}

for (const m of fdFixtures) {
  if (!m.fd_home || !m.date || new Date(m.date) < new Date(today)) continue;
  const key = `${m.date}_${normalizeName(m.fd_home)}_${normalizeName(m.fd_away)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const odds = findOddsForMatch(allOdds, m.fd_home, m.fd_away);
  combined.push({ id: `fd_${normalizeName(m.fd_home)}_${normalizeName(m.fd_away)}_${m.date}`, home: m.fd_home, away: m.fd_away, league: m.league, date: m.date, time: m.time || '20:00', ...odds });
}

for (const m of apfFixtures) {
  if (!m.home || !m.date || new Date(m.date) < new Date(today)) continue;
  const key = `${m.date}_${normalizeName(m.home)}_${normalizeName(m.away)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const odds = findOddsForMatch(allOdds, m.home, m.away);
  combined.push({ id: `apf_${normalizeName(m.home)}_${normalizeName(m.away)}_${m.date}`, home: m.home, away: m.away, league: m.league, date: m.date, time: m.time || '20:00', homeLogo: m.homeLogo, awayLogo: m.awayLogo, ...odds });
}

combined.sort((a, b) => a.date.localeCompare(b.date));
const byDate = {};
for (const m of combined) {
  if (!byDate[m.date]) byDate[m.date] = [];
  byDate[m.date].push(m);
}
res.json({ by_date: byDate });
```

} catch (err) {
console.error(‘Fixtures error:’, err);
res.status(500).json({ error: err.message });
}
});

app.post(’/aura-api/predict’, async (req, res) => {
try {
const { home, away, league, date, home_odds, draw_odds, away_odds } = req.body;
if (!home || !away) return res.status(400).json({ error: ‘home and away required’ });
const result = await predictMatch({ home, away, league, date, home_odds, draw_odds, away_odds });
res.json(result);
} catch (err) {
console.error(‘Predict error:’, err);
res.status(500).json({ error: err.message });
}
});

app.post(’/aura-api/accumulator’, async (req, res) => {
try {
const { matches } = req.body;
if (!matches?.length) return res.status(400).json({ error: ‘matches required’ });
const picks = await Promise.all(matches.map(m => predictMatch(m)));
const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
const prompt = `Accumulator analysis for ${picks.length} legs:\n${picks.map(p => `${p.home} vs ${p.away}: ${p.market} @ ${p.odds} (confidence ${p.confidence}%)`).join('\n')}\nCombined odds: ${combinedOdds.toFixed(2)}\nAnalyse this accumulator value in 3 bullet points. Start each with "•". No markdown.`;
const aiText = await callAI(prompt);
const bullets = (aiText || ‘• Accumulator has multiple legs increasing risk\n• Combined odds provide potential value\n• Stake responsibly’)
.split(’\n’).map(l => l.trim()).filter(l => l.startsWith(’•’)).slice(0, 3);
res.json({ picks, combined_odds: parseFloat(combinedOdds.toFixed(2)), bullets });
} catch (err) {
console.error(‘Accumulator error:’, err);
res.status(500).json({ error: err.message });
}
});

app.get(’/aura-api/bets-to-avoid’, async (req, res) => {
try {
const today = getDateStr(0);
const tomorrow = getDateStr(1);
const { data: fixtures } = await supabase
.from(‘matches’)
.select(‘id, team1, team2, league, date’)
.is(‘ft_home’, null)
.gte(‘date’, today)
.lte(‘date’, tomorrow)
.limit(60);
if (!fixtures?.length) return res.json({ fixtures: [] });
const allOdds = await getAllOdds();
const dangerous = [];
for (const m of fixtures) {
const h2h = await getH2H(m.team1, m.team2);
const stats = calcH2HStats(h2h, m.team1);
const odds = findOddsForMatch(allOdds, m.team1, m.team2);
let danger = 0;
const reasons = [];
if (h2h.length < 3) { danger += 25; reasons.push(‘Less than 3 H2H meetings — prediction unreliable’); }
if (Math.abs(stats.homeWinProb - stats.awayWinProb) < 0.10) { danger += 20; reasons.push(‘Coin flip match — no clear statistical edge’); }
if (stats.drawProb > 0.40) { danger += 15; reasons.push(`High draw probability (${(stats.drawProb * 100).toFixed(0)}%) — volatile outcome`); }
if (isKnownDerby(m.team1, m.team2)) { danger += 20; reasons.push(‘Derby match — form becomes unpredictable’); }
if (odds.home_odds && odds.draw_odds && odds.away_odds) {
const spread = Math.max(odds.home_odds, odds.draw_odds, odds.away_odds) - Math.min(odds.home_odds, odds.draw_odds, odds.away_odds);
if (spread < 0.5) { danger += 20; reasons.push(‘Bookmaker odds too tight — no value edge available’); }
}
if (danger >= 35) dangerous.push({ id: `db_${m.id}`, home: m.team1, away: m.team2, league: m.league, date: m.date, danger, reasons, …odds });
}
dangerous.sort((a, b) => b.danger - a.danger);
res.json({ fixtures: dangerous.slice(0, 10) });
} catch (err) {
console.error(‘Bets to avoid error:’, err);
res.status(500).json({ error: err.message });
}
});

app.get(’/aura-api/picks/today’, async (req, res) => {
try {
const today = new Date().toISOString().split(‘T’)[0];
const { data, error } = await supabase
.from(‘picks’).select(’*’)
.gte(‘created_at’, `${today}T00:00:00`)
.order(‘created_at’, { ascending: false });
if (error) throw error;
const picks = (data || []).map(p => {
try { return { …p, parsed: JSON.parse(p.analysis) }; } catch { return p; }
});
res.json({ picks });
} catch (err) { res.status(500).json({ error: err.message }); }
});

app.get(’/aura-api/picks/all’, async (req, res) => {
try {
const { data, error } = await supabase
.from(‘picks’).select(’*’)
.order(‘created_at’, { ascending: false })
.limit(500);
if (error) throw error;
const picks = (data || []).map(p => {
try {
const parsed = JSON.parse(p.analysis);
return { …p, …parsed };
} catch { return p; }
});
res.json({ picks });
} catch (err) { res.status(500).json({ error: err.message }); }
});

app.get(’/aura-api/team-logos’, (req, res) => {
res.json(teamLogosCache);
});

const distPath = path.join(__dirname, ‘../dist/public’);
if (fs.existsSync(distPath)) {
app.use(express.static(distPath));
app.get(/^(?!/aura-api).*/, (req, res) => {
res.sendFile(path.join(distPath, ‘index.html’));
});
}

app.listen(PORT, ‘0.0.0.0’, () => console.log(`AuraOdds API running on port ${PORT}`));
