/**
 * Test tier-info API for progress bar (credits used vs included).
 * Run from backend folder: node scripts/test-tier-info-progress-bar.js
 * Requires backend running on PORT (default 9000).
 *
 * Usage:
 *   node scripts/test-tier-info-progress-bar.js [userId]
 *   node scripts/test-tier-info-progress-bar.js 9498F4E8-3001-7088-50EB-82853A5A76EB
 */

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:9000';
const USER_ID = process.argv[2] || '9498F4E8-3001-7088-50EB-82853A5A76EB';

async function getTierInfo() {
  const url = `${BASE}/chat/tier-info/${USER_ID}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`tier-info failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function sendMessage() {
  const url = `${BASE}/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hi, one short test message for credit usage.',
      userId: USER_ID,
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`chat failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function creditsSummary(data) {
  const c = data?.credits;
  if (!c) return { error: 'No credits in response' };
  return {
    creditsUsed: c.creditsUsed,
    creditsIncluded: c.creditsIncluded,
    usagePercentage: c.usagePercentage,
    allowed: c.allowed,
    baseAllowance: c.baseAllowance,
    topUpCarried: c.topUpCarried,
    topUpAddedThisMonth: c.topUpAddedThisMonth,
    // For progress bar: use creditsUsed / creditsIncluded (or usagePercentage)
    progressBarHint: `Bar = ${c.creditsUsed} / ${c.creditsIncluded} (${(c.usagePercentage || 0).toFixed(1)}%)`,
  };
}

async function main() {
  console.log('Testing tier-info API for progress bar');
  console.log('Base URL:', BASE);
  console.log('User ID:', USER_ID);
  console.log('');

  try {
    // 1) Before any message
    console.log('1) GET /chat/tier-info/:userId (before message)');
    const before = await getTierInfo();
    const beforeCredits = creditsSummary(before);
    console.log('   Credits:', JSON.stringify(beforeCredits, null, 2));
    console.log('   Tier:', before.tier);
    console.log('');

    // 2) Send one message to increment usage
    console.log('2) POST /chat (one message)');
    await sendMessage();
    console.log('   Message sent.');
    console.log('');

    // 3) After message – creditsUsed should increase
    console.log('3) GET /chat/tier-info/:userId (after message)');
    const after = await getTierInfo();
    const afterCredits = creditsSummary(after);
    console.log('   Credits:', JSON.stringify(afterCredits, null, 2));
    console.log('');

    const usedBefore = beforeCredits.creditsUsed;
    const usedAfter = afterCredits.creditsUsed;
    const increased = typeof usedBefore === 'number' && typeof usedAfter === 'number' && usedAfter > usedBefore;

    console.log('4) Progress bar check');
    console.log('   creditsUsed before:', usedBefore);
    console.log('   creditsUsed after:', usedAfter);
    console.log('   Increased after message?', increased ? 'YES' : 'NO');
    console.log('');
    console.log('iOS progress bar should use:');
    console.log('   - credits.creditsUsed (used)');
    console.log('   - credits.creditsIncluded (total)');
    console.log('   - credits.usagePercentage (0–100) or compute: (creditsUsed / creditsIncluded) * 100');
    console.log('   Do NOT use tokensUsed/tokensIncluded for the bar (different scale: 1 credit = 1000 tokens).');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
