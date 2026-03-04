/**
 * Simulate "credits exhausted" for the frontend test user so you can test
 * the blocked state on localhost without sending real tokens.
 * 1 credit = 1000 tokens.
 *
 * Run from backend folder:
 *   node scripts/simulate-credits-exhausted.js          # Free tier (100 credits)
 *   node scripts/simulate-credits-exhausted.js basic    # Basic (400 credits)
 *   node scripts/simulate-credits-exhausted.js standard # Standard (1000 credits)
 *   node scripts/simulate-credits-exhausted.js pro      # Pro (1500 credits)
 *   node scripts/simulate-credits-exhausted.js elite    # Elite (6000 credits)
 *
 * Set TIER_OVERRIDE in .env to the same tier to see the correct badge + exhausted state.
 * To reset: node scripts/reset-credits-simulation.js
 */

const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), '.usage-data');
const CREDIT_FILE = path.join(STORE_DIR, 'credit-usage.json');

// Same test user ID as in frontend/pages/index.tsx
const TEST_USER_ID = '9498F4E8-3001-7088-50EB-82853A5A76EB';

// Allowance in credits (1 credit = 1000 tokens)
const TIER_CREDIT_ALLOWANCE = {
  free: 100,
  basic: 400,
  standard: 1_000,
  pro: 1_500,
  elite: 6_000,
};

const tierArg = (process.argv[2] || 'free').toLowerCase();
const allowance = TIER_CREDIT_ALLOWANCE[tierArg] ?? TIER_CREDIT_ALLOWANCE.free;

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let data = {};
if (fs.existsSync(CREDIT_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(CREDIT_FILE, 'utf-8'));
  } catch (e) {
    console.warn('Could not read existing file, starting fresh.');
  }
}

const month = getCurrentMonth();
const key = `${TEST_USER_ID}:${month}`;
data[key] = {
  userId: TEST_USER_ID,
  month,
  creditsUsed: allowance,
  requestCount: 1,
};

if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}
fs.writeFileSync(CREDIT_FILE, JSON.stringify(data, null, 2), 'utf-8');

console.log('Credits exhausted for test user (tier:', tierArg + ').');
console.log('  User:', TEST_USER_ID);
console.log('  Month:', month);
console.log('  creditsUsed:', allowance.toLocaleString(), '(1 credit = 1000 tokens)');
console.log('  File:', CREDIT_FILE);
console.log('');
console.log('Refresh the app — send button should be disabled.');
console.log('To reset: node scripts/reset-credits-simulation.js');
