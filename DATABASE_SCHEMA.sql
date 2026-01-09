-- ============================================================================
-- AI ALCHEMIST AGENT - DATABASE SCHEMA
-- ============================================================================
-- Tables for the psychological analysis chat agent.
-- Requires: users table (managed by main team)
-- ============================================================================

-- ============================================================================
-- FOREIGN KEY DEPENDENCIES (from main database)
-- ============================================================================
/*
REQUIRED FROM MAIN DB:
  - users.id (UUID) - Primary key of the users table
  
FOREIGN KEYS WE NEED:
  - chat_sessions.user_id → users.id
  - chat_messages.user_id → users.id
  - user_psychological_profiles.user_id → users.id
  - framework_analysis_logs.user_id → users.id
  - token_usage_logs.user_id → users.id

If users table doesn't exist yet, use this placeholder:
  CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
*/

-- ============================================================================
-- TABLE 1: CHAT SESSIONS
-- ============================================================================
-- Stores conversation sessions between users and the AI agent

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK to main users table
    user_id UUID NOT NULL, -- FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
    
    -- Session info
    title VARCHAR(255),
    selected_llm VARCHAR(50) DEFAULT 'gpt-4o',
    
    -- Session state
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    
    -- Current psychological profile (JSON snapshot of latest analysis)
    current_profile JSONB,
    /*
    current_profile structure:
    {
      "bigFive": { "openness": "high", "conscientiousness": "medium", ... },
      "dass": { "depression": "mild", "anxiety": "normal", "stress": "moderate", ... },
      "rse": { "level": "medium", "indicators": [...] },
      "safety": { "flag": "none" },
      "summaryForThisMessage": { "summary": "...", "key_signals": [...] }
    }
    */
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_last_activity ON chat_sessions(last_activity DESC);
CREATE INDEX idx_chat_sessions_user_active ON chat_sessions(user_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- TABLE 2: CHAT MESSAGES
-- ============================================================================
-- Stores individual messages in each chat session

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK to chat_sessions
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    -- FK to main users table
    user_id UUID NOT NULL, -- FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
    
    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    
    -- Ordering within session
    sequence_number INTEGER NOT NULL,
    
    -- Assistant message metadata (NULL for user messages)
    selected_llm VARCHAR(50),
    reasoning TEXT, -- Internal chain-of-thought reasoning
    
    -- Analysis results (JSON) - populated for assistant messages
    analysis JSONB,
    /*
    analysis structure:
    {
      "overallInsights": "User shows signs of...",
      "dominantQuotients": ["EQ", "SQ"],
      "needsAttention": ["stress management"],
      "conversationContext": "..."
    }
    */
    
    recommendations JSONB, -- ["Take breaks", "Practice mindfulness"]
    
    profile_snapshot JSONB, -- Full psychological profile at this point in conversation
    
    -- Which frameworks were triggered for this message
    frameworks_triggered TEXT[], -- ['bigFive', 'dass', 'rse', 'crt']
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_session_sequence ON chat_messages(session_id, sequence_number);

-- ============================================================================
-- TABLE 3: USER PSYCHOLOGICAL PROFILES
-- ============================================================================
-- Accumulated psychological profile per user (built over all conversations)

CREATE TABLE user_psychological_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK to main users table (one profile per user)
    user_id UUID NOT NULL UNIQUE, -- FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
    
    -- ========== 11 PSYCHOLOGICAL FRAMEWORKS ==========
    
    -- 1. Big Five Personality Traits
    big_five JSONB,
    /*
    {
      "openness": "high/medium/low",
      "conscientiousness": "high/medium/low",
      "extraversion": "high/medium/low",
      "agreeableness": "high/medium/low",
      "neuroticism": "high/medium/low",
      "insights": ["Creative thinker", "Prefers routine"],
      "confidence": 0.85,
      "evidence": ["I love trying new things"],
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 2. DASS-42 (Depression, Anxiety, Stress)
    dass JSONB,
    /*
    {
      "depression": "normal/mild/moderate/severe/extremely_severe",
      "anxiety": "normal/mild/moderate/severe/extremely_severe",
      "stress": "normal/mild/moderate/severe/extremely_severe",
      "concerns": ["Elevated stress levels"],
      "requiresCrisisResponse": false,
      "confidence": 0.78,
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 3. RSE (Rosenberg Self-Esteem)
    rse JSONB,
    /*
    {
      "level": "low/medium/high",
      "indicators": ["Self-critical language", "Minimizes achievements"],
      "confidence": 0.72,
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 4. Dark Triad
    dark_triad JSONB,
    /*
    {
      "machiavellianism": "high/medium/low/unknown",
      "narcissism": "high/medium/low/unknown",
      "psychopathy": "high/medium/low/unknown",
      "insights": ["Shows empathy", "Values fairness"],
      "confidence": 0.65,
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 5. CRT (Cognitive Reflection Test - Thinking Style)
    crt JSONB,
    /*
    {
      "thinkingStyle": "intuitive/balanced/analytical/unknown",
      "systemPreference": "system1/mixed/system2/unknown",
      "insights": ["Tends to overthink", "Trusts gut feelings"],
      "confidence": 0.70,
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 6. Attachment Style
    attachment JSONB,
    /*
    {
      "style": "secure/anxious/avoidant/disorganized/unknown",
      "confidence": 0.68,
      "evidence": ["Fear of abandonment mentioned"],
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 7. Enneagram
    enneagram JSONB,
    /*
    {
      "primary_type": 1-9,
      "wing": 1-9 or null,
      "confidence": 0.60,
      "evidence": ["Perfectionist tendencies"],
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 8. MBTI
    mbti JSONB,
    /*
    {
      "EI": "E/I/unknown",
      "SN": "S/N/unknown",
      "TF": "T/F/unknown",
      "JP": "J/P/unknown",
      "confidence": { "EI": 0.8, "SN": 0.5, "TF": 0.6, "JP": 0.7 },
      "evidence": ["Prefers alone time to recharge"],
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 9. Erikson Psychosocial Stage
    erikson JSONB,
    /*
    {
      "stage": "S5_Identity/S6_Intimacy/S7_Generativity/S8_Integrity",
      "resolution": "positive/negative/in_progress",
      "confidence": 0.55,
      "evidence": ["Questioning life purpose"],
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 10. Gestalt Awareness
    gestalt JSONB,
    /*
    {
      "awareness_level": "high/medium/low",
      "contact_patterns": ["deflection", "projection", "retroflection"],
      "confidence": 0.62,
      "evidence": ["Avoids discussing emotions directly"],
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- 11. Bio-Psycho-Social Factors
    bio_psych JSONB,
    /*
    {
      "possible_factors": ["Sleep", "Stress", "Social_Isolation"],
      "confidence_by_factor": { "Sleep": 0.8, "Stress": 0.7 },
      "evidence": ["Haven't slept well in weeks"],
      "notes": "Physical health may be impacting mood",
      "last_updated": "2024-01-15T10:30:00Z"
    }
    */
    
    -- ========== INTEGRATION & SAFETY ==========
    
    -- Cross-framework integration metadata
    integration_meta JSONB,
    /*
    {
      "similarities": [{ "models": ["Big5", "DASS"], "agreement": "High anxiety confirmed" }],
      "conflicts": [{ "conflict": "Neuroticism vs Anxiety", "resolution": "..." }],
      "mild_cases": [{ "trait": "Extraversion", "interpretation": "Ambivert" }],
      "last_integration": "2024-01-15T10:30:00Z"
    }
    */
    
    -- Safety flags history (crisis/risk indicators)
    safety_flags JSONB,
    /*
    [
      { "flag": "risk", "category": "self_harm", "timestamp": "...", "message_id": "..." },
      { "flag": "none", "timestamp": "..." }
    ]
    */
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_profiles_user_id ON user_psychological_profiles(user_id);

-- ============================================================================
-- TABLE 4: FRAMEWORK ANALYSIS LOGS
-- ============================================================================
-- Detailed log of each framework LLM call (for debugging/analytics)

CREATE TABLE framework_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FKs
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
    
    -- Which framework was run
    framework_name VARCHAR(50) NOT NULL,
    -- Values: 'bigFive', 'dass', 'rse', 'darkTriad', 'crt', 
    --         'attachment', 'enneagram', 'mbti', 'erikson', 'gestalt', 'bioPsych'
    
    -- Full LLM response (JSON)
    result JSONB NOT NULL,
    
    -- Extracted for easy querying
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    evidence TEXT[], -- Array of quote strings
    
    -- LLM info
    llm_model VARCHAR(50),
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_framework_logs_message_id ON framework_analysis_logs(message_id);
CREATE INDEX idx_framework_logs_user_id ON framework_analysis_logs(user_id);
CREATE INDEX idx_framework_logs_framework ON framework_analysis_logs(framework_name);

-- ============================================================================
-- TABLE 5: TOKEN USAGE LOGS
-- ============================================================================
-- Tracks all LLM API calls for cost monitoring

CREATE TABLE token_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FKs
    user_id UUID NOT NULL, -- FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    
    -- Token counts
    total_tokens INTEGER NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    
    -- What used the tokens
    llm_model VARCHAR(50) NOT NULL, -- 'gpt-4o', 'claude-3-5-sonnet', etc.
    call_type VARCHAR(50) NOT NULL, -- 'classification', 'framework', 'advice', 'summary'
    framework_name VARCHAR(50), -- If call_type = 'framework', which one
    
    -- Cost (optional, for billing)
    cost_usd DECIMAL(10,6),
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_token_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX idx_token_logs_session_id ON token_usage_logs(session_id);
CREATE INDEX idx_token_logs_created_at ON token_usage_logs(created_at DESC);

-- ============================================================================
-- SUMMARY: TABLES & FOREIGN KEYS NEEDED
-- ============================================================================
/*
TABLES CREATED BY THIS SCHEMA:
  1. chat_sessions
  2. chat_messages
  3. user_psychological_profiles
  4. framework_analysis_logs
  5. token_usage_logs

FOREIGN KEYS NEEDED FROM MAIN DB:
  ┌─────────────────────────────────┬──────────────────────────────────┐
  │ Our Table                       │ FK Needed                        │
  ├─────────────────────────────────┼──────────────────────────────────┤
  │ chat_sessions.user_id           │ → users(id) ON DELETE CASCADE    │
  │ chat_messages.user_id           │ → users(id) ON DELETE CASCADE    │
  │ user_psychological_profiles     │ → users(id) ON DELETE CASCADE    │
  │   .user_id                      │                                  │
  │ framework_analysis_logs.user_id │ → users(id) ON DELETE CASCADE    │
  │ token_usage_logs.user_id        │ → users(id) ON DELETE CASCADE    │
  └─────────────────────────────────┴──────────────────────────────────┘

TO ADD FOREIGN KEYS (after users table exists):
  ALTER TABLE chat_sessions 
    ADD CONSTRAINT fk_chat_sessions_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  ALTER TABLE chat_messages 
    ADD CONSTRAINT fk_chat_messages_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  ALTER TABLE user_psychological_profiles 
    ADD CONSTRAINT fk_user_profiles_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  ALTER TABLE framework_analysis_logs 
    ADD CONSTRAINT fk_framework_logs_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  ALTER TABLE token_usage_logs 
    ADD CONSTRAINT fk_token_logs_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
*/
