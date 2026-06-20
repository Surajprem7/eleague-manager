import { db } from './firebase.js';
import { generateGroupMatches, generateKnockoutRound, getQualifiers, computeStandings } from './tournament.js';
import { addMatch, updateMatch, getLiveMatchCount } from './matches.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, setDoc,
  query, where, serverTimestamp, writeBatch, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Get all players
export async function getAllPlayers() {
  const snap = await getDocs(collection(db, 'players'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Approve / reject player
export async function updatePlayerStatus(playerId, status) {
  return updateDoc(doc(db, 'players', playerId), { status });
}

// Assign player to group
export async function assignGroup(playerId, group) {
  return updateDoc(doc(db, 'players', playerId), { group });
}

// Save groups and generate group stage matches
export async function saveGroupsAndGenerateMatches(groups) {
  const batch = writeBatch(db);

  for (const [letter, players] of Object.entries(groups)) {
    const groupRef = doc(collection(db, 'groups'));
    batch.set(groupRef, { letter, players: players.map(p => p.id) });

    const matches = generateGroupMatches(letter, players);
    for (const m of matches) {
      batch.set(doc(collection(db, 'matches')), { ...m, createdAt: serverTimestamp() });
    }

    for (const p of players) {
      batch.update(doc(db, 'players', p.id), { group: letter, status: 'approved' });
    }
  }

  await batch.commit();
  await setDoc(doc(db, 'tournament', 'main'), {
    phase: 'group', winner: null, second: null, third: null, createdAt: serverTimestamp()
  });
}

// Schedule a match (set date/time)
export async function scheduleMatch(matchId, scheduledAt) {
  return updateMatch(matchId, { scheduledAt });
}

// Set match live (max 2 at a time)
export async function setMatchLive(matchId) {
  const live = await getLiveMatchCount();
  if (live >= 2) throw new Error('Max 2 matches can be live at the same time.');
  return updateMatch(matchId, { status: 'live' });
}

// Enter score and complete match
export async function enterScore(matchId, homeScore, awayScore) {
  const winner = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
  return updateMatch(matchId, { homeScore, awayScore, status: 'completed', winner });
}

// Check if all group matches done → generate knockout
export async function checkAndGenerateKnockout() {
  const matchesSnap = await getDocs(query(collection(db, 'matches'), where('phase', '==', 'group')));
  const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allDone = matches.every(m => m.status === 'completed');
  if (!allDone) return false;

  // Build standings per group
  const playersSnap = await getDocs(query(collection(db, 'players'), where('status', '==', 'approved')));
  const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const groups = {};
  players.forEach(p => {
    if (!p.group) return;
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  const standings = {};
  for (const [letter, gPlayers] of Object.entries(groups)) {
    const gMatches = matches.filter(m => m.group === letter);
    standings[letter] = computeStandings(gPlayers, gMatches);
  }

  const qualifiers = getQualifiers(standings, 2);
  // Pair: A1 vs B2, B1 vs A2 etc. (World Cup style)
  const seeds = qualifiers.filter(q => q.rank === 0);
  const runners = qualifiers.filter(q => q.rank === 1);

  const pairs = [];
  seeds.forEach((s, i) => {
    const opp = runners.find(r => r.group !== s.group) || runners[i];
    if (opp && !pairs.flat().find(p => p.id === opp.id)) pairs.push([s, opp]);
  });

  const roundName = pairs.length * 2 <= 2 ? 'final' : pairs.length * 2 <= 4 ? 'sf' : pairs.length * 2 <= 8 ? 'qf' : pairs.length * 2 <= 16 ? 'r16' : 'r32';
  const knockoutMatches = generateKnockoutRound(pairs.flat(), roundName);
  const batch = writeBatch(db);
  knockoutMatches.forEach(m => {
    batch.set(doc(collection(db, 'matches')), { ...m, createdAt: serverTimestamp() });
  });
  batch.update(doc(db, 'tournament', 'main'), { phase: 'knockout' });
  await batch.commit();
  return true;
}

// Advance knockout round
export async function advanceKnockout(completedRound) {
  const snap = await getDocs(query(collection(db, 'matches'), where('phase', '==', completedRound)));
  const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allDone = matches.every(m => m.status === 'completed');
  if (!allDone) return false;

  const winners = matches.map(m => ({
    id: m.winner === 'home' ? m.homeId : m.awayId,
    name: m.winner === 'home' ? m.homeName : m.awayName
  }));

  if (winners.length === 1) {
    // Tournament done
    const losers = matches.map(m => ({
      id: m.winner === 'home' ? m.awayId : m.homeId,
      name: m.winner === 'home' ? m.awayName : m.homeName
    }));
    await updateDoc(doc(db, 'tournament', 'main'), {
      phase: 'done',
      winner: winners[0].name,
      second: losers[0].name
    });
    return 'done';
  }

  const rounds = { r32: 'r16', r16: 'qf', qf: 'sf', sf: 'final' };
  const nextRound = rounds[completedRound];
  if (!nextRound) return false;

  const nextMatches = generateKnockoutRound(winners, nextRound);

  // 3rd place playoff from SF losers
  if (completedRound === 'sf') {
    const losers = matches.map(m => ({
      id: m.winner === 'home' ? m.awayId : m.homeId,
      name: m.winner === 'home' ? m.awayName : m.homeName
    }));
    const thirdPlace = generateKnockoutRound(losers, '3rd');
    nextMatches.push(...thirdPlace);
  }

  const batch = writeBatch(db);
  nextMatches.forEach(m => {
    batch.set(doc(collection(db, 'matches')), { ...m, createdAt: serverTimestamp() });
  });
  await batch.commit();
  return nextRound;
}
