#!/bin/bash

# Test script for Quotient Advisor Agent API
# Make sure the server is running before executing this script

BASE_URL="http://localhost:3000"

echo "🧪 Testing Quotient Advisor Agent API"
echo "======================================"
echo ""

# Test 1: Get all quotients
echo "📚 Test 1: Get all quotients"
curl -s "$BASE_URL/chat/quotients" | jq '.[] | {id, name, fullName}' | head -20
echo ""
echo ""

# Test 2: Get specific quotient (EQ)
echo "🎯 Test 2: Get Emotional Quotient details"
curl -s "$BASE_URL/chat/quotients/eq" | jq '{id, fullName, description}'
echo ""
echo ""

# Test 3: Send a message
echo "💬 Test 3: Send a message to the agent"
SESSION_ID=$(uuidgen 2>/dev/null || echo "test-session-$RANDOM")
RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"I feel stuck in my career and don't know what to do\", \"sessionId\": \"$SESSION_ID\"}")

echo "$RESPONSE" | jq '{
  sessionId,
  response: .response[:200],
  dominantQuotients: .analysis.dominantQuotients[0],
  needsAttention: .analysis.needsAttention[0],
  recommendations: .recommendations[:2]
}'
echo ""
echo ""

# Test 4: Follow-up message
echo "🔄 Test 4: Send follow-up message"
curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"I'm also afraid to fail\", \"sessionId\": \"$SESSION_ID\"}" | \
  jq '{response: .response[:200], analysis: .analysis.overallInsights}'
echo ""
echo ""

# Test 5: Get conversation history
echo "📜 Test 5: Get conversation history"
curl -s "$BASE_URL/chat/session/$SESSION_ID/history" | jq 'length'
echo " messages in history"
echo ""
echo ""

# Test 6: Clear session
echo "🧹 Test 6: Clear session"
curl -s -X DELETE "$BASE_URL/chat/session/$SESSION_ID" | jq '.'
echo ""

echo "✅ All tests completed!"


