/**
 * Tests guest chat prompt: sends a conversation flow and checks responses.
 * Run with: node scripts/test-guest-prompt.js
 * Backend must be running (e.g. npm run start:dev on port 9000).
 */

const API_BASE = process.env.API_BASE || 'http://localhost:9000';
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
const sessionId = uuid();
let guestUserId = null;

const CONVERSATION = [
  'I want to buy a new car',
  'it was about how it feels',
  'I am thinking about budget and safety features',
  'maybe 7 out of 10',
  'I think I have enough to decide',
];

async function sendGuestMessage(message) {
  const body = { message, sessionId, stream: false };
  if (guestUserId) body.guestUserId = guestUserId;
  const res = await fetch(`${API_BASE}/chat/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  const data = await res.json();
  if (data.guestUserId) guestUserId = data.guestUserId;
  return data;
}

function main() {
  console.log('Guest prompt test – conversation flow');
  console.log('API:', API_BASE);
  console.log('Session:', sessionId);
  console.log('---\n');

  const results = [];
  let previousResponse = null;
  let failed = false;

  (async () => {
    for (let i = 0; i < CONVERSATION.length; i++) {
      const userMsg = CONVERSATION[i];
      process.stdout.write(`Turn ${i + 1} User: "${userMsg}"\n`);
      try {
        const data = await sendGuestMessage(userMsg);
        const response = (data.response || '').trim();
        const reasoning = (data.reasoning || '').trim();

        process.stdout.write(`Assistant: ${response}\n`);
        if (reasoning) process.stdout.write(`[Reasoning] ${reasoning.slice(0, 120)}${reasoning.length > 120 ? '...' : ''}\n`);

        const isEmpty = !response;
        const isRepeat = previousResponse && response === previousResponse;
        const afterFeelings = i >= 1 && userMsg.toLowerCase().includes('feel');
        const stillAskingFirstInstinct = afterFeelings && /first instinct|facts and numbers|how it feels\?/i.test(response);

        if (isEmpty) {
          console.log('FAIL: Empty response');
          failed = true;
        }
        if (isRepeat) {
          console.log('FAIL: Same response as previous turn');
          failed = true;
        }
        if (stillAskingFirstInstinct && i >= 2) {
          console.log('FAIL: Still asking first instinct after user already said feelings');
          failed = true;
        }

        results.push({ turn: i + 1, user: userMsg, response, reasoning, isEmpty, isRepeat, stillAskingFirstInstinct });
        previousResponse = response;
        console.log('');
      } catch (e) {
        console.error('ERROR:', e.message);
        failed = true;
        results.push({ turn: i + 1, user: userMsg, error: e.message });
        break;
      }
    }

    console.log('---');
    console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
    process.exit(failed ? 1 : 0);
  })();
}

main();
