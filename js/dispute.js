import { db } from './firebase.js';
import { addLog, LOG } from './activitylog.js';
import {
  collection, addDoc, getDoc, getDocs, doc, updateDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Player raises a dispute
export async function raiseDispute({ matchId, playerName, reason }) {
  // Check match exists and is completed
  const matchSnap = await getDoc(doc(db, 'matches', matchId));
  if (!matchSnap.exists()) throw new Error('Match not found.');
  if (matchSnap.data().status !== 'completed') throw new Error('Only completed matches can be disputed.');

  // Check not already disputed
  const existing = await getDocs(
    query(collection(db, 'disputes'), where('matchId', '==', matchId), where('status', '==', 'open'))
  );
  if (!existing.empty) {
    throw new Error('A dispute is already open for this match.');
  }

  const ref = await addDoc(collection(db, 'disputes'), {
    matchId,
    playerName,
    reason,
    status: 'open',
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resolution: null
  });

  await addLog(LOG.DISPUTE_RAISED, `${playerName} disputed a match result`, { matchId, reason });
  return ref;
}

// Get all open disputes
export async function getDisputes(status = null) {
  let q = status
    ? query(collection(db, 'disputes'), where('status', '==', status), orderBy('createdAt', 'desc'))
    : query(collection(db, 'disputes'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Admin resolves a dispute
export async function resolveDispute(disputeId, resolution, adminName = 'Admin') {
  await updateDoc(doc(db, 'disputes', disputeId), {
    status: 'resolved',
    resolution,
    resolvedAt: serverTimestamp()
  });
  await addLog(LOG.DISPUTE_SOLVED, `${adminName} resolved a dispute`, { disputeId, resolution });
}
