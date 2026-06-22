import { db, messagingReady } from './firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const VAPID_KEY = 'BKDqmNDA9g-PyvL-KGL3p-dVBNGM0RHWRMJo7EYPzmeHefrdCKooFS8t-R82B2j0aJPNmo87B7HbK7Ir4WZrByI';

// Request notification permission and save the device's push token on the
// player's own document. Safe to call repeatedly — no-ops if unsupported,
// denied, or already enabled. Returns true if a token was saved.
export async function enableMatchNotifications(playerId) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

  const messaging = await messagingReady;
  if (!messaging) return false;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    if (!token) return false;

    await updateDoc(doc(db, 'players', playerId), {
      fcmToken: token,
      fcmTokenAt: new Date().toISOString()
    });
    return true;
  } catch (e) {
    console.error('Enable notifications failed', e);
    return false;
  }
}
