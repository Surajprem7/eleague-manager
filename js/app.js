import { db } from './firebase.js';
import { verifyJoinCode } from './matches.js';
import {
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Register a player
export async function registerPlayer({ name, efootballId, phone }) {
  const existingId = await getDocs(query(collection(db, 'players'), where('efootballId', '==', efootballId)));
  if (!existingId.empty) throw new Error('This eFootball ID is already registered.');

  // Name uniqueness is checked case-insensitively client-side since the app
  // looks players up by exact name elsewhere (My Matches, Join, team setup) —
  // two players with the same display name would otherwise collide.
  const allPlayers = await getDocs(collection(db, 'players'));
  const normalized = name.trim().toLowerCase();
  const nameTaken = allPlayers.docs.some(d => (d.data().name || '').trim().toLowerCase() === normalized);
  if (nameTaken) throw new Error('This name is already taken. Please use a different name (e.g. add your last name or a number).');

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
