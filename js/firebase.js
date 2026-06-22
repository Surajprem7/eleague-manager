import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getMessaging, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD8MBfHSwlrk642rs6FWZWeknWc5V5Z4Uc",
  authDomain: "eleague-manager.firebaseapp.com",
  projectId: "eleague-manager",
  storageBucket: "eleague-manager.firebasestorage.app",
  messagingSenderId: "474066590801",
  appId: "1:474066590801:web:25d29be98362b64c212c70"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Messaging isn't supported everywhere (e.g. iOS Safari outside installed
// PWA mode, some browsers without push API) — resolve lazily and guard callers.
export const messagingReady = isSupported().then(ok => ok ? getMessaging(app) : null);
