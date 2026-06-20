import { db } from './firebase.js';
import { verifyJoinCode } from './matches.js';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Register a player
export async function registerPlayer({ name, efootballId, phone }) {
  const existing = await getDocs(query(collection(db, 'players'), where('efootballId', '==', efootballId)));
  if (!existing.empty) throw new Error('This eFootball ID is already registered.');
  return addDoc(collection(db, 'players'), {
    name, efootballId, phone: phone || '',
    status: 'pending', group: null,
    registeredAt: serverTimestamp()
  });
}

// Get all approved players
export async function getApprovedPlayers() {
  const snap = await getDocs(query(collection(db, 'players'), where('status', '==', 'approved')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get tournament status
export async function getTournamentStatus() {
  const snap = await getDocs(collection(db, 'tournament'));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Get matches for a player
export async function getPlayerMatches(playerId) {
  const [homeSnap, awaySnap] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('homeId', '==', playerId))),
    getDocs(query(collection(db, 'matches'), where('awayId', '==', playerId)))
  ]);
  const home = homeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const away = awaySnap.docs.map(d => ({ id: d.id, ...d.data() }));
  return [...home, ...away].sort((a, b) => (a.scheduledAt?.seconds || 0) - (b.scheduledAt?.seconds || 0));
}

// Join a match with code
export async function joinMatch(code, playerName) {
  const match = await verifyJoinCode(code);
  if (!match) return { success: false, message: 'Invalid or expired join code.' };
  const isPlayer = match.homeName === playerName || match.awayName === playerName;
  if (!isPlayer) return { success: false, message: 'You are not in this match.' };
  return { success: true, match };
}
