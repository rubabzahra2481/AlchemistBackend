import { Client } from 'pg';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testChatStorage() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Generate test data
    const testUserId = uuidv4(); // Simulated user ID
    const testSessionId = uuidv4(); // Test session ID
    const testMessage1 = 'Hello, I need some advice';
    const testMessage2 = 'Can you help me with my career?';
    const testResponse = 'I would be happy to help you with your career goals!';

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🧪 TESTING CHAT HISTORY STORAGE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📋 Test Data:');
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Session ID: ${testSessionId}\n`);

    // Step 1: Create a test session
    console.log('1️⃣ Creating test session...');
    await client.query(
      `INSERT INTO chat_sessions (id, user_id, title, last_activity, message_count, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [testSessionId, testUserId, 'Test Chat Session'],
    );
    console.log('   ✅ Session created\n');

    // Step 2: Save user message 1
    console.log('2️⃣ Saving first user message...');
    const sequence1 = 1;
    await client.query(
      `INSERT INTO chat_messages (id, session_id, user_id, role, content, sequence_number, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [testSessionId, testUserId, 'user', testMessage1, sequence1],
    );
    console.log(`   ✅ Message saved: "${testMessage1}"\n`);

    // Step 3: Save assistant response 1
    console.log('3️⃣ Saving assistant response...');
    const sequence2 = 2;
    const testAnalysis = {
      overallInsights: 'User seeking career advice',
      dominantQuotients: [],
      needsAttention: [],
    };
    await client.query(
      `INSERT INTO chat_messages (id, session_id, user_id, role, content, sequence_number, selected_llm, analysis, profile_snapshot, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [
        testSessionId,
        testUserId,
        'assistant',
        testResponse,
        sequence2,
        'gpt-4o',
        JSON.stringify(testAnalysis),
        JSON.stringify({ test: 'profile' }),
      ],
    );
    console.log(`   ✅ Response saved: "${testResponse}"\n`);

    // Step 4: Save user message 2
    console.log('4️⃣ Saving second user message...');
    const sequence3 = 3;
    await client.query(
      `INSERT INTO chat_messages (id, session_id, user_id, role, content, sequence_number, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [testSessionId, testUserId, 'user', testMessage2, sequence3],
    );
    console.log(`   ✅ Message saved: "${testMessage2}"\n`);

    // Step 5: Update session with message count
    console.log('5️⃣ Updating session metadata...');
    await client.query(
      `UPDATE chat_sessions 
       SET message_count = (SELECT COUNT(*) FROM chat_messages WHERE session_id = $1),
           last_activity = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [testSessionId],
    );
    console.log('   ✅ Session updated\n');

    // Step 6: Verify data was saved
    console.log('6️⃣ Verifying data storage...\n');

    // Check session
    const sessionResult = await client.query(
      `SELECT id, user_id, title, message_count, last_activity 
       FROM chat_sessions 
       WHERE id = $1 AND user_id = $2`,
      [testSessionId, testUserId],
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('❌ Session not found!');
    }

    const session = sessionResult.rows[0];
    console.log('   📋 Session Data:');
    console.log(`      ID: ${session.id}`);
    console.log(`      User ID: ${session.user_id}`);
    console.log(`      Title: ${session.title}`);
    console.log(`      Message Count: ${session.message_count}`);
    console.log(`      Last Activity: ${session.last_activity}\n`);

    // Check messages
    const messagesResult = await client.query(
      `SELECT role, content, sequence_number, selected_llm, created_at
       FROM chat_messages
       WHERE session_id = $1 AND user_id = $2
       ORDER BY sequence_number ASC`,
      [testSessionId, testUserId],
    );

    console.log(`   💬 Messages (${messagesResult.rows.length} total):`);
    messagesResult.rows.forEach((msg, idx) => {
      console.log(`      ${idx + 1}. [${msg.role.toUpperCase()}] (seq: ${msg.sequence_number})`);
      console.log(`         ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`);
      console.log(`         Created: ${msg.created_at}`);
      if (msg.selected_llm) {
        console.log(`         LLM: ${msg.selected_llm}`);
      }
      console.log('');
    });

    // Step 7: Test retrieval - get session history
    console.log('7️⃣ Testing session history retrieval...');
    const historyResult = await client.query(
      `SELECT 
         m.role,
         m.content,
         m.sequence_number,
         m.created_at,
         m.reasoning,
         m.analysis,
         m.profile_snapshot
       FROM chat_messages m
       WHERE m.session_id = $1 AND m.user_id = $2
       ORDER BY m.sequence_number ASC`,
      [testSessionId, testUserId],
    );

    console.log(`   ✅ Retrieved ${historyResult.rows.length} messages from database\n`);

    // Step 8: Verify message order
    console.log('8️⃣ Verifying message sequence...');
    const sequenceNumbers = historyResult.rows.map((r) => r.sequence_number);
    const isOrdered = sequenceNumbers.every((val, idx, arr) => idx === 0 || val > arr[idx - 1]);
    if (isOrdered && sequenceNumbers[0] === 1) {
      console.log('   ✅ Messages are correctly sequenced\n');
    } else {
      throw new Error('❌ Messages are not in correct sequence!');
    }

    // Step 9: Clean up test data (optional - comment out to keep data for inspection)
    console.log('9️⃣ Cleaning up test data...');
    await client.query('DELETE FROM chat_messages WHERE session_id = $1', [testSessionId]);
    await client.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId]);
    console.log('   ✅ Test data cleaned up\n');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED! Chat history storage is working correctly.');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    await client.end();
  } catch (error: any) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    await client.end();
    process.exit(1);
  }
}

testChatStorage();

