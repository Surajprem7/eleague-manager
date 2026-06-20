import { db } from './firebase.js';
import {
  collection, addDoc, getDocs, query,
  orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Log types
export const LOG = {
  SCORE_SAVED:    'score_saved',
  MATCH_LIVE:     'match_live',
  MATCH_SCHEDULE: 'match_scheduled',
  PLAYER_APPROVE: 'player_approved',
  PLAYER_REJECT:  'player_rejected',
  GROUP_SAVED:    'groups_saved',
  KNOCKOUT_GEN:   'knockout_generated',
  DISPUTE_RAISED: 'dispute_raised',
  DISPUTE_SOLVED: 'dispute_solved',
  WINNER_SET:     'winner_set'
};

// Icons for each log type
export const LOG_ICON = {
  score_saved:        '⚽',
  match_live:         '🔴',
  match_scheduled:    '📅',
  player_approved:    '✅',
  player_rejected:    '❌',
  groups_saved:       '🎲',
  knockout_generated: '🏆',
  dispute_raised:     '⚠️',
  dispute_solved:     '✔️',
  winner_set:         '🥇'
};

// Add a log entry
export async function addLog(type, message, details = {}) {
  try {
    await addDoc(collection(db, 'activity_log'), {
      type,
      message,
      details,
      createdAt: serverTimestamp()
    });
  } catch(e) {
    console.error('Log write failed:', e);
  }
}

// Get recent logs
export async function getLogs(count = 50) {
  const snap = await getDocs(
    query(collection(db, 'activity_log'), orderBy('createdAt', 'desc'), limit(count))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
