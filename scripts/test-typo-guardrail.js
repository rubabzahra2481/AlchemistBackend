/**
 * Test typo guardrail: send a message with "protopese" and check that the agent asks for confirmation.
 * Run: node scripts/test-typo-guardrail.js
 * Backend must be running (e.g. port 9000).
 */
const API = process.env.API_BASE || 'http://localhost:9000';
const sessionId = 'a1b2c3d4-e5f6-4780-a567-0e02b2c3d480';
const userId = 'a1b2c3d4-e5f6-4780-a567-0e02b2c3d481'; // valid UUID required by /chat

async function main() {
  console.log('Testing typo guardrail (protopese → propose)');
  console.log('POST', API + '/chat');
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I want to protopese a new strategy for the team.',
      sessionId,
      userId,
      stream: false,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Response not JSON:', text.slice(0, 200));
    process.exit(1);
  }
  if (!res.ok) {
    console.error('HTTP', res.status, data);
    process.exit(1);
  }
  const response = (data.response || '').toLowerCase();
  const hasConfirm = response.includes('confirm') || response.includes('did you mean');
  const hasPropose = response.includes('propose');
  console.log('Response snippet:', (data.response || '').slice(0, 280));
  console.log('');
  if (hasConfirm && hasPropose) {
    console.log('PASS: Agent asked for confirmation (e.g. "did you mean propose?").');
  } else {
    console.log('FAIL: Expected response to ask for confirmation (e.g. "Just to confirm, did you mean propose?").');
    console.log('  hasConfirm:', hasConfirm, 'hasPropose:', hasPropose);
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
