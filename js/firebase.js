import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9RxSRTauZy08bdTJpvCYHFafjWT8HoUY",
  authDomain: "eleague-manager.firebaseapp.com",
  projectId: "eleague-manager",
  storageBucket: "eleague-manager.firebasestorage.app",
  messagingSenderId: "474066590801",
  appId: "1:474066590801:web:25d29be98362b64c212c70"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
