/**
 * Test that the agent returns non-empty response and reasoning for
 * alchemist, architect, and mixed core types (Decision Intelligence mode).
 *
 * Run from backend folder with backend running on port 9000:
 *   node scripts/test-agent-response-empty.js
 *
 * Requires: BACKEND_URL env or defaults to http://127.0.0.1:9000
 */

const BASE = process.env.BACKEND_URL || process.env.API_BASE_URL || 'http://127.0.0.1:9000';
const CORE_TYPES = ['alchemist', 'architect', 'mixed'];
const MESSAGE = 'I need help deciding whether to take the new job offer.';

async function testCoreType(coreType) {
  const url = `${BASE}/chat/test-response`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coreType, message: MESSAGE }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${coreType}: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('Testing agent response/reasoning for alchemist, architect, mixed');
  console.log('Base URL:', BASE);
  console.log('Message:', MESSAGE);
  console.log('');

  let allOk = true;
  for (const coreType of CORE_TYPES) {
    try {
      const data = await testCoreType(coreType);
      const responseEmpty = data.responseEmpty === true;
      const reasoningEmpty = data.reasoningEmpty === true;
      const ok = data.ok === true && !responseEmpty && !reasoningEmpty;

      if (!ok) allOk = false;

      console.log(`--- ${coreType.toUpperCase()} ---`);
      console.log('  responseEmpty:', responseEmpty);
      console.log('  reasoningEmpty:', reasoningEmpty);
      console.log('  ok:', ok);
      console.log('  response length:', (data.response || '').length);
      console.log('  reasoning length:', (data.reasoning || '').length);
      if ((data.response || '').trim().length > 0) {
        console.log('  response preview:', (data.response || '').trim().slice(0, 120) + '...');
      } else {
        console.log('  response preview: (empty)');
      }
      console.log('');
    } catch (e) {
      console.error(`${coreType}:`, e.message);
      allOk = false;
      console.log('');
    }
  }

  console.log('--- SUMMARY ---');
  console.log(allOk ? 'PASS: All core types returned non-empty response and reasoning.' : 'FAIL: At least one core type had empty response or reasoning.');
  process.exit(allOk ? 0 : 1);
}

main();
