import { db } from './firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Get all matches
export async function getMatches(phase = null) {
  const ref = collection(db, 'matches');
  const q = phase ? query(ref, where('phase', '==', phase)) : ref;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add a match
export async function addMatch(matchData) {
  return addDoc(collection(db, 'matches'), {
    ...matchData,
    createdAt: serverTimestamp()
  });
}

// Update match (score, status, schedule)
export async function updateMatch(matchId, data) {
  return updateDoc(doc(db, 'matches', matchId), data);
}

// Verify join code — returns match if valid and live
export async function verifyJoinCode(code) {
  const q = query(collection(db, 'matches'), where('joinCode', '==', code), where('status', '==', 'live'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Count live matches
export async function getLiveMatchCount() {
  const q = query(collection(db, 'matches'), where('status', '==', 'live'));
  const snap = await getDocs(q);
  return snap.size;
}

// Submit team/manager setup for a match. side must be 'home' or 'away' —
// firestore.rules only allows public writes to these specific fields.
export async function submitTeamSetup(matchId, side, setupText) {
  if (side !== 'home' && side !== 'away') throw new Error('Invalid side.');
  await updateDoc(doc(db, 'matches', matchId), {
    [`${side}TeamSetup`]: setupText.trim(),
    [`${side}TeamSetupAt`]: serverTimestamp()
  });
}

// Submit a player's report of the final score (both home and away goals,
// as that player saw them). When both players' reports agree, the match
// auto-completes. When they disagree, scoreMismatch is flagged for admin.
// Returns 'waiting' | 'matched' | 'mismatch'.
export async function submitPlayerScore(matchId, side, homeGoals, awayGoals) {
  if (side !== 'home' && side !== 'away') throw new Error('Invalid side.');
  const ref = doc(db, 'matches', matchId);
  const prefix = side === 'home' ? 'homeReport' : 'awayReport';
  await updateDoc(ref, {
    [`${prefix}H`]: homeGoals,
    [`${prefix}A`]: awayGoals,
    [`${prefix}At`]: serverTimestamp()
  });

  const snap = await getDoc(ref);
  const m = snap.data();
  if (m.homeReportH == null || m.awayReportH == null) return 'waiting';
  if (m.homeReportH === m.awayReportH && m.homeReportA === m.awayReportA) {
    const winner = m.homeReportH > m.homeReportA ? 'home' : m.homeReportH < m.homeReportA ? 'away' : 'draw';
    await updateDoc(ref, { homeScore: m.homeReportH, awayScore: m.homeReportA, status: 'completed', winner });
    return 'matched';
  }
  await updateDoc(ref, { scoreMismatch: true });
  return 'mismatch';
}
