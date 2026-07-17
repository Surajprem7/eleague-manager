const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError }                   = require('firebase-functions/v2/https');
const { initializeApp }                        = require('firebase-admin/app');
const { getFirestore }                         = require('firebase-admin/firestore');
const { getMessaging }                         = require('firebase-admin/messaging');

initializeApp();

const db  = getFirestore();
const fcm = getMessaging();

// ── helpers ──────────────────────────────────────────────────────────────────

async function tokenFor(playerId) {
  if (!playerId) return null;
  const snap = await db.doc(`players/${playerId}`).get();
  return snap.exists ? (snap.data().fcmToken || null) : null;
}

async function sendToTokens(tokens, title, body) {
  const validTokens = tokens.filter(Boolean);
  if (!validTokens.length) return;

  const messages = validTokens.map(token => ({
    token,
    notification: { title, body },
    webpush: {
      notification: {
        icon: 'https://league.getgol.in/assets/icon-192.png',
        badge: 'https://league.getgol.in/assets/icon-192.png'
      },
      fcmOptions: { link: 'https://league.getgol.in/' }
    }
  }));

  const result = await fcm.sendEach(messages);
  console.log(`Sent ${result.successCount}/${messages.length} notifications`);
  return result;
}

// ── trigger: match goes LIVE ──────────────────────────────────────────────────
exports.onMatchLive = onDocumentWritten('matches/{matchId}', async (event) => {
  const before = event.data.before?.data();
  const after  = event.data.after?.data();

  if (!after || before?.status === after.status) return; // no status change
  if (after.status !== 'live') return;                   // only care about 'live'

  const [homeToken, awayToken] = await Promise.all([
    tokenFor(after.homeId),
    tokenFor(after.awayId)
  ]);

  const home = (after.homeName || 'Home').toUpperCase();
  const away = (after.awayName || 'Away').toUpperCase();

  await sendToTokens(
    [homeToken, awayToken],
    '⚽ Your match is LIVE!',
    `${home} vs ${away} — play now!`
  );
});

// ── trigger: score confirmed (match completed) ────────────────────────────────
exports.onScoreConfirmed = onDocumentWritten('matches/{matchId}', async (event) => {
  const before = event.data.before?.data();
  const after  = event.data.after?.data();

  if (!after || before?.status === after.status) return;
  if (after.status !== 'completed') return;

  const [homeToken, awayToken] = await Promise.all([
    tokenFor(after.homeId),
    tokenFor(after.awayId)
  ]);

  const home  = (after.homeName || 'Home').toUpperCase();
  const away  = (after.awayName || 'Away').toUpperCase();
  const score = `${after.homeScore ?? '?'} – ${after.awayScore ?? '?'}`;

  await sendToTokens(
    [homeToken, awayToken],
    '🏁 Result confirmed',
    `${home} ${score} ${away}`
  );
});

// ── trigger: admin announcement ───────────────────────────────────────────────
exports.onAnnouncement = onDocumentCreated('announcements/{id}', async (event) => {
  const data = event.data?.data();
  if (!data?.message) return;

  // Fetch all player FCM tokens
  const playersSnap = await db.collection('players').get();
  const tokens = playersSnap.docs
    .map(d => d.data().fcmToken)
    .filter(Boolean);

  if (!tokens.length) return;

  // FCM sendEach limit is 500 per call — batch if needed
  const BATCH = 500;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const messages = batch.map(token => ({
      token,
      notification: {
        title: data.title || '📢 eLeague Update',
        body:  data.message
      },
      webpush: {
        notification: {
          icon: 'https://league.getgol.in/assets/icon-192.png',
          badge: 'https://league.getgol.in/assets/icon-192.png'
        },
        fcmOptions: { link: 'https://league.getgol.in/' }
      }
    }));
    const result = await fcm.sendEach(messages);
    console.log(`Announcement batch ${i}: ${result.successCount}/${batch.length} sent`);
  }
});

// ── callable: admin sends manual push to specific players ─────────────────────
// Called from admin.html with { playerIds?, message, title }
// If playerIds is empty/missing → sends to ALL players (broadcast).
exports.sendPush = onCall({ enforceAppCheck: false }, async (request) => {
  // Simple admin guard — check caller uid against /admins collection
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const adminDoc = await db.doc(`admins/${uid}`).get();
  if (!adminDoc.exists) throw new HttpsError('permission-denied', 'Admins only');

  const { playerIds = [], title = '📢 eLeague', message } = request.data;
  if (!message) throw new HttpsError('invalid-argument', 'message required');

  let tokens;
  if (playerIds.length) {
    const results = await Promise.all(playerIds.map(id => tokenFor(id)));
    tokens = results.filter(Boolean);
  } else {
    const snap = await db.collection('players').get();
    tokens = snap.docs.map(d => d.data().fcmToken).filter(Boolean);
  }

  if (!tokens.length) return { sent: 0, message: 'No registered devices' };

  const BATCH = 500;
  let successCount = 0;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH).map(token => ({
      token,
      notification: { title, body: message },
      webpush: {
        notification: {
          icon: 'https://league.getgol.in/assets/icon-192.png',
          badge: 'https://league.getgol.in/assets/icon-192.png'
        },
        fcmOptions: { link: 'https://league.getgol.in/' }
      }
    }));
    const result = await fcm.sendEach(batch);
    successCount += result.successCount;
  }

  return { sent: successCount, total: tokens.length };
});
