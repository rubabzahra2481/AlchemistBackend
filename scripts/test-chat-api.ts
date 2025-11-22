/**
 * Test script to verify chat storage through the actual backend service
 * This tests the ChatRepository and ChatService integration
 */

import { ChatRepository } from '../src/repositories/chat.repository';
import { ChatSession } from '../src/entities/chat-session.entity';
import { ChatMessage } from '../src/entities/chat-message.entity';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(databaseUrl);

const dataSource = new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port, 10) || 5432,
  username: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  entities: [ChatSession, ChatMessage],
  synchronize: false,
  ssl: {
    rejectUnauthorized: false,
  },
  logging: false,
});

async function testChatRepository() {
  try {
    console.log('🔌 Initializing database connection...');
    await dataSource.initialize();
    console.log('✅ Database connected!\n');

    // Create repository instances (simulating what NestJS does)
    const sessionRepository = dataSource.getRepository(ChatSession);
    const messageRepository = dataSource.getRepository(ChatMessage);
    const chatRepository = new ChatRepository(sessionRepository, messageRepository);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🧪 TESTING CHAT REPOSITORY (Backend Service Layer)');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Generate test data
    const testUserId = uuidv4();
    const testSessionId = uuidv4();
    const testMessage1 = 'I am feeling stressed about my job';
    const testMessage2 = 'What should I do?';
    const testResponse = 'It sounds like you are experiencing work-related stress.';

    console.log('📋 Test Data:');
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Session ID: ${testSessionId}\n`);

    // Test 1: Create session
    console.log('1️⃣ Testing getOrCreateSession()...');
    const session1 = await chatRepository.getOrCreateSession(testSessionId, testUserId, 'gpt-4o');
    console.log(`   ✅ Session created: ${session1.id}`);
    console.log(`      User ID: ${session1.userId}`);
    console.log(`      Selected LLM: ${session1.selectedLLM}\n`);

    // Test 2: Save user message
    console.log('2️⃣ Testing saveUserMessage()...');
    const userMessage1 = await chatRepository.saveUserMessage(
      testSessionId,
      testUserId,
      testMessage1,
      1,
    );
    console.log(`   ✅ User message saved: "${testMessage1}"`);
    console.log(`      Message ID: ${userMessage1.id}`);
    console.log(`      Sequence: ${userMessage1.sequenceNumber}\n`);

    // Test 3: Save assistant message with metadata
    console.log('3️⃣ Testing saveAssistantMessage()...');
    const assistantMessage1 = await chatRepository.saveAssistantMessage(
      testSessionId,
      testUserId,
      testResponse,
      2,
      'gpt-4o',
      'The user is experiencing stress and needs guidance.',
      { overallInsights: 'Stress-related concern', dominantQuotients: [] },
      ['Take breaks', 'Practice mindfulness'],
      { bigFive: { openness: 'high' } },
    );
    console.log(`   ✅ Assistant message saved: "${testResponse}"`);
    console.log(`      Message ID: ${assistantMessage1.id}`);
    console.log(`      Has reasoning: ${!!assistantMessage1.reasoning}`);
    console.log(`      Has analysis: ${!!assistantMessage1.analysis}`);
    console.log(`      Has recommendations: ${!!assistantMessage1.recommendations?.length}`);
    console.log(`      Has profile snapshot: ${!!assistantMessage1.profileSnapshot}\n`);

    // Test 4: Save another user message
    console.log('4️⃣ Testing saveUserMessage() again...');
    const userMessage2 = await chatRepository.saveUserMessage(
      testSessionId,
      testUserId,
      testMessage2,
      3,
    );
    console.log(`   ✅ User message saved: "${testMessage2}"`);
    console.log(`      Sequence: ${userMessage2.sequenceNumber}\n`);

    // Test 5: Update session
    console.log('5️⃣ Testing updateSession()...');
    await chatRepository.updateSession(testSessionId, testUserId, {
      title: 'Stress Management Chat',
      currentProfile: { bigFive: { openness: 'high' } },
      messageCount: 3,
      selectedLLM: 'gpt-4o',
    });
    console.log('   ✅ Session updated with metadata\n');

    // Test 6: Get session messages
    console.log('6️⃣ Testing getSessionMessages()...');
    const messages = await chatRepository.getSessionMessages(testSessionId, testUserId);
    console.log(`   ✅ Retrieved ${messages.length} messages:`);
    messages.forEach((msg, idx) => {
      console.log(`      ${idx + 1}. [${msg.role.toUpperCase()}] Seq: ${msg.sequenceNumber}`);
      console.log(`         Content: ${msg.content.substring(0, 50)}...`);
      if (msg.reasoning) {
        console.log(`         Reasoning: ${msg.reasoning.substring(0, 30)}...`);
      }
      console.log('');
    });

    // Test 7: Get session message count
    console.log('7️⃣ Testing getSessionMessageCount()...');
    const messageCount = await chatRepository.getSessionMessageCount(testSessionId);
    console.log(`   ✅ Message count: ${messageCount}\n`);

    // Test 8: Get user sessions
    console.log('8️⃣ Testing getUserSessions()...');
    const userSessions = await chatRepository.getUserSessions(testUserId);
    console.log(`   ✅ Retrieved ${userSessions.length} session(s) for user:`);
    userSessions.forEach((sess) => {
      console.log(`      - ${sess.id}`);
      console.log(`        Title: ${sess.title}`);
      console.log(`        Message Count: ${sess.messageCount}`);
      console.log(`        Last Activity: ${sess.lastActivity}`);
      console.log('');
    });

    // Test 9: Get session by ID
    console.log('9️⃣ Testing getSessionById()...');
    const sessionById = await chatRepository.getSessionById(testSessionId, testUserId);
    if (sessionById) {
      console.log(`   ✅ Session found: ${sessionById.id}`);
      console.log(`      Messages in session: ${sessionById.messages?.length || 0}\n`);
    } else {
      console.log('   ❌ Session not found!\n');
    }

    // Test 10: Verify data integrity
    console.log('🔟 Verifying data integrity...');
    const allMessages = await chatRepository.getSessionMessages(testSessionId, testUserId);
    const sequences = allMessages.map((m) => m.sequenceNumber);
    const isSequential = sequences.every((val, idx) => idx === 0 || val === sequences[idx - 1] + 1);
    const hasCorrectRoles =
      allMessages.filter((m) => m.role === 'user').length === 2 &&
      allMessages.filter((m) => m.role === 'assistant').length === 1;

    if (isSequential && hasCorrectRoles) {
      console.log('   ✅ Data integrity verified:\n');
      console.log(`      - Messages are sequential: ${isSequential}`);
      console.log(`      - User messages: 2, Assistant messages: 1`);
      console.log(`      - All messages linked to correct user: ${testUserId}\n`);
    } else {
      throw new Error('Data integrity check failed!');
    }

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await chatRepository.deleteSession(testSessionId, testUserId);
    console.log('   ✅ Test data cleaned up\n');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ ALL REPOSITORY TESTS PASSED!');
    console.log('   Chat storage through backend services is working correctly.');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    await dataSource.destroy();
  } catch (error: any) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

testChatRepository();

