-- ============================================================================
-- AI ALCHEMIST - DATABASE SCHEMA
-- ============================================================================
-- This schema supports the psychological analysis chat system.
-- Designed for PostgreSQL with future authentication/subscription support.
-- ============================================================================

-- ============================================================================
-- SECTION 1: USER & AUTHENTICATION (For Future Implementation)
-- ============================================================================

-- Users table - core user identity
-- Currently uses anonymous UUID: '00000000-0000-0000-0000-000000000000'
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    
    -- Profile info
    display_name VARCHAR(100),
    avatar_url TEXT,
    
    -- Auth provider info (for OAuth)
    auth_provider VARCHAR(50), -- 'email', 'google', 'apple', 'github'
    auth_provider_id VARCHAR(255),
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT users_auth_provider_unique UNIQUE (auth_provider, auth_provider_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- SECTION 2: SUBSCRIPTION & TIERS
-- ============================================================================

-- Subscription tiers enum
CREATE TYPE subscription_tier AS ENUM ('FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- User subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscription details
    tier subscription_tier DEFAULT 'FREE',
    
    -- Billing cycle
    billing_cycle_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    billing_cycle_end TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking (resets each billing cycle)
    tokens_used INTEGER DEFAULT 0,
    premium_replies_used INTEGER DEFAULT 0,
    
    -- Payment info (Stripe integration)
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT user_subscriptions_user_unique UNIQUE (user_id)
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX idx_user_subscriptions_billing_end ON user_subscriptions(billing_cycle_end);

-- Subscription tier configuration (reference table)
CREATE TABLE subscription_tier_config (
    tier subscription_tier PRIMARY KEY,
    price_monthly DECIMAL(10,2) NOT NULL,
    tokens_included INTEGER NOT NULL,
    framework_cap INTEGER NOT NULL,
    premium_replies_included INTEGER DEFAULT 0, -- -1 = unlimited
    overage_cost_per_1k DECIMAL(10,4),
    premium_reply_cost DECIMAL(10,2),
    default_model VARCHAR(50) NOT NULL,
    allows_premium_by_default BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default tier configurations
INSERT INTO subscription_tier_config (tier, price_monthly, tokens_included, framework_cap, premium_replies_included, overage_cost_per_1k, premium_reply_cost, default_model, allows_premium_by_default, description) VALUES
('FREE', 0, 100000, 11, 0, 0.01, 0, 'gpt-4o', FALSE, 'Free tier with basic access'),
('STARTER', 4, 400000, 11, 0, 0.012, 0.50, 'gpt-4o', FALSE, 'Starter tier for casual users'),
('PRO', 15, 1500000, 11, 10, 0.009, 0.30, 'gpt-4o', FALSE, 'Pro tier for regular users'),
('BUSINESS', 59, 6000000, 11, -1, 0.006, 0, 'gpt-4o', TRUE, 'Business tier with premium features'),
('ENTERPRISE', 199, 20000000, 11, -1, 0.004, 0, 'gpt-4o', TRUE, 'Enterprise tier with unlimited premium');

-- ============================================================================
-- SECTION 3: CHAT SESSIONS & MESSAGES
-- ============================================================================

-- Chat sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session info
    title VARCHAR(255),
    selected_llm VARCHAR(50) DEFAULT 'gpt-4o',
    
    -- Session state
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    
    -- Current psychological profile (JSON snapshot)
    current_profile JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_last_activity ON chat_sessions(last_activity DESC);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX idx_chat_sessions_user_active ON chat_sessions(user_id, is_active);

-- Chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- Ordering
    sequence_number INTEGER NOT NULL,
    
    -- Assistant message metadata (null for user messages)
    selected_llm VARCHAR(50),
    reasoning TEXT, -- Internal reasoning/chain-of-thought
    
    -- Analysis results (JSON)
    analysis JSONB,
    recommendations JSONB,
    profile_snapshot JSONB, -- Psychological profile at this point
    
    -- Frameworks that were triggered for this message
    frameworks_triggered TEXT[], -- Array of framework names
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_session_sequence ON chat_messages(session_id, sequence_number);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- ============================================================================
-- SECTION 4: PSYCHOLOGICAL PROFILES (Accumulated Over Sessions)
-- ============================================================================

-- Master psychological profile per user (accumulated over all sessions)
CREATE TABLE user_psychological_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Big Five personality traits (accumulated averages)
    big_five JSONB,
    -- Structure: { openness, conscientiousness, extraversion, agreeableness, neuroticism, confidence, last_updated }
    
    -- DASS-42 emotional state (most recent)
    dass JSONB,
    -- Structure: { depression, anxiety, stress, concerns, confidence, last_updated }
    
    -- Rosenberg Self-Esteem
    rse JSONB,
    -- Structure: { level, indicators, confidence, last_updated }
    
    -- Dark Triad
    dark_triad JSONB,
    -- Structure: { machiavellianism, narcissism, psychopathy, insights, confidence, last_updated }
    
    -- Cognitive Reflection Test
    crt JSONB,
    -- Structure: { thinkingStyle, systemPreference, insights, confidence, last_updated }
    
    -- Attachment Style
    attachment JSONB,
    -- Structure: { style, confidence, evidence, last_updated }
    
    -- Enneagram
    enneagram JSONB,
    -- Structure: { primary_type, wing, confidence, evidence, last_updated }
    
    -- MBTI
    mbti JSONB,
    -- Structure: { EI, SN, TF, JP, confidence, evidence, last_updated }
    
    -- Erikson Psychosocial Stage
    erikson JSONB,
    -- Structure: { stage, resolution, confidence, evidence, last_updated }
    
    -- Gestalt Awareness
    gestalt JSONB,
    -- Structure: { awareness_level, contact_patterns, confidence, evidence, last_updated }
    
    -- Bio-Psycho-Social factors
    bio_psych JSONB,
    -- Structure: { factors, confidence, evidence, last_updated }
    
    -- Integration metadata
    integration_meta JSONB,
    -- Structure: { similarities, conflicts, mild_cases, last_integration }
    
    -- Safety flags history
    safety_flags JSONB,
    -- Structure: [{ flag, category, timestamp, message_id }]
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT user_profiles_user_unique UNIQUE (user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_psychological_profiles(user_id);

-- ============================================================================
-- SECTION 5: FRAMEWORK ANALYSIS LOGS (Detailed Per-Message Analysis)
-- ============================================================================

-- Detailed log of each framework analysis
CREATE TABLE framework_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Framework info
    framework_name VARCHAR(50) NOT NULL,
    -- Values: 'bigFive', 'dass', 'rse', 'darkTriad', 'crt', 'attachment', 'enneagram', 'mbti', 'erikson', 'gestalt', 'bioPsych'
    
    -- Analysis result (full JSON from LLM)
    result JSONB NOT NULL,
    
    -- Confidence score (extracted for easy querying)
    confidence DECIMAL(3,2),
    
    -- Evidence quotes (extracted for easy querying)
    evidence TEXT[],
    
    -- LLM used for this analysis
    llm_model VARCHAR(50),
    
    -- Token usage for this specific call
    tokens_used INTEGER DEFAULT 0,
    
    -- Timing
    latency_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_framework_logs_message_id ON framework_analysis_logs(message_id);
CREATE INDEX idx_framework_logs_session_id ON framework_analysis_logs(session_id);
CREATE INDEX idx_framework_logs_user_id ON framework_analysis_logs(user_id);
CREATE INDEX idx_framework_logs_framework ON framework_analysis_logs(framework_name);
CREATE INDEX idx_framework_logs_confidence ON framework_analysis_logs(confidence DESC);

-- ============================================================================
-- SECTION 6: TOKEN USAGE & BILLING
-- ============================================================================

-- Detailed token usage log
CREATE TABLE token_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    
    -- Token counts
    total_tokens INTEGER NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    
    -- What used the tokens
    llm_model VARCHAR(50) NOT NULL,
    call_type VARCHAR(50) NOT NULL, -- 'classification', 'framework', 'advice', 'summary'
    framework_name VARCHAR(50), -- If call_type = 'framework'
    
    -- Cost calculation
    cost_usd DECIMAL(10,6),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_token_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX idx_token_logs_session_id ON token_usage_logs(session_id);
CREATE INDEX idx_token_logs_created_at ON token_usage_logs(created_at DESC);
CREATE INDEX idx_token_logs_user_date ON token_usage_logs(user_id, created_at);

-- Premium reply usage tracking
CREATE TABLE premium_reply_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    
    -- Premium model used
    llm_model VARCHAR(50) NOT NULL,
    
    -- Cost (if overage)
    cost_usd DECIMAL(10,4) DEFAULT 0,
    was_overage BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_premium_logs_user_id ON premium_reply_logs(user_id);
CREATE INDEX idx_premium_logs_created_at ON premium_reply_logs(created_at DESC);

-- ============================================================================
-- SECTION 7: KNOWLEDGE BASE MANAGEMENT
-- ============================================================================

-- KB prompts versioning (for A/B testing and rollback)
CREATE TABLE kb_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_name VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Prompt content
    prompt_content TEXT NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    avg_confidence DECIMAL(3,2),
    total_uses INTEGER DEFAULT 0,
    
    -- Metadata
    description TEXT,
    created_by VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT kb_prompts_framework_version_unique UNIQUE (framework_name, version)
);

CREATE INDEX idx_kb_prompts_framework ON kb_prompts(framework_name);
CREATE INDEX idx_kb_prompts_active ON kb_prompts(framework_name, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SECTION 8: SYSTEM CONFIGURATION & AUDIT
-- ============================================================================

-- System configuration key-value store
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100)
);

-- Audit log for important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action info
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- 'user', 'session', 'subscription', etc.
    entity_id UUID,
    
    -- Change details
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- SECTION 9: HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_psychological_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update session message count and last_activity
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions 
    SET 
        message_count = message_count + 1,
        last_activity = NOW(),
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_on_new_message AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_on_message();

-- ============================================================================
-- SECTION 10: VIEWS FOR COMMON QUERIES
-- ============================================================================

-- User dashboard view
CREATE VIEW user_dashboard AS
SELECT 
    u.id AS user_id,
    u.email,
    u.display_name,
    us.tier,
    us.tokens_used,
    stc.tokens_included,
    us.premium_replies_used,
    stc.premium_replies_included,
    (SELECT COUNT(*) FROM chat_sessions cs WHERE cs.user_id = u.id AND cs.is_active = TRUE) AS active_sessions,
    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.user_id = u.id) AS total_messages,
    u.last_login_at,
    u.created_at
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
LEFT JOIN subscription_tier_config stc ON us.tier = stc.tier;

-- Session summary view
CREATE VIEW session_summaries AS
SELECT 
    cs.id AS session_id,
    cs.user_id,
    cs.title,
    cs.selected_llm,
    cs.message_count,
    cs.created_at,
    cs.last_activity,
    (SELECT content FROM chat_messages cm WHERE cm.session_id = cs.id ORDER BY sequence_number DESC LIMIT 1) AS last_message,
    (SELECT jsonb_object_keys(cs.current_profile) FROM generate_series(1,1)) AS active_frameworks
FROM chat_sessions cs
WHERE cs.is_active = TRUE;

-- ============================================================================
-- NOTES FOR IMPLEMENTATION
-- ============================================================================
/*
CURRENT STATE (Auth Removed):
- All users use anonymous UUID: '00000000-0000-0000-0000-000000000000'
- No tier restrictions (all frameworks run)
- No token tracking enforcement

WHEN ADDING AUTH BACK:
1. Create users record on signup
2. Create user_subscriptions record (default FREE tier)
3. Update chat.service.ts to use real user_id from auth token
4. Enable CreditGuard and RateLimitGuard
5. Re-enable framework cap logic in parallel-llm.service.ts

FOREIGN KEY RELATIONSHIPS:
- users (1) -> user_subscriptions (1)
- users (1) -> chat_sessions (many)
- users (1) -> user_psychological_profiles (1)
- chat_sessions (1) -> chat_messages (many)
- chat_messages (1) -> framework_analysis_logs (many)
- users (1) -> token_usage_logs (many)
- users (1) -> premium_reply_logs (many)
- users (1) -> audit_logs (many)

INDEXES STRATEGY:
- Primary lookups: user_id, session_id, message_id
- Time-based queries: created_at, last_activity
- Filtering: tier, is_active, framework_name

JSONB COLUMNS:
- Used for flexible schema (psychological profiles evolve)
- Can add GIN indexes if needed for JSON queries:
  CREATE INDEX idx_profiles_big_five ON user_psychological_profiles USING GIN (big_five);
*/
