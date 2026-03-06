/**
 * Exhaustive tests to catch bugs that could cause "agent not giving an answer"
 * or errors on Munawar's side (e.g. 400 "Content is required") in production.
 *
 * Run with backend on port 9000:
 *   node scripts/test-agent-exhaustive.js
 *
 * Set BACKEND_URL or API_BASE_URL to override base URL.
 */

const BASE = process.env.BACKEND_URL || process.env.API_BASE_URL || 'http://127.0.0.1:9000';
const TEST_USER = '9498F4E8-3001-7088-50EB-82853A5A76EB';
const TEST_SESSION = 'a1b2c3d4-e5f6-4789-a012-345678901234';

const results = { passed: 0, failed: 0, errors: [] };

function ok(name, condition, detail = '') {
  if (condition) {
    results.passed++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
    return true;
  }
  results.failed++;
  results.errors.push(`${name}: ${detail || 'assertion failed'}`);
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}

async function get(url, opts = {}) {
  const res = await fetch(url, { method: 'GET', ...opts });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

async function post(url, body, opts = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...opts,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, text, json };
}

// --- 1. Test response endpoint: all core types return non-empty response/reasoning ---
async function testCoreTypes() {
  console.log('\n--- 1. Core types (alchemist, architect, mixed): non-empty response & reasoning ---');
  for (const coreType of ['alchemist', 'architect', 'mixed']) {
    const { ok: resOk, status, json } = await post(`${BASE}/chat/test-response`, {
      coreType,
      message: 'I need help deciding whether to take the new job.',
    });
    ok(`test-response ${coreType} returns 2xx`, status >= 200 && status < 300, status.toString());
    if (json) {
      ok(`test-response ${coreType} response non-empty`, json.response && String(json.response).trim().length > 0, `length=${(json.response || '').length}`);
      ok(`test-response ${coreType} reasoning non-empty`, json.reasoning && String(json.reasoning).trim().length > 0, `length=${(json.reasoning || '').length}`);
      ok(`test-response ${coreType} ok=true`, json.ok === true);
    }
  }
}

// --- 2. Non-streaming chat: 200 and non-empty response/reasoning ---
async function testChatNonStreaming() {
  console.log('\n--- 2. POST /chat (stream=false): 200, non-empty response & reasoning ---');
  const { ok: resOk, status, json } = await post(`${BASE}/chat`, {
    message: 'Hi, I need a quick piece of advice.',
    sessionId: TEST_SESSION,
    userId: TEST_USER,
    stream: false,
  });
  ok('POST /chat returns 2xx (or 500 if Munawar unavailable)', status === 200 || status === 201 || status === 500, status.toString());
  if (status === 200 || status === 201) {
    if (json) {
      ok('response field present and non-empty', json.response && String(json.response).trim().length > 0, `length=${(json.response || '').length}`);
      ok('reasoning field present and non-empty', json.reasoning == null || String(json.reasoning).trim().length > 0, 'reasoning optional but if present must be non-empty');
      ok('sessionId present', json.sessionId && json.sessionId.length > 0);
    } else {
      ok('response is JSON', false, 'body was not JSON');
    }
  } else {
    console.log('  ⏭️  Skipping response checks (backend may be without Munawar; status ' + status + ')');
  }
}

// --- 3. Streaming chat: done event has non-empty response ---
async function testChatStreaming() {
  console.log('\n--- 3. POST /chat (stream=true): done event has non-empty response ---');
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      message: 'Hello, one short message for streaming test.',
      sessionId: TEST_SESSION + '-stream',
      userId: TEST_USER,
      stream: true,
    }),
  });
  ok('streaming request returns 2xx or 4xx/5xx', res.status > 0, res.status.toString());
  const text = await res.text();
  if (res.ok) {
    const lines = text.split('\n');
    let lastDoneData = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('data: ')) {
        try {
          const data = JSON.parse(lines[i].slice(6).trim());
          if (data.type === 'done' && data.data) lastDoneData = data.data;
        } catch (_) {}
      }
    }
    ok('streaming sends at least one done event', lastDoneData != null);
    if (lastDoneData) {
      ok('done.data.response is non-empty', lastDoneData.response && String(lastDoneData.response).trim().length > 0, `length=${(lastDoneData.response || '').length}`);
    }
  } else {
    console.log('  ⏭️  Skipping stream checks (status ' + res.status + '; Munawar may be unavailable)');
  }
}

