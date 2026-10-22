/**
 * Centralized public configuration for Exam Cracker.
 * All NEXT_PUBLIC_* values are browser-visible by design.
 * Never add Firebase Admin JSON or Cloudflare API tokens here.
 */

/**
 * Explicit references are required here: Next.js only inlines NEXT_PUBLIC_*
 * values into browser bundles when each variable is accessed statically as
 * process.env.NEXT_PUBLIC_NAME. Looking up process.env[name] dynamically leaves
 * the browser value undefined and caused Firebase auth/invalid-api-key after
 * hydration, even when GitHub Actions had supplied the correct build values.
 */
const PUBLIC_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL: process.env.NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL,
  NEXT_PUBLIC_ADMIN_EMAIL: process.env.NEXT_PUBLIC_ADMIN_EMAIL,
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
};

/**
 * Local preview defaults mirror the public Firebase web configuration already
 * used by the repository's production build workflow. These are public browser
 * config values, not Admin credentials or API tokens. They are only enabled by
 * `npm run dev`; production still requires an explicit deployment config.
 *
 * Explicit, non-placeholder environment variables always take precedence.
 */
const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';
const DEVELOPMENT_PUBLIC_DEFAULTS: Record<string, string> = IS_LOCAL_DEV
  ? {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyA1fiEviIdG5_yi7AcyxC3m9sec-AdkOfU',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'darvo1.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'darvo1',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'darvo1.firebasestorage.app',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '283467136948',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:283467136948:web:c66fd594827909eb3f7ce1',
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-FMV79YMHBC',
      NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL: 'https://ec-content-api.arvinddara0290.workers.dev',
    }
  : {};

function isExamplePlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('replace-with-') ||
    normalized.startsWith('your-') ||
    normalized.startsWith('your_') ||
    /^https?:\/\/your[-_.]/i.test(normalized)
  );
}

function env(name: string, fallback: string): string {
  const configured = PUBLIC_ENV[name]?.trim();
  // .env.example is intentionally safe to copy, but its placeholder values
  // must not be passed to Firebase during a local preview.
  if (configured && !isExamplePlaceholder(configured)) return configured;

  const developmentFallback = IS_LOCAL_DEV ? DEVELOPMENT_PUBLIC_DEFAULTS[name] : undefined;
  return (fallback || developmentFallback || '').trim();
}

function envRequired(name: string, fallback: string): string {
  const v = env(name, fallback);
  if (!v) {
    // In browser we warn, but keep a blank value so a production deployment
    // cannot silently point to another Firebase project.
    if (typeof window !== 'undefined') {
      console.warn(`[ExamCracker] Missing required environment variable ${name}. Check .env.local or deployment settings.`);
    }
  }
  return v;
}

export const APP_CONFIG = {
  appId: 'com.darvo.ec' as const,
  appName: 'Exam Cracker' as const,
  firebase: {
    apiKey: envRequired('NEXT_PUBLIC_FIREBASE_API_KEY', ''),
    authDomain: envRequired('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', ''),
    projectId: envRequired('NEXT_PUBLIC_FIREBASE_PROJECT_ID', ''),
    storageBucket: envRequired('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', ''),
    messagingSenderId: envRequired('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', ''),
    appId: envRequired('NEXT_PUBLIC_FIREBASE_APP_ID', ''),
    measurementId: env('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', ''),
    vapidKey: env('NEXT_PUBLIC_FIREBASE_VAPID_KEY', ''),
  },
  apiBaseUrl: '/api/ec',
  cloudflare: {
    mediaProxyUrl: envRequired('NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL', '').replace(/\/+$/, ''),
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
  if (!APP_CONFIG.cloudflare.mediaProxyUrl) missing.push('NEXT_PUBLIC_CLOUDFLARE_MEDIA_PROXY_URL');
  return { ok: missing.length === 0, missing };
}
