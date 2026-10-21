import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const expectedKey = (process.env.EXPECTED_FIREBASE_API_KEY || '').trim();
if (!expectedKey) {
  throw new Error('EXPECTED_FIREBASE_API_KEY is not set for the client-bundle verification.');
}

const root = path.join(process.cwd(), '.next', 'static', 'chunks');
const matches = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = await readFile(fullPath, 'utf8');
      if (content.includes(expectedKey)) matches.push(path.relative(process.cwd(), fullPath));
    }
  }
}

await walk(root);
if (matches.length === 0) {
  throw new Error(
    'Firebase Web API key was not found in any generated client JavaScript bundle. ' +
    'Check that NEXT_PUBLIC_* values are accessed through explicit process.env.NEXT_PUBLIC_NAME references.',
  );
}

// Do not print the key itself; API keys are browser-visible but there is no need
// to add their value to CI logs.
console.log(`Firebase public config was inlined into ${matches.length} client bundle(s).`);
