'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { APP_CONFIG } from './config';

// Guard to ensure Firebase only initializes on client
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be initialized in the browser');
  }
  if (app) return app;
  app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: APP_CONFIG.firebase.apiKey,
        authDomain: APP_CONFIG.firebase.authDomain,
        projectId: APP_CONFIG.firebase.projectId,
        storageBucket: APP_CONFIG.firebase.storageBucket,
        messagingSenderId: APP_CONFIG.firebase.messagingSenderId,
        appId: APP_CONFIG.firebase.appId,
        measurementId: APP_CONFIG.firebase.measurementId || undefined,
      });
  return app;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const a = getAuth(getFirebaseApp());
  authInstance = a;
  // Persist session across reloads (client only)
  setPersistence(a, browserLocalPersistence).catch(() => {});
  return a;
}


// Lazy getters for backward compat
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : (null as unknown as Auth);
// Legacy compatibility export. Use the browser-only helpers in ./firestore instead.
export const db = null as unknown as import('firebase/firestore').Firestore;

export function getAuthSafe(): Auth {
  return getFirebaseAuth();
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let redirectErrorCallback: ((message: string) => void) | null = null;
let pendingRedirectError: string | null = null;

// Handle redirect result when available (client-only)
if (typeof window !== 'undefined') {
  try {
    const authForRedirect = getFirebaseAuth();
    getRedirectResult(authForRedirect).catch((err) => {
      const friendly = formatFirebaseAuthError(err);
      if (redirectErrorCallback) redirectErrorCallback(friendly);
      else pendingRedirectError = friendly;
    });
  } catch {}
}

export function onRedirectAuthError(cb: (message: string) => void): () => void {
  redirectErrorCallback = cb;
  if (pendingRedirectError) {
    cb(pendingRedirectError);
    pendingRedirectError = null;
  }
  return () => {
    if (redirectErrorCallback === cb) redirectErrorCallback = null;
  };
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const a = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(a, email.trim(), password);
  return cred.user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const a = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(a, email.trim(), password);
  if (displayName && displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
    await cred.user.getIdToken(true);
  }
  return cred.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const a = getFirebaseAuth();
  await sendPasswordResetEmail(a, email.trim());
}

export async function signInWithGoogle(options?: {
  forceRedirect?: boolean;
  idToken?: string;
}): Promise<User | null> {
  const a = getFirebaseAuth();
  if (options?.idToken) {
    const credential = GoogleAuthProvider.credential(options.idToken);
    const result = await signInWithCredential(a, credential);
    return result.user;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (options?.forceRedirect || isMobile) {
    await signInWithRedirect(a, googleProvider);
    return null;
  }

  try {
    const result = await signInWithPopup(a, googleProvider);
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/popup-closed-by-user'
    ) {
      try {
        await signInWithRedirect(a, googleProvider);
        return null;
      } catch {}
    }
    throw err;
  }
}

export async function updateFirebaseUserProfile(updates: {
  displayName?: string;
  photoURL?: string | null;
}): Promise<void> {
  const a = getFirebaseAuth();
  const user = a.currentUser;
  if (!user) throw new Error('Not signed in.');
  await updateProfile(user, {
    displayName: updates.displayName ?? user.displayName,
    photoURL: updates.photoURL !== undefined ? updates.photoURL || '' : user.photoURL,
  });
  await user.getIdToken(true);
}

export async function getFreshIdToken(forceRefresh = false): Promise<string> {
  const a = getFirebaseAuth();
  const user = a.currentUser;
  if (!user) {
    throw new Error('Unauthorized: Please sign in to continue.');
  }
  return user.getIdToken(forceRefresh);
}

export async function signOutUser(): Promise<void> {
  const a = getFirebaseAuth();
  await firebaseSignOut(a);
}

export { onAuthStateChanged, type User };

export function formatFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const rawMessage = (error as { message?: string })?.message || 'Authentication failed.';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment or reset your password.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing sign-in.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open.';
    case 'auth/unauthorized-domain':
      return `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'unknown'}) is not yet added to Firebase Authorized Domains in project "darvo1". Add it under Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is not yet enabled in Firebase Console (project darvo1 → Authentication → Sign-in method).';
    case 'auth/network-request-failed':
      return 'Network error while reaching Firebase Authentication. Check your internet connection and try again.';
    default:
      return rawMessage.replace(/^Firebase:\s*/i, '');
  }
}
