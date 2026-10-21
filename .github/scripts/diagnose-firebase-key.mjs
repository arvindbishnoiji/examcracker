import { readFile } from 'node:fs/promises';

const legacyKey = 'AIzaSyDuvN6q4ybHc6rLTHlYdhSs5_rzvc8nhTA';
const report = [];

function addCandidate(label, key) {
  if (!key || !key.trim()) return;
  const normalized = key.trim();
  if (!report.some((item) => item.key === normalized)) {
    report.push({ label, key: normalized });
  }
}

addCandidate('previously configured web key', legacyKey);
addCandidate('GitHub Actions configured key', process.env.CONFIGURED_FIREBASE_API_KEY || '');

try {
  const googleServices = JSON.parse(await readFile('google-services.json', 'utf8'));
  addCandidate('google-services.json Android key', googleServices?.client?.[0]?.api_key?.[0]?.current_key || '');
} catch (error) {
  console.log('Could not read google-services.json:', error instanceof Error ? error.message : String(error));
}

async function probe(candidate, origin) {
  try {
    const url = new URL('https://identitytoolkit.googleapis.com/v1/accounts:lookup');
    url.searchParams.set('key', candidate.key);
    // Deliberately invalid token: this validates API-key acceptance without
    // creating an account, sending an email or changing any Firebase data.
    // Sending the real browser origin is necessary to detect HTTP-referrer
    // restrictions that a server-side request without Referer would miss.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        referer: origin + '/login',
      },
      body: JSON.stringify({ idToken: 'diagnostic-invalid-token' }),
    });
    const payload = await response.json().catch(() => ({}));
    const code = String(payload?.error?.message || (response.ok ? 'OK' : 'UNKNOWN_ERROR'));
    const blockedCodes = [
      'API_KEY_INVALID',
      'API_KEY_SERVICE_BLOCKED',
      'API_KEY_HTTP_REFERRER_BLOCKED',
      'API_KEY_IP_ADDRESS_BLOCKED',
      'API_KEY_ANDROID_APP_BLOCKED',
      'API_KEY_IOS_APP_BLOCKED',
      'SERVICE_DISABLED',
      'PERMISSION_DENIED',
    ];
    const status = blockedCodes.some((item) => code.includes(item))
      ? 'NOT_USABLE_FOR_THIS_BROWSER_ORIGIN'
      : code.includes('INVALID_ID_TOKEN') || code.includes('MISSING_ID_TOKEN') || response.ok
      ? 'KEY_ACCEPTED_FOR_THIS_ORIGIN'
      : 'INCONCLUSIVE';
    return { label: candidate.label, origin, httpStatus: response.status, responseCode: code, status };
  } catch (error) {
    return {
      label: candidate.label,
      origin,
      status: 'NETWORK_ERROR',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

try {
  for (const host of ['darvo1.firebaseapp.com', 'darvo1.web.app']) {
    for (const path of ['/__/firebase/init.json', '/__/firebase/init.js']) {
      try {
        const response = await fetch('https://' + host + path, { redirect: 'follow' });
        const body = await response.text();
        const match = body.match(/AIza[\w-]{20,}/);
        if (response.ok && match) addCandidate(host + path + ' config key', match[0]);
        else console.log(`Firebase Hosting config probe: ${host}${path} HTTP ${response.status}; key-found=${Boolean(match)}`);
      } catch (error) {
        console.log(`Firebase Hosting config probe: ${host}${path} network-error=${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const results = [];
  const origins = ['https://examcrack.pages.dev', 'https://exam-cracker-web.arvinddara0290.workers.dev'];
  for (const candidate of report) {
    for (const origin of origins) results.push(await probe(candidate, origin));
  }
  console.log('Firebase API key diagnosis with real browser origins (keys are never printed):');
  console.log(JSON.stringify(results, null, 2));
  if (!results.some((item) => item.status === 'KEY_ACCEPTED_FOR_THIS_ORIGIN')) {
    console.log('No existing candidate key was validated with the deployed browser origins. Check the API key application restrictions in Google Cloud Console or obtain the correct Web app config from Firebase Console.');
  }
} catch (error) {
  console.error('Firebase key diagnosis failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
