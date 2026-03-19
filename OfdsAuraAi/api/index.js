import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============ SUPABASE ============
const SUPABASE_URL = 'https://ttxvmugwypsubqsoipgw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0eHZtdWd3eXBzdWJxc29pcGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDc0NDAsImV4cCI6MjA4OTIyMzQ0MH0.cs3w_DUJoquGsCtw46SIgMihaskChYanAHckotd3zYs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============ API KEYS ============
const ODDS_API_KEY = '64e71893965e747368209ff71adc7541';
const FOOTBALL_DATA_KEY = '044df779995148f59d6ee9b4fd54b37c';
const GEMINI_KEY1 = 'AIzaSyByeN1kq_Fd0IEghKwOD280_ktX6oi-_0Q';
const GEMINI_KEY2 = 'AIzaSyCjK0tOh2UOJu8FJrrAaATPlaf7tIR5VHw';
const GROQ_KEY = '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';

const COMPETITIONS = [2021, 2014, 2002, 2019, 2015, 2001, 2018, 2017, 2003, 2013];
const LEAGUE_NAMES = {
  2021: 'Premier League', 2014: 'La Liga', 2002: 'Bundesliga',
  2019: 'Serie A', 2015: 'Ligue 1', 2001: 'Champions League',
  2018: 'Europa League', 2017: 'Championship', 2003: 'Eredivisie', 2013: 'Brasileirão'
};
const SPORT_KEYS = [
  'soccer_england_premier_league', 'soccer_spain_la_liga', 'soccer_germany_bundesliga',
  'soccer_italy_serie_a', 'soccer_france_ligue_one', 'soccer_uefa_champs_league',
  'soccer_england_league1', 'soccer_netherlands_eredivisie'
];

const DERBY_PAIRS = [
  ['arsenal', 'tottenham'], ['chelsea', 'arsenal'], ['liverpool', 'everton'],
  ['manchester united', 'manchester city'], ['real madrid', 'atletico'],
  ['barcelona', 'real madrid'], ['ac milan', 'inter'], ['juventus', 'torino'],
  ['boca', 'river'], ['celtic', 'rangers'], ['galatasaray', 'fenerbahce']
];

// In-memory odds cache
let oddsCache = { data: [], ts: 0 };

// ============ HELPERS ============

function getDateStr(daysFromNow = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function normalizeName(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function isKnownDerby(home, away) {
  const h = home.toLowerCase();
  const a = away.toLowerCase();
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

async function callAI(prompt) {
  const gemini = await callGemini(prompt);
  if (gemini) return gemini;
  return await callGroq(prompt);
}

async function getAllOdds() {
  if (Date.now() - oddsCache.ts < 20 * 60 * 1000 && oddsCache.data.length > 0) {
    return oddsCache.data;
  }
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
  const h0 = home.toLowerCase().split(' ')[0];
  const a0 = away.toLowerCase().split(' ')[0];
  const match = allOdds.find(o => {
    const oh = (o.home_team || '').toLowerCase();
    const oa = (o.away_team || '').toLowerCase();
    return oh.includes(h0) && oa.includes(a0);
  });
  if (!match?.bookmakers?.[0]?.markets?.[0]?.outcomes) return {};
  const outcomes = match.bookmakers[0].markets[0].outcomes;
  const result = {};
  for (const o of outcomes) {
    const n = o.name.toLowerCase();
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
          { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.matches || [])
          .filter(m => ['TIMED', 'SCHEDULED'].includes(m.status))
          .map(m => ({
            fd_home: m.homeTeam.name,
            fd_away: m.awayTeam.name,
            date: m.utcDate.split('T')[0],
            time: m.utcDate.split('T')[1].substring(0, 5),
            league: LEAGUE_NAMES[id] || m.competition?.name || 'Unknown'
          }));
      } catch { return []; }
    })
  );
  return results.flat();
}

// Build a time lookup map from FD data: "home_away_date" -> time
function buildTimeLookup(fdFixtures) {
  const map = {};
  for (const m of fdFixtures) {
    const k = `${normalizeName(m.fd_home)}_${normalizeName(m.fd_away)}_${m.date}`;
    map[k] = m.time;
  }
  return map;
}

// ============ PREDICTION ENGINE ============

