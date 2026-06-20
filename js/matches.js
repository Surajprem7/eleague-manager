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
