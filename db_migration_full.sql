-- ============================================================
-- Cortex LMS — Full Migration SQL
-- Run this in your Supabase/PostgreSQL SQL editor (test schema)
-- All statements use IF NOT EXISTS / IF EXISTS for safety
-- ============================================================

-- ── 1. Training Sessions: session_mode field ──────────────────
ALTER TABLE test.lms_physical_sessions
  ADD COLUMN IF NOT EXISTS session_mode VARCHAR DEFAULT 'in_person';
-- Values: 'in_person' | 'online'

-- ── 2. Departments: parent_id (sub-dept) and company_id ───────
ALTER TABLE test.lms_departments
  ADD COLUMN IF NOT EXISTS parent_id  INTEGER REFERENCES test.lms_departments(id),
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES test.companies(id);

-- ── 3. Users: department columns and password reset ───────────
ALTER TABLE test.auth_users
  ADD COLUMN IF NOT EXISTS department_id     INTEGER REFERENCES test.lms_departments(id),
  ADD COLUMN IF NOT EXISTS sub_department_id INTEGER REFERENCES test.lms_departments(id),
  ADD COLUMN IF NOT EXISTS password_reset_token   TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires  TIMESTAMPTZ;

-- ── 4. Physical sessions: Google Meet / Calendar links ────────
--    (may already exist if you ran a previous migration)
ALTER TABLE test.lms_physical_sessions
  ADD COLUMN IF NOT EXISTS google_meet_link         TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR,
  ADD COLUMN IF NOT EXISTS google_calendar_link     TEXT;

-- ── 5. Physical enrollments: re-ack support ───────────────────
ALTER TABLE test.lms_physical_enrollments
  ADD COLUMN IF NOT EXISTS last_session_updated_at TIMESTAMPTZ;

-- ── 6. Lesson progress: first-viewed tracking ─────────────────
ALTER TABLE test.lms_user_lesson_progress
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;

-- ── 7. Lesson assignments: notification timestamp ─────────────
ALTER TABLE test.lms_lesson_assignments
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- ── 8. Users: can_upload_content flag ─────────────────────────
ALTER TABLE test.auth_users
  ADD COLUMN IF NOT EXISTS can_upload_content BOOLEAN DEFAULT false;

-- ── 9. Feedback table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.lms_feedback (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES test.auth_users(id) ON DELETE CASCADE,
  reference_type  VARCHAR NOT NULL,   -- 'session' | 'course'
  reference_id    INTEGER NOT NULL,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, reference_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_feedback_reference
  ON test.lms_feedback (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_lms_feedback_user
  ON test.lms_feedback (user_id);

-- ── 10. Session messages table ────────────────────────────────
--    (for the chat feature in training sessions)
CREATE TABLE IF NOT EXISTS test.lms_session_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES test.lms_physical_sessions(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES test.auth_users(id) ON DELETE CASCADE,
  message     TEXT    NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lms_session_messages_session
  ON test.lms_session_messages (session_id, created_at);

-- ── 11. Facility field on training sessions ───────────────────
ALTER TABLE test.lms_physical_sessions
  ADD COLUMN IF NOT EXISTS facility VARCHAR;
-- Stores the building/site name independently of the room 'location' field.
-- Example values: 'Main Hospital', 'Clinic A', 'Simulation Lab', 'Conference Hall B'

-- ── 12. Request type and detail on feedback ───────────────────
ALTER TABLE test.lms_feedback
  ADD COLUMN IF NOT EXISTS request_type VARCHAR;
-- Allows categorising feedback as a follow-up request
-- e.g. 'repeat_session', 'additional_resources', 'topic_request'

ALTER TABLE test.lms_feedback
  ADD COLUMN IF NOT EXISTS request_detail TEXT;
-- Free-text elaboration of the request_type selected above.

-- ── 13. Coming Soon courses flag ─────────────────────────────
ALTER TABLE test.lms_courses
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN DEFAULT false;
-- When true + is_active = false, course shows as "Coming Soon" to learners.
-- Set is_active = false so it doesn't appear in the active curriculum.

-- ── 14. AI Companion sessions table ──────────────────────────
CREATE TABLE IF NOT EXISTS test.ai_companion_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL UNIQUE,
  messages   JSONB DEFAULT '[]'::jsonb,
  summary    TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ── 14. Physical sessions: Google Chat space ──────────────────
ALTER TABLE test.lms_physical_sessions
  ADD COLUMN IF NOT EXISTS google_chat_space_id TEXT;

-- ── 15. Physical enrollments: Google RSVP status ─────────────
ALTER TABLE test.lms_physical_enrollments
  ADD COLUMN IF NOT EXISTS google_rsvp_status VARCHAR DEFAULT 'pending';

-- ── 16. Users: registration status ───────────────────────────
ALTER TABLE test.auth_users
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR DEFAULT 'active';
-- Values: 'active' | 'pending' | 'rejected'

-- ── Done ──────────────────────────────────────────────────────
-- After running, verify with:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'test' AND table_name = 'lms_physical_sessions';