async function getH2H(home, away) {
  const firstHome = home.toLowerCase().split(' ')[0];
  const firstAway = away.toLowerCase().split(' ')[0];
  const { data } = await supabase
    .from('matches')
    .select('*')
    .or(`and(team1.ilike.%${firstHome}%,team2.ilike.%${firstAway}%),and(team1.ilike.%${firstAway}%,team2.ilike.%${firstHome}%)`)
    .not('ft_home', 'is', null)
    .order('date', { ascending: false })
    .limit(20);
  return data || [];
}

async function getTeamForm(team) {
  const first = team.toLowerCase().split(' ')[0];
  const { data } = await supabase
    .from('matches')
    .select('*')
    .or(`team1.ilike.%${first}%,team2.ilike.%${first}%`)
    .not('ft_home', 'is', null)
    .order('date', { ascending: false })
    .limit(10);
  return data || [];
}

function calcH2HStats(h2h, home, away) {
  const firstHome = home.toLowerCase().split(' ')[0];
  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0;

  for (const m of h2h) {
    const isHomeInTeam1 = (m.team1 || '').toLowerCase().includes(firstHome);
    const fh = parseInt(m.ft_home) || 0;
    const fa = parseInt(m.ft_away) || 0;
    totalGoals += fh + fa;
    if (fh > fa) { isHomeInTeam1 ? homeWins++ : awayWins++; }
    else if (fa > fh) { isHomeInTeam1 ? awayWins++ : homeWins++; }
    else draws++;
  }

  const total = Math.max(h2h.length, 1);
  return {
    homeWins, awayWins, draws,
    totalMatches: h2h.length,
    homeWinProb: homeWins / total,
    awayWinProb: awayWins / total,
    drawProb: draws / total,
    avgGoals: totalGoals / total
  };
}

function calcFormSummary(form, teamName) {
  const first = teamName.toLowerCase().split(' ')[0];
  const results = form.slice(0, 5).map(m => {
    const isTeam1 = (m.team1 || '').toLowerCase().includes(first);
    const fh = parseInt(m.ft_home) || 0;
    const fa = parseInt(m.ft_away) || 0;
    if (isTeam1) return fh > fa ? 'W' : fh < fa ? 'L' : 'D';
    return fa > fh ? 'W' : fa < fh ? 'L' : 'D';
  });
  return results.join(' ') || 'No data';
}

function calcGoalsForm(form, teamName) {
  const first = teamName.toLowerCase().split(' ')[0];
  const last5 = form.slice(0, 5);
  if (!last5.length) return 0;
  const goals = last5.map(m => {
    const isTeam1 = (m.team1 || '').toLowerCase().includes(first);
    return isTeam1 ? (parseInt(m.ft_home) || 0) : (parseInt(m.ft_away) || 0);
  });
  return goals.reduce((s, g) => s + g, 0) / last5.length;
}

function pickMarketFromStats(stats) {
  const { homeWinProb, awayWinProb, drawProb, avgGoals } = stats;
  const rand = Math.random();

  if (homeWinProb > 0.55) {
    const options = ['Home Win', 'Asian Handicap Home -0.5', '1UP Home Win', '2UP Home Win', 'Double Chance 1X'];
    return options[Math.floor(rand * options.length)];
  }
  if (awayWinProb > 0.50) {
    const options = ['Away Win', 'Asian Handicap Away +0.5', '1UP Away Win', '2UP Away Win', 'Double Chance X2'];
    return options[Math.floor(rand * options.length)];
  }
  if (drawProb > 0.35) {
    const options = ['Draw', 'Double Chance 1X', 'Double Chance X2', 'BTTS Yes'];
    return options[Math.floor(rand * options.length)];
  }
  if (avgGoals > 2.8) return rand > 0.5 ? 'Over 2.5 Goals' : 'BTTS Yes';
  if (avgGoals < 2.0) return rand > 0.5 ? 'Under 2.5 Goals' : 'BTTS No';

  const all = ['Home Win', 'Away Win', 'Draw', 'Double Chance 1X', 'Double Chance X2',
    'Double Chance 12', 'Over 2.5 Goals', 'Under 2.5 Goals', 'Over 1.5 Goals',
    'BTTS Yes', 'BTTS No', 'Asian Handicap Home -0.5', 'Asian Handicap Away +0.5',
    '1UP Home Win', '1UP Away Win', '2UP Home Win', '2UP Away Win'];
  return all[Math.floor(rand * all.length)];
}

function getOddsForMarket(market, home_odds, draw_odds, away_odds) {
  if (market.includes('Away') || market === 'Double Chance X2') return away_odds || 2.2;
  if (market === 'Draw' || market === 'Double Chance 12') return draw_odds || 3.2;
  if (market.includes('Over') || market === 'BTTS Yes') return 1.85;
  if (market.includes('Under') || market === 'BTTS No') return 1.75;
  if (market.includes('Double Chance 1X')) return home_odds ? home_odds * 0.75 : 1.45;
  return home_odds || 1.90;
}

