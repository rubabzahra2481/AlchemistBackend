/**
 * Set credit usage to a specific amount for testing. 1 credit = 1000 tokens.
 * Uses the CURRENT month key so the backend will read it.
 *
 * Run from backend folder:
 *   node scripts/set-credits-amount.js 20     # 20 credits used (any tier)
 *   node scripts/set-credits-amount.js 85.5   # 85.5 credits (decimals ok)
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

const amount = parseFloat(process.argv[2]);
if (isNaN(amount) || amount < 0) {
  console.log('Usage: node scripts/set-credits-amount.js <credits>');
  console.log('Example: node scripts/set-credits-amount.js 20   (1 credit = 1000 tokens)');
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
  creditsUsed: amount,
  requestCount: 0,
};

if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}
fs.writeFileSync(CREDIT_FILE, JSON.stringify(data, null, 2), 'utf-8');

console.log('Credits set for test user.');
console.log('  User:', TEST_USER_ID);
console.log('  Month (current):', month);
console.log('  creditsUsed:', amount, '(1 credit = 1000 tokens)');
console.log('');
console.log('Refresh the app — the UI should show', amount, '/ tier allowance (credits).');
console.log('To reset: node scripts/reset-credits-simulation.js');