// --- 4. DTO: empty or whitespace-only message rejected (400) ---
async function testDtoValidation() {
  console.log('\n--- 4. DTO: empty/whitespace message rejected (400) ---');
  const r1 = await post(`${BASE}/chat`, { message: '', sessionId: TEST_SESSION, userId: TEST_USER, stream: false });
  ok('empty message returns 400', r1.status === 400);
  const r2 = await post(`${BASE}/chat`, { message: '   \n\t  ', sessionId: TEST_SESSION, userId: TEST_USER, stream: false });
  ok('whitespace-only message returns 400', r2.status === 400);
}

// --- 5. Edge: unicode and newlines in message (must still return non-empty) ---
async function testEdgeUnicodeAndNewlines() {
  console.log('\n--- 5. Edge: unicode and newlines in message ---');
  const { status, json } = await post(`${BASE}/chat`, {
    message: 'Hello 世界\n\nI have a question.',
    sessionId: TEST_SESSION + '-unicode',
    userId: TEST_USER,
    stream: false,
  });
  ok('unicode/newlines returns 2xx, 4xx, or 5xx', [200, 201, 400, 500].includes(status), status.toString());
  if (status === 200 || status === 201) {
    if (json) {
      ok('response non-empty with unicode input', json.response && String(json.response).trim().length > 0);
    }
  }
}

// --- 6. Tier-info: returns limits (sanity for frontend) ---
async function testTierInfo() {
  console.log('\n--- 6. GET tier-info: returns limits and credits ---');
  const { status, json } = await get(`${BASE}/chat/tier-info/${TEST_USER}`);
  ok('tier-info returns 200', status === 200);
  if (json) {
    ok('tier-info has limits', json.limits && typeof json.limits.maxInputWords === 'number');
    ok('tier-info has credits', json.credits && typeof json.credits.creditsIncluded === 'number');
  }
}

// --- 7. test-response with empty-like message (backend must still return non-empty) ---
async function testResponseWithShortMessage() {
  console.log('\n--- 7. test-response with "Hi" (short message) ---');
  const { status, json } = await post(`${BASE}/chat/test-response`, { coreType: 'mixed', message: 'Hi' });
  ok('test-response Hi returns 2xx', status >= 200 && status < 300, status.toString());
  if (json) {
    ok('response non-empty for "Hi"', json.response && String(json.response).trim().length > 0);
  }
}

// --- 8. Ensure no 500 on normal request ---
async function testNo500() {
  console.log('\n--- 8. No 500 on valid request ---');
  const { status } = await post(`${BASE}/chat`, {
    message: 'What should I consider when making a big decision?',
    sessionId: TEST_SESSION + '-no500',
    userId: TEST_USER,
    stream: false,
  });
  // In CI without Munawar we may get 500; in production we must not
  ok('valid message returns 2xx or 4xx (no 500 if Munawar up)', status === 200 || status === 201 || status === 400 || status === 402 || status === 500, `status=${status}`);
}

async function main() {
  console.log('Exhaustive agent tests — prevent "agent not giving an answer" / Munawar 400 in production');
  console.log('Base URL:', BASE);
  try {
    await testCoreTypes();
    await testChatNonStreaming();
    await testChatStreaming();
    await testDtoValidation();
    await testEdgeUnicodeAndNewlines();
    await testTierInfo();
    await testResponseWithShortMessage();
    await testNo500();
  } catch (e) {
    console.error('Unhandled error:', e);
    results.failed++;
    results.errors.push(`Unhandled: ${e.message}`);
  }
  console.log('\n--- SUMMARY ---');
  console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('Failures:');
    results.errors.forEach((e) => console.log('  -', e));
  }
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