function getProbForMarket(market, stats) {
  const { homeWinProb, awayWinProb, drawProb } = stats;
  if (market.includes('Away')) return awayWinProb + 0.05;
  if (market === 'Draw') return drawProb + 0.05;
  if (market === 'Double Chance 1X') return homeWinProb + drawProb;
  if (market === 'Double Chance X2') return awayWinProb + drawProb;
  if (market === 'Double Chance 12') return homeWinProb + awayWinProb;
  return homeWinProb + 0.05;
}

async function checkExistingPick(home, away) {
  const today = new Date().toISOString().split('T')[0];
  const input = `${home} vs ${away}`;
  const { data } = await supabase
    .from('picks')
    .select('*')
    .eq('user_input', input)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
    .limit(1);
  if (data?.length > 0) {
    try {
      const parsed = JSON.parse(data[0].analysis);
      return parsed;
    } catch { return null; }
  }
  return null;
}

async function predictMatch({ home, away, league, date, home_odds, draw_odds, away_odds }) {
  // Check for existing prediction today
  const existing = await checkExistingPick(home, away);
  if (existing && existing.market) return existing;

  const [h2h, homeForm, awayForm] = await Promise.all([
    getH2H(home, away),
    getTeamForm(home),
    getTeamForm(away)
  ]);

  const stats = calcH2HStats(h2h, home, away);
  const { homeWins, awayWins, draws, totalMatches, homeWinProb, awayWinProb, drawProb, avgGoals } = stats;

  const homeFormSummary = calcFormSummary(homeForm, home);
  const awayFormSummary = calcFormSummary(awayForm, away);
  const homeGoalsForm = calcGoalsForm(homeForm, home);
  const awayGoalsForm = calcGoalsForm(awayForm, away);

  const market = pickMarketFromStats(stats);
  const odds = getOddsForMarket(market, home_odds, draw_odds, away_odds);
  const ourProb = getProbForMarket(market, stats);

  const impliedProb = 1 / odds;
  const edge = parseFloat(((ourProb - impliedProb) * 100).toFixed(1));
  const b = odds - 1;
  const q = 1 - ourProb;
  const kelly = Math.max(0, Math.min(5, ((b * ourProb - q) / b) * 100));
  const stake = parseFloat(kelly.toFixed(1));
  const confidence = Math.min(92, Math.max(45, Math.round(ourProb * 100 + 8)));

  const limitedH2H = totalMatches === 0;
  const h2hNote = limitedH2H ? 'Limited H2H data' : `${totalMatches} meetings`;

  const prompt = `You are AuraAI, a football prediction analyst.
Analyse this match using the provided statistics.

Match: ${home} vs ${away}
League: ${league || 'Unknown'}
Market: ${market}
Odds: ${odds}

H2H Statistics (${h2hNote}):
- ${home} wins: ${homeWins} (${(homeWinProb * 100).toFixed(0)}%)
- ${away} wins: ${awayWins} (${(awayWinProb * 100).toFixed(0)}%)
- Draws: ${draws} (${(drawProb * 100).toFixed(0)}%)
- Average goals per game: ${avgGoals.toFixed(1)}

${home} recent form (last 5): ${homeFormSummary} | avg goals: ${homeGoalsForm.toFixed(1)}
${away} recent form (last 5): ${awayFormSummary} | avg goals: ${awayGoalsForm.toFixed(1)}

Write exactly 3 bullet points explaining why ${market} is the right pick.
Each bullet point must be one line only.
Use the actual statistics above — do not make up data.
${limitedH2H ? 'Note: Limited H2H data, base analysis on form and odds.' : ''}
Do not use markdown. Just plain bullet points starting with •`;

  const aiText = await callAI(prompt);
  const bullets = (aiText || '• Prediction based on statistical analysis\n• Form data supports this market selection\n• Manage your bankroll carefully')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('•'))
    .slice(0, 3);

  const result = {
    home, away, league, date,
    market, odds: parseFloat(odds.toFixed(2)),
    confidence, edge, stake,
    home_odds, draw_odds, away_odds,
    bullets,
    h2hMatches: totalMatches,
    homeWinProb: parseFloat(homeWinProb.toFixed(3)),
    awayWinProb: parseFloat(awayWinProb.toFixed(3)),
    drawProb: parseFloat(drawProb.toFixed(3)),
    avgGoals: parseFloat(avgGoals.toFixed(2)),
    homeForm: homeFormSummary,
    awayForm: awayFormSummary
  };

  try {
    await supabase.from('picks').insert([{
      user_id: 'web_user',
      user_input: `${home} vs ${away}`,
      analysis: JSON.stringify(result),
      created_at: new Date().toISOString()
    }]);
  } catch {}

  return result;
}

