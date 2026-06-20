import { db } from './firebase.js';
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Get full stats for a player
export async function getPlayerStats(playerId) {
  const [matchSnap, playerSnap] = await Promise.all([
    getDocs(collection(db, 'matches')),
    getDocs(query(collection(db, 'players'), where('__name__', '==', playerId)))
  ]);

  const allMatches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const player = playerSnap.empty ? null : { id: playerSnap.docs[0].id, ...playerSnap.docs[0].data() };

  const myMatches = allMatches.filter(m =>
    (m.homeId === playerId || m.awayId === playerId) && m.status === 'completed'
  );

  let w=0, d=0, l=0, gf=0, ga=0;
  const history = [];

  myMatches.forEach(m => {
    const isHome = m.homeId === playerId;
    const myScore  = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    const oppName  = isHome ? m.awayName  : m.homeName;

    gf += myScore; ga += oppScore;
    let result = 'D';
    if (myScore > oppScore) { w++; result = 'W'; }
    else if (myScore < oppScore) { l++; result = 'L'; }
    else d++;

    const phaseLabel = {
      group:'Group', r32:'R32', r16:'R16',
      qf:'QF', sf:'SF', '3rd':'3rd Place', final:'Final'
    }[m.phase] || m.phase;

    history.push({
      opponent: oppName,
      myScore, oppScore, result,
      phase: phaseLabel,
      group: m.group || null,
      scheduledAt: m.scheduledAt
    });
  });

  // Sort by date
  history.sort((a,b) => (a.scheduledAt?.seconds||0) - (b.scheduledAt?.seconds||0));

  // Knockout round reached
  const koPhases = ['r32','r16','qf','sf','3rd','final'];
  const koLabels = { r32:'Round of 32', r16:'Round of 16', qf:'Quarter-final', sf:'Semi-final', '3rd':'3rd Place', final:'Final' };
  let knockoutReached = null;
  koPhases.forEach(phase => {
    if (allMatches.some(m => (m.homeId===playerId||m.awayId===playerId) && m.phase===phase)) {
      knockoutReached = koLabels[phase];
    }
  });

  return {
    player,
    played: myMatches.length,
    w, d, l,
    gf, ga,
    gd: gf - ga,
    winRate: myMatches.length ? Math.round((w / myMatches.length) * 100) : 0,
    history,
    knockoutReached
  };
}

// Get top scorers across all matches
export async function getTopScorers() {
  const [matchSnap, playerSnap] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('status', '==', 'completed'))),
    getDocs(collection(db, 'players'))
  ]);

  const players = {};
  playerSnap.docs.forEach(d => {
    players[d.id] = { name: d.data().name, goals: 0, played: 0, wins: 0 };
  });

  matchSnap.docs.forEach(d => {
    const m = d.data();
    if (players[m.homeId]) {
      players[m.homeId].goals  += m.homeScore || 0;
      players[m.homeId].played += 1;
      if (m.homeScore > m.awayScore) players[m.homeId].wins++;
    }
    if (players[m.awayId]) {
      players[m.awayId].goals  += m.awayScore || 0;
      players[m.awayId].played += 1;
      if (m.awayScore > m.homeScore) players[m.awayId].wins++;
    }
  });

  return Object.entries(players)
    .map(([id, s]) => ({ id, ...s }))
    .filter(p => p.played > 0)
    .sort((a,b) => b.goals - a.goals || b.wins - a.wins);
}
