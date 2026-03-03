/**
 * Test Munawar's APIs and see what they return (including any token/usage fields).
 * Run from backend folder: node scripts/test-munawar-apis.js
 * Requires .env with IOS_BACKEND_URL, IOS_BACKEND_EMAIL, IOS_BACKEND_PASSWORD.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.IOS_BACKEND_URL || '';
const EMAIL = process.env.IOS_BACKEND_EMAIL || 'rubab@brandscaling.com';
const PASSWORD = process.env.IOS_BACKEND_PASSWORD || 'rubab-secure-password-2026';

if (!BASE) {
  console.error('❌ IOS_BACKEND_URL not set in .env. Set it to Munawar\'s base URL (e.g. https://xxx.ngrok-free.dev or http://192.168.x.x:3000)');
  process.exit(1);
}

async function request(method, path, body, token) {
  const url = path.startsWith('http') ? path : `${BASE.replace(/\/$/, '')}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('Base URL:', BASE);
  console.log('');

  // 1) Login
  console.log('1) POST /api/agent/auth/login');
  const loginRes = await request('POST', '/api/agent/auth/login', { email: EMAIL, password: PASSWORD });
  if (!loginRes.ok) {
    console.log('   Status:', loginRes.status);
    console.log('   Response:', JSON.stringify(loginRes.data, null, 2));
    console.log('   Cannot continue without token.');
    return;
  }
  const token = loginRes.data?.token;
  if (!token) {
    console.log('   Response:', JSON.stringify(loginRes.data, null, 2));
    console.log('   No token in response.');
    return;
  }
  console.log('   OK, got token');
  console.log('');

  // 2) Get users list
  console.log('2) GET /api/agent/users?limit=3');
  const usersRes = await request('GET', '/api/agent/users?limit=3', null, token);
  console.log('   Status:', usersRes.status);
  if (usersRes.ok && usersRes.data) {
    const users = usersRes.data.users || usersRes.data;
    const list = Array.isArray(users) ? users : [];
    console.log('   Users count:', list.length);
    if (list.length > 0) {
      const u = list[0];
      console.log('   First user keys:', Object.keys(u).join(', '));
      if (u.tier !== undefined) console.log('   First user tier:', u.tier);
      if (u.tokensUsed !== undefined || u.tokens_used !== undefined) {
        console.log('   ** Token field on user:', u.tokensUsed ?? u.tokens_used);
      }
    }
    console.log('   Full response (first user):', JSON.stringify(list[0] || usersRes.data, null, 2));
  } else {
    console.log('   Response:', JSON.stringify(usersRes.data, null, 2));
  }
  console.log('');

  const userId = usersRes.data?.users?.[0]?.id || usersRes.data?.users?.[0]?.id || usersRes.data?.[0]?.id;
  if (!userId) {
    console.log('   No userId found; skipping profile and usage calls.');
    console.log('');
    console.log('3) POST /api/agent/logs/tokens (optional)');
    const logBody = {
      userId: '00000000-0000-0000-0000-000000000000',
      sessionId: '00000000-0000-0000-0000-000000000000',
      totalTokens: 100,
      inputTokens: 50,
      outputTokens: 50,
      llmModel: 'gpt-4o-mini',
      callType: 'test',
      costUsd: 0.0001,
    };
    const logRes = await request('POST', '/api/agent/logs/tokens', logBody, token);
    console.log('   Status:', logRes.status);
    console.log('   Response:', JSON.stringify(logRes.data, null, 2));
    if (logRes.status === 404) console.log('   -> Endpoint not implemented (404).');
    return;
  }

  // 3) Get user by ID
  console.log('3) GET /api/agent/users/:userId');
  const userRes = await request('GET', `/api/agent/users/${userId}`, null, token);
  console.log('   Status:', userRes.status);
  if (userRes.ok && userRes.data?.user) {
    const u = userRes.data.user;
    console.log('   User keys:', Object.keys(u).join(', '));
    console.log('   tier:', u.tier);
    if (u.tokensUsed !== undefined || u.tokens_used !== undefined) console.log('   ** tokens:', u.tokensUsed ?? u.tokens_used);
  }
  console.log('   Full user:', JSON.stringify(userRes.data, null, 2));
  console.log('');

  // 4) Get profile (E-DNA + tier)
  console.log('4) GET /api/agent/users/:userId/profile');
  const profileRes = await request('GET', `/api/agent/users/${userId}/profile`, null, token);
  console.log('   Status:', profileRes.status);
  if (profileRes.ok && profileRes.data) {
    const p = profileRes.data;
    console.log('   Top-level keys:', Object.keys(p).join(', '));
    if (p.user) console.log('   user.tier:', p.user.tier);
    if (p.ednaProfile) console.log('   ednaProfile keys:', Object.keys(p.ednaProfile).join(', '));
    if (p.user?.tokensUsed !== undefined || p.user?.tokens_used !== undefined) {
      console.log('   ** user token field:', p.user.tokensUsed ?? p.user.tokens_used);
    }
  }
  console.log('   Full profile:', JSON.stringify(profileRes.data, null, 2));
  console.log('');

  // 5) Try GET usage (in case Munawar added it)
  console.log('5) GET /api/agent/users/:userId/usage (or /usage?month=...)');
  const usageGetRes = await request('GET', `/api/agent/users/${userId}/usage`, null, token);
  console.log('   Status:', usageGetRes.status);
  console.log('   Response:', JSON.stringify(usageGetRes.data, null, 2));
  if (usageGetRes.status === 404) console.log('   -> Endpoint not implemented (404).');
  console.log('');

  // 6) POST logs/tokens
  console.log('6) POST /api/agent/logs/tokens');
  const logBody = {
    userId,
    sessionId: userId,
    totalTokens: 100,
    inputTokens: 50,
    outputTokens: 50,
    llmModel: 'gpt-4o-mini',
    callType: 'test',
    costUsd: 0.0001,
  };
  const logRes = await request('POST', '/api/agent/logs/tokens', logBody, token);
  console.log('   Status:', logRes.status);
  console.log('   Response:', JSON.stringify(logRes.data, null, 2));
  if (logRes.status === 404) console.log('   -> Endpoint not implemented (404).');
  if (logRes.ok) console.log('   -> Token log accepted; token_usage_logs may be in use.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
