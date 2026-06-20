import { db } from './firebase.js';
import {
  collection, doc, getDocs, setDoc, updateDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Compute standings for a group
export function computeStandings(players, matches) {
  const table = {};
  players.forEach(p => {
    table[p.id] = { id: p.id, name: p.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  });

  matches.filter(m => m.status === 'completed').forEach(m => {
    const h = table[m.homeId], a = table[m.awayId];
    if (!h || !a) return;
    h.p++; a.p++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.w++; h.pts += 3; a.l++; }
    else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
    h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
  });

  return Object.values(table).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  );
}

// Generate round-robin matches for a group
export function generateGroupMatches(group, players) {
  const matches = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const code = `GRP-${group}-M${matches.length + 1}`;
      matches.push({
        phase: 'group',
        group,
        homeId: players[i].id,
        awayId: players[j].id,
        homeName: players[i].name,
        awayName: players[j].name,
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        joinCode: code,
        scheduledAt: null,
        winner: null
      });
    }
  }
  return matches;
}

// Get qualifiers from group stage (top N per group)
export function getQualifiers(groupStandings, qualify = 2) {
  const advancers = [];
  Object.entries(groupStandings).forEach(([group, rows]) => {
    rows.slice(0, qualify).forEach((r, rank) => {
      advancers.push({ ...r, group, rank });
    });
  });
  return advancers;
}

// Generate knockout round matches from a list of players
export function generateKnockoutRound(players, round) {
  const matches = [];
  for (let i = 0; i < players.length; i += 2) {
    const h = players[i], a = players[i + 1];
    if (!a) continue;
    const code = `${round.toUpperCase().replace(/\s/g, '')}-M${i / 2 + 1}`;
    matches.push({
      phase: round,
      homeId: h.id,
      awayId: a.id,
      homeName: h.name,
      awayName: a.name,
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
      joinCode: code,
      scheduledAt: null,
      winner: null
    });
  }
  return matches;
}
