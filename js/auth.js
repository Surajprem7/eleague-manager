import { auth, db } from './firebase.js';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const DEFAULT_ADMIN_EMAIL = 'surajtxglive@gmail.com';
const MAX_ADMINS = 3;

function adminDocId(email) {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Check if an email is in the admins collection
async function isAdminEmail(email) {
  try {
    const snap = await getDoc(doc(db, 'admins', adminDocId(email)));
    return snap.exists();
  } catch(e) {
    console.error('Admin check failed', e);
    return false;
  }
}

// Google login — uses redirect (works in PWA, WebView, and all browsers).
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithRedirect(auth, provider);
  } catch(e) {
    console.error('Login failed', e);
    throw new Error('Sign-in failed. Please try again.');
  }
}

// Call once on page load to complete a pending redirect sign-in.
export async function handleLoginRedirect() {
  try {
    await getRedirectResult(auth);
  } catch(e) {
    console.error('Redirect result error', e);
  }
}

// Logout
export function logout() {
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

// Get all admins. Non-default admins can't see the default admin in the list.
export async function getAdmins(currentUserEmail) {
  const isDefault = currentUserEmail?.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL;
  const snap = isDefault
    ? await getDocs(collection(db, 'admins'))
    : await getDocs(query(collection(db, 'admins'), where('isDefault', '==', false)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add a new admin by email — only the default admin can do this
export async function addAdmin(email, currentUserEmail) {
  if (currentUserEmail?.trim().toLowerCase() !== DEFAULT_ADMIN_EMAIL) {
    throw new Error('Only the default admin can add admins.');
  }
  email = email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Enter a valid email address.');
  if (email === DEFAULT_ADMIN_EMAIL) throw new Error('This email is already the default admin.');
  const id = adminDocId(email);
  const existing = await getDoc(doc(db, 'admins', id));
  if (existing.exists()) throw new Error('This email is already an admin.');
  const all = await getDocs(collection(db, 'admins'));
  if (all.size >= MAX_ADMINS) throw new Error(`Maximum of ${MAX_ADMINS} admins reached.`);
  await setDoc(doc(db, 'admins', id), { email, addedAt: new Date().toISOString(), isDefault: false });
}

// Remove an admin by email — only the default admin can do this, and the default
// admin itself can never be removed (enforced here and in firestore.rules).
export async function removeAdmin(email, currentUserEmail) {
  if (currentUserEmail?.trim().toLowerCase() !== DEFAULT_ADMIN_EMAIL) {
    throw new Error('Only the default admin can remove admins.');
  }
  email = email.trim().toLowerCase();
  if (email === DEFAULT_ADMIN_EMAIL) throw new Error("The default admin can't be removed.");
  const id = adminDocId(email);
  const snap = await getDoc(doc(db, 'admins', id));
  if (!snap.exists()) throw new Error('Admin not found.');
  await deleteDoc(doc(db, 'admins', id));
}
