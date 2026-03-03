/**
 * Test credit read-back from Munawar's DB.
 *
 * 1. Clears local credit usage for TEST_USER_ID so the next tier-info call
 *    will trigger fetchUsageFromMunawar (if USE_IOS_BACKEND=true).
 * 2. Calls GET /chat/tier-info/:userId and prints credits.
 *
 * Prereqs:
 * - Backend running: npm run start:dev (from backend folder)
 * - Optional: USE_IOS_BACKEND=true and Munawar's API up with at least one
 *   agent message that has metadata.credits (e.g. after sending a chat)
 *
 * Run from backend folder: node scripts/test-readback.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const STORE_DIR = path.join(process.cwd(), '.usage-data');
const CREDIT_FILE = path.join(STORE_DIR, 'credit-usage.json');
const TEST_USER_ID = '9498F4E8-3001-7088-50EB-82853A5A76EB';
const BASE_URL = process.env.AGENT_URL || 'http://localhost:3000';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 1. Clear local credit record so read-back can run
let data = {};
if (fs.existsSync(CREDIT_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(CREDIT_FILE, 'utf-8'));
  } catch (e) {
    console.warn('Could not read credit file, starting fresh.');
  }
}
const month = getCurrentMonth();
const key = `${TEST_USER_ID}:${month}`;
const hadRecord = key in data;
delete data[key];
if (fs.existsSync(STORE_DIR)) {
  fs.writeFileSync(CREDIT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
console.log('Cleared local credit record for', TEST_USER_ID, hadRecord ? '(had data)' : '(was already empty)');
console.log('');

// 2. Call tier-info
const url = new URL(`/chat/tier-info/${encodeURIComponent(TEST_USER_ID)}`, BASE_URL);
const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 3000;
const req = http.request(
  {
    hostname: url.hostname,
    port: port,
    path: url.pathname,
    method: 'GET',
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error('tier-info failed:', res.statusCode, body.slice(0, 200));
        process.exit(1);
      }
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        console.error('Invalid JSON:', body.slice(0, 200));
        process.exit(1);
      }
      const credits = json.credits;
      if (!credits) {
        console.log('Response has no credits field:', Object.keys(json));
        process.exit(0);
      }
      console.log('GET', url.href);
      console.log('credits:', JSON.stringify(credits, null, 2));
      console.log('');
      console.log(
        credits.tokensUsed > 0
          ? 'Read-back test: credits restored (tokensUsed > 0). Check backend logs for "Read-back from Munawar".'
          : 'Credits are zero. If USE_IOS_BACKEND=true and Munawar has agent messages with metadata.credits, read-back would have restored them.',
      );
    });
  },
);
req.on('error', (e) => {
  console.error('Request failed:', e.message || e.code || String(e));
  console.error('Is the backend running at', BASE_URL, '? (e.g. npm run start:dev)');
  process.exit(1);
});
req.end();
