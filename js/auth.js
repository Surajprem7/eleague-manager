import { auth, db } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Cache admin list to avoid repeated DB reads
let adminCache = null;
let adminCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

// Check if an email is in the admins collection
async function isAdminEmail(email) {
  const now = Date.now();
  if (adminCache && (now - adminCacheTime) < CACHE_TTL) {
    return adminCache.includes(email);
  }
  try {
    const snap = await getDocs(collection(db, 'admins'));
    adminCache = snap.docs.map(d => d.data().email);
    adminCacheTime = now;
    return adminCache.includes(email);
  } catch(e) {
    console.error('Admin check failed', e);
    return false;
  }
}

// Google login
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch(e) {
    console.error('Login failed', e);
    return null;
  }
}

// Logout
export function logout() {
  adminCache = null;
  return signOut(auth);
}

// Auth state listener — calls callback with user if admin, null if not
export function onAdminAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { callback(null); return; }
    const isAdmin = await isAdminEmail(user.email);
    callback(isAdmin ? user : null);
  });
}

// ── Admin management functions ──

// Get all admins
export async function getAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add a new admin by email
export async function addAdmin(email) {
  email = email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Enter a valid email address.');
  // Check if already exists
  const existing = await getDocs(query(collection(db, 'admins'), where('email', '==', email)));
  if (!existing.empty) throw new Error('This email is already an admin.');
  const id = email.replace(/[^a-z0-9]/g, '_');
  await setDoc(doc(db, 'admins', id), { email, addedAt: new Date().toISOString() });
  adminCache = null; // Clear cache
}

// Remove an admin by email
export async function removeAdmin(email, currentUserEmail) {
  if (email === currentUserEmail) throw new Error("You can't remove yourself as admin.");
  const snap = await getDocs(query(collection(db, 'admins'), where('email', '==', email)));
  if (snap.empty) throw new Error('Admin not found.');
  await deleteDoc(doc(db, 'admins', snap.docs[0].id));
  adminCache = null; // Clear cache
}
