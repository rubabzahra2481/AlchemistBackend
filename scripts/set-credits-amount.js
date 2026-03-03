/**
 * Set credit usage to a specific amount for testing (e.g. 20,000 used of 1M for Standard).
 * Uses the CURRENT month key so the backend will read it.
 *
 * Run from backend folder:
 *   node scripts/set-credits-amount.js 20000     # 20k used (any tier)
 *   node scripts/set-credits-amount.js 200000    # 200k used
 *
 * Then set TIER_OVERRIDE=standard (or the tier you want) in .env and restart backend.
 * To reset to 0: node scripts/reset-credits-simulation.js
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

const amount = parseInt(process.argv[2], 10);
if (isNaN(amount) || amount < 0) {
  console.log('Usage: node scripts/set-credits-amount.js <tokensUsed>');
  console.log('Example: node scripts/set-credits-amount.js 20000');
  process.exit(1);
}

let data = {};
if (fs.existsSync(CREDIT_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(CREDIT_FILE, 'utf-8'));
  } catch (e) {
    console.warn('Could not read existing file.');
  }
}

const month = getCurrentMonth();
const key = `${TEST_USER_ID}:${month}`;
data[key] = {
  userId: TEST_USER_ID,
  month,
  tokensUsed: amount,
  requestCount: 0,
};

if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}
fs.writeFileSync(CREDIT_FILE, JSON.stringify(data, null, 2), 'utf-8');

console.log('Credits set for test user.');
console.log('  User:', TEST_USER_ID);
console.log('  Month (current):', month);
console.log('  tokensUsed:', amount.toLocaleString());
console.log('');
console.log('Refresh the app — the UI should show', amount.toLocaleString(), '/ tier allowance.');
console.log('To reset: node scripts/reset-credits-simulation.js');
