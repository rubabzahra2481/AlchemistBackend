# AI Alchemist - Database Tables Required

## Tables Overview

| Table | Purpose |
|-------|---------|
| chat_sessions | Stores conversation sessions |
| chat_messages | Stores messages in each session |
| user_psychological_profiles | Accumulated psychological profile per user |
| framework_analysis_logs | Logs each framework LLM analysis |
| token_usage_logs | Tracks API token usage |

---

## Table 1: chat_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| user_id | UUID | **FK → users(id)** |
| title | VARCHAR(255) | |
| selected_llm | VARCHAR(50) | |
| is_active | BOOLEAN | |
| message_count | INTEGER | |
| current_profile | JSONB | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| last_activity | TIMESTAMP | |

---

## Table 2: chat_messages

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| session_id | UUID | FK → chat_sessions(id) |
| user_id | UUID | **FK → users(id)** |
| role | VARCHAR(20) | 'user' or 'assistant' |
| content | TEXT | |
| sequence_number | INTEGER | |
| selected_llm | VARCHAR(50) | |
| reasoning | TEXT | |
| analysis | JSONB | |
| recommendations | JSONB | |
| profile_snapshot | JSONB | |
| frameworks_triggered | TEXT[] | |
| created_at | TIMESTAMP | |

---

## Table 3: user_psychological_profiles

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| user_id | UUID | **FK → users(id)** UNIQUE |
| big_five | JSONB | |
| dass | JSONB | |
| rse | JSONB | |
| dark_triad | JSONB | |
| crt | JSONB | |
| attachment | JSONB | |
| enneagram | JSONB | |
| mbti | JSONB | |
| erikson | JSONB | |
| gestalt | JSONB | |
| bio_psych | JSONB | |
| integration_meta | JSONB | |
| safety_flags | JSONB | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## Table 4: framework_analysis_logs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| message_id | UUID | FK → chat_messages(id) |
| session_id | UUID | FK → chat_sessions(id) |
| user_id | UUID | **FK → users(id)** |
| framework_name | VARCHAR(50) | |
| result | JSONB | |
| confidence | DECIMAL(3,2) | |
| evidence | TEXT[] | |
| llm_model | VARCHAR(50) | |
| tokens_used | INTEGER | |
| latency_ms | INTEGER | |
| created_at | TIMESTAMP | |

---

## Table 5: token_usage_logs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| user_id | UUID | **FK → users(id)** |
| session_id | UUID | FK → chat_sessions(id) |
| total_tokens | INTEGER | |
| input_tokens | INTEGER | |
| output_tokens | INTEGER | |
| llm_model | VARCHAR(50) | |
| call_type | VARCHAR(50) | |
| framework_name | VARCHAR(50) | |
| cost_usd | DECIMAL(10,6) | |
| created_at | TIMESTAMP | |

---

## Foreign Keys Needed

| Our Table | Column | References |
|-----------|--------|------------|
| chat_sessions | user_id | users(id) |
| chat_messages | user_id | users(id) |
| user_psychological_profiles | user_id | users(id) |
| framework_analysis_logs | user_id | users(id) |
| token_usage_logs | user_id | users(id) |

All with `ON DELETE CASCADE`
