import { db } from './firebase.js';
import {
  collection, query, where, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Active listeners — store unsubscribe functions so we can clean up
const listeners = {};

function unsub(key) {
  if (listeners[key]) { listeners[key](); delete listeners[key]; }
}

// Listen to live matches — fires instantly when any match goes live or updates
export function onLiveMatches(callback) {
  unsub('live');
  const q = query(collection(db, 'matches'), where('status', '==', 'live'));
  listeners['live'] = onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error('Live matches listener error', err));
}

// Listen to all group matches — fires when any score is saved
export function onGroupMatches(callback) {
  unsub('group');
  const q = query(collection(db, 'matches'), where('phase', '==', 'group'));
  listeners['group'] = onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error('Group matches listener error', err));
}

// Listen to tournament status — fires when phase changes or winner set
export function onTournamentStatus(callback) {
  unsub('tournament');
  listeners['tournament'] = onSnapshot(collection(db, 'tournament'), snap => {
    if (snap.empty) { callback(null); return; }
    callback({ id: snap.docs[0].id, ...snap.docs[0].data() });
  }, err => console.error('Tournament listener error', err));
}

// Listen to all players
export function onPlayers(callback) {
  unsub('players');
  listeners['players'] = onSnapshot(collection(db, 'players'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error('Players listener error', err));
}

// Listen to groups
export function onGroups(callback) {
  unsub('groups');
  listeners['groups'] = onSnapshot(collection(db, 'groups'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error('Groups listener error', err));
}

// Listen to knockout matches
export function onKnockoutMatches(callback) {
  unsub('knockout');
  const phases = ['r32','r16','qf','sf','3rd','final'];
  const q = query(collection(db, 'matches'), where('phase', 'in', phases));
  listeners['knockout'] = onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error('Knockout listener error', err));
}

// Listen to player matches by player ID
export function onPlayerMatches(playerId, callback) {
  unsub('playerHome');
  unsub('playerAway');
  let homeMatches = [], awayMatches = [];

  listeners['playerHome'] = onSnapshot(
    query(collection(db, 'matches'), where('homeId', '==', playerId)),
    snap => { homeMatches = snap.docs.map(d => ({ id: d.id, ...d.data() })); callback([...homeMatches, ...awayMatches]); }
  );
  listeners['playerAway'] = onSnapshot(
    query(collection(db, 'matches'), where('awayId', '==', playerId)),
    snap => { awayMatches = snap.docs.map(d => ({ id: d.id, ...d.data() })); callback([...homeMatches, ...awayMatches]); }
  );
}

// Clean up all listeners (call when navigating away)
export function cleanupAll() {
  Object.keys(listeners).forEach(unsub);
}