// ============ ROUTES ============

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// TODAY'S FIXTURES — primary source: Supabase matches table
app.get('/api/fixtures/today', async (req, res) => {
  try {
    const today = getDateStr(0);
    const tomorrow = getDateStr(1);

    // Primary: query Supabase matches table
    let { data: dbMatches } = await supabase
      .from('matches')
      .select('id, team1, team2, league, date, round')
      .is('ft_home', null)
      .eq('date', today)
      .order('league', { ascending: true })
      .limit(100);

    // If no matches today, try tomorrow
    if (!dbMatches || dbMatches.length === 0) {
      const { data: tomorrowMatches } = await supabase
        .from('matches')
        .select('id, team1, team2, league, date, round')
        .is('ft_home', null)
        .eq('date', tomorrow)
        .order('league', { ascending: true })
        .limit(100);
      dbMatches = tomorrowMatches || [];
    }

    // Fetch FD fixtures for kickoff times and Odds in parallel
    const [fdFixtures, allOdds] = await Promise.all([
      fetchFDFixtures(),
      getAllOdds()
    ]);
    const timeLookup = buildTimeLookup(fdFixtures);

    const matches = dbMatches.map(m => {
      const timeKey = `${normalizeName(m.team1)}_${normalizeName(m.team2)}_${m.date}`;
      const time = timeLookup[timeKey] || '20:00';
      const odds = findOddsForMatch(allOdds, m.team1, m.team2);
      return {
        id: `db_${m.id}`,
        home: m.team1, away: m.team2,
        league: m.league || 'Unknown',
        date: m.date, time,
        ...odds
      };
    });

    res.json({ matches, date: matches[0]?.date || today });
  } catch (err) {
    console.error('Today fixtures error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ALL FIXTURES — primary source: Supabase LIMIT 1000, enriched with FD times + Odds
app.get('/api/fixtures', async (req, res) => {
  try {
    const today = getDateStr(0);

    // Primary: Supabase matches table
    const { data: dbMatches, error: dbErr } = await supabase
      .from('matches')
      .select('id, team1, team2, league, date, round')
      .is('ft_home', null)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1000);

    if (dbErr) throw dbErr;

    // Enrich with FD times and Odds in parallel
    const [fdFixtures, allOdds] = await Promise.all([
      fetchFDFixtures(),
      getAllOdds()
    ]);
    const timeLookup = buildTimeLookup(fdFixtures);

    // Build combined list (Supabase is authoritative, FD fills in times)
    const seen = new Set();
    const combined = [];

    for (const m of dbMatches || []) {
      const key = `${m.date}_${normalizeName(m.team1)}_${normalizeName(m.team2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const timeKey = `${normalizeName(m.team1)}_${normalizeName(m.team2)}_${m.date}`;
      const time = timeLookup[timeKey] || '20:00';
      const odds = findOddsForMatch(allOdds, m.team1, m.team2);
      combined.push({
        id: `db_${m.id}`,
        home: m.team1, away: m.team2,
        league: m.league || 'Unknown',
        date: m.date, time,
        ...odds
      });
    }

    // Also add FD-only fixtures not in DB
    for (const m of fdFixtures) {
      if (!m.date || new Date(m.date) < new Date(today)) continue;
      const key = `${m.date}_${normalizeName(m.fd_home)}_${normalizeName(m.fd_away)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const odds = findOddsForMatch(allOdds, m.fd_home, m.fd_away);
      combined.push({
        id: `fd_${normalizeName(m.fd_home)}_${normalizeName(m.fd_away)}_${m.date}`,
        home: m.fd_home, away: m.fd_away,
        league: m.league, date: m.date, time: m.time || '20:00',
        ...odds
      });
    }

    combined.sort((a, b) => a.date.localeCompare(b.date));

    const byDate = {};
    for (const m of combined) {
      if (!byDate[m.date]) byDate[m.date] = [];
      byDate[m.date].push(m);
    }

    res.json({ by_date: byDate });
  } catch (err) {
    console.error('Fixtures error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PREDICT — complete engine with H2H stats + AI
app.post('/api/predict', async (req, res) => {
  try {
    const { home, away, league, date, home_odds, draw_odds, away_odds } = req.body;
    if (!home || !away) return res.status(400).json({ error: 'home and away required' });
    const result = await predictMatch({ home, away, league, date, home_odds, draw_odds, away_odds });
    res.json(result);
  } catch (err) {
    console.error('Predict error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ACCUMULATOR
app.post('/api/accumulator', async (req, res) => {
  try {
    const { matches } = req.body;
    if (!matches?.length) return res.status(400).json({ error: 'matches required' });

    const picks = await Promise.all(matches.map(m => predictMatch(m)));
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);

    const prompt = `Accumulator analysis for ${picks.length} legs:
${picks.map(p => `${p.home} vs ${p.away}: ${p.market} @ ${p.odds} (confidence ${p.confidence}%)`).join('\n')}
Combined odds: ${combinedOdds.toFixed(2)}
Analyse this accumulator's value in exactly 3 bullet points. Start each with "•".`;

    const aiText = await callAI(prompt);
    const bullets = (aiText || '• Accumulator has multiple legs increasing risk\n• Combined odds provide potential value\n• Stake responsibly')
      .split('\n').map(l => l.trim()).filter(l => l.startsWith('•')).slice(0, 3);

    res.json({ picks, combined_odds: parseFloat(combinedOdds.toFixed(2)), bullets });
  } catch (err) {
    console.error('Accumulator error:', err);
    res.status(500).json({ error: err.message });
  }
});

// BETS TO AVOID
app.get('/api/bets-to-avoid', async (req, res) => {
  try {
    const today = getDateStr(0);
    const tomorrow = getDateStr(1);

    const { data: fixtures } = await supabase
      .from('matches')
      .select('id, team1, team2, league, date')
      .is('ft_home', null)
      .gte('date', today)
      .lte('date', tomorrow)
      .limit(60);

    if (!fixtures?.length) return res.json({ fixtures: [] });

    const allOdds = await getAllOdds();
    const dangerous = [];

    for (const m of fixtures) {
      const [h2h] = await Promise.all([getH2H(m.team1, m.team2)]);
      const stats = calcH2HStats(h2h, m.team1, m.team2);
      const odds = findOddsForMatch(allOdds, m.team1, m.team2);

      let danger = 0;
      const reasons = [];

      if (h2h.length < 3) {
        danger += 25;
        reasons.push('Less than 3 H2H meetings — prediction unreliable');
      }
      if (Math.abs(stats.homeWinProb - stats.awayWinProb) < 0.10) {
        danger += 20;
        reasons.push('Coin flip match — no clear statistical edge');
      }
      if (stats.drawProb > 0.40) {
        danger += 15;
        reasons.push(`High draw probability (${(stats.drawProb * 100).toFixed(0)}%) — volatile outcome`);
      }
      if (isKnownDerby(m.team1, m.team2)) {
        danger += 20;
        reasons.push('Derby match — form becomes unpredictable');
      }
      if (odds.home_odds && odds.draw_odds && odds.away_odds) {
        const spread = Math.max(odds.home_odds, odds.draw_odds, odds.away_odds) -
          Math.min(odds.home_odds, odds.draw_odds, odds.away_odds);
        if (spread < 0.5) {
          danger += 20;
          reasons.push('Bookmaker odds too tight — no value edge available');
        }
      }

      if (danger >= 40) {
        dangerous.push({
          id: `db_${m.id}`,
          home: m.team1, away: m.team2,
          league: m.league, date: m.date,
          danger, reasons,
          ...odds
        });
      }
    }

    dangerous.sort((a, b) => b.danger - a.danger);
    res.json({ fixtures: dangerous.slice(0, 8) });
  } catch (err) {
    console.error('Bets to avoid error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PICKS
app.get('/api/picks/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('picks').select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const picks = (data || []).map(p => {
      try { return { ...p, parsed: JSON.parse(p.analysis) }; } catch { return p; }
    });
    res.json({ picks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/picks/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('picks').select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    const picks = (data || []).map(p => {
      try { return { ...p, parsed: JSON.parse(p.analysis) }; } catch { return p; }
    });
    res.json({ picks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SERVE REACT BUILD
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ message: 'AuraOdds API running. Build frontend with npm run build.' }));
}

app.listen(PORT, '0.0.0.0', () => console.log(`AuraOdds API running on port ${PORT}`));
