/**
 * Reset the credit simulation so the test user can chat again.
 * Sets tokensUsed to 0 for the test user (same user as simulate-credits-exhausted.js).
 *
 * Run from backend folder: node scripts/reset-credits-simulation.js
 * Then refresh the frontend — the "Credits exhausted" banner should disappear.
 */

const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), '.usage-data');
const CREDIT_FILE = path.join(STORE_DIR, 'credit-usage.json');
const TEST_USER_ID = '9498F4E8-3001-7088-50EB-82853A5A76EB';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let data = {};
if (fs.existsSync(CREDIT_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(CREDIT_FILE, 'utf-8'));
  } catch (e) {
    console.warn('Could not read credit file.');
  }
}

const month = getCurrentMonth();
const key = `${TEST_USER_ID}:${month}`;

if (key in data) {
  const rec = data[key];
  data[key] = { userId: rec.userId, month: rec.month, creditsUsed: 0, requestCount: 0 };
  fs.writeFileSync(CREDIT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Credits reset for test user.');
  console.log('  User:', TEST_USER_ID);
  console.log('  creditsUsed set to 0');
  console.log('');
  console.log('Refresh the frontend — you can send messages again.');
} else {
  console.log('No credit record found for test user (already reset or never simulated).');
  console.log('  Key:', key);
}
