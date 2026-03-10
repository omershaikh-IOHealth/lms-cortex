-- ============================================================
-- Migration: tags, announcements, quiz
-- Run against your Supabase/Postgres test schema
-- ============================================================

-- 1. Course difficulty + category
ALTER TABLE test.lms_courses
  ADD COLUMN IF NOT EXISTS difficulty  VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category    VARCHAR(100) DEFAULT NULL;

-- 2. Announcements
CREATE TABLE IF NOT EXISTS test.lms_announcements (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  body          TEXT,
  created_by    UUID REFERENCES test.auth_users(id),
  target_roles  TEXT[]  DEFAULT NULL,   -- NULL = all roles
  target_org_id INTEGER REFERENCES test.companies(id) DEFAULT NULL, -- NULL = all orgs
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 3. Quizzes
CREATE TABLE IF NOT EXISTS test.lms_quizzes (
  id              SERIAL PRIMARY KEY,
  course_id       INTEGER NOT NULL REFERENCES test.lms_courses(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL DEFAULT 'Course Quiz',
  pass_threshold  INTEGER NOT NULL DEFAULT 70, -- percent
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES test.auth_users(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test.lms_quiz_questions (
  id            SERIAL PRIMARY KEY,
  quiz_id       INTEGER NOT NULL REFERENCES test.lms_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL DEFAULT 'single', -- 'single' | 'multi'
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test.lms_quiz_options (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES test.lms_quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct  BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test.lms_quiz_attempts (
  id           SERIAL PRIMARY KEY,
  quiz_id      INTEGER NOT NULL REFERENCES test.lms_quizzes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES test.auth_users(id),
  score        INTEGER DEFAULT 0,   -- percentage 0-100
  passed       BOOLEAN DEFAULT FALSE,
  started_at   TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS test.lms_quiz_answers (
  id                SERIAL PRIMARY KEY,
  attempt_id        INTEGER NOT NULL REFERENCES test.lms_quiz_attempts(id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES test.lms_quiz_questions(id),
  selected_option_id INTEGER REFERENCES test.lms_quiz_options(id)
);
