/**
 * Centralized public configuration for Exam Cracker.
 * All NEXT_PUBLIC_* values are browser-visible by design.
 * Never add Supabase service-role, Firebase Admin JSON or Cloudflare API tokens here.
 */

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return (v !== undefined && v !== '' ? v : fallback).trim();
}

function envRequired(name: string, fallback: string): string {
  const v = env(name, fallback);
  if (!v) {
    // In browser we warn but return fallback so app can render setup message
    if (typeof window !== 'undefined') {
      console.warn(`[ExamCracker] Missing env ${name}, using fallback. Check .env.local`);
    }
  }
  return v;
}

export const APP_CONFIG = {
  appId: 'com.darvo.ec' as const,
  appName: 'Exam Cracker' as const,
  firebase: {
    apiKey: envRequired('NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaSyDuvN6q4ybHc6rLTHlYdhSs5_rzvc8nhTA'),
    authDomain: envRequired('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'darvo1.firebaseapp.com'),
    projectId: envRequired('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'darvo1'),
    storageBucket: envRequired('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'darvo1.firebasestorage.app'),
    messagingSenderId: envRequired('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '283467136948'),
    appId: envRequired('NEXT_PUBLIC_FIREBASE_APP_ID', '1:283467136948:web:c66fd594827909eb3f7ce1'),
    measurementId: env('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', 'G-FMV79YMHBC'),
    vapidKey: env('NEXT_PUBLIC_FIREBASE_VAPID_KEY', ''),
  },
  supabase: {
    url: envRequired('NEXT_PUBLIC_SUPABASE_URL', 'https://kncbvcozpcrfvxdbkbtf.supabase.co').replace(/\/+$/, ''),
    publishableKey: envRequired('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_-4si2gp96FDx7ziHHMO7Kg_sasmLYB2'),
    functionUrl: envRequired('NEXT_PUBLIC_SUPABASE_FUNCTION_URL', 'https://kncbvcozpcrfvxdbkbtf.supabase.co/functions/v1/exam-cracker-api').replace(/\/+$/, ''),
    siteFunctionUrl: env('NEXT_PUBLIC_SUPABASE_SITE_FUNCTION_URL', 'https://kncbvcozpcrfvxdbkbtf.supabase.co/functions/v1/ec-site-api').replace(/\/+$/, ''),
  },
  cloudflare: {
    mediaProxyUrl: envRequired('NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL', 'https://ec-content-api.arvinddara0290.workers.dev').replace(/\/+$/, ''),
  },
  adminEmail: env('NEXT_PUBLIC_ADMIN_EMAIL', 'arvinddarabishnoi@gmail.com').trim().toLowerCase(),
  auth: {
    // The login designer can hide Google, but never enable a provider that the
    // Firebase project does not support. Set NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
    // if Google sign-in is disabled in the Firebase console.
    googleEnabled: env('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED', 'true').toLowerCase() !== 'false',
  },
} as const;

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === APP_CONFIG.adminEmail;
}

export function validatePublicConfig(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!APP_CONFIG.firebase.apiKey) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!APP_CONFIG.firebase.authDomain) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!APP_CONFIG.firebase.projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!APP_CONFIG.supabase.url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!APP_CONFIG.supabase.publishableKey) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!APP_CONFIG.supabase.functionUrl) missing.push('NEXT_PUBLIC_SUPABASE_FUNCTION_URL');
  if (!APP_CONFIG.cloudflare.mediaProxyUrl) missing.push('NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL');
  return { ok: missing.length === 0, missing };
}
