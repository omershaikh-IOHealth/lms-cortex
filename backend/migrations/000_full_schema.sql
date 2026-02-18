-- ============================================================================
-- Cortex LMS — Complete Database Setup for Supabase / Fresh PostgreSQL
-- Run this ONCE on a fresh database via the Supabase SQL Editor
-- ============================================================================

-- 1. Create the schema
CREATE SCHEMA IF NOT EXISTS test;
SET search_path TO test;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_code VARCHAR(50) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  description TEXT,
  domain VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auth users — the central user table for the LMS
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'support', 'training', 'learner', 'trainer')),
  display_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  company_id INT REFERENCES companies(id),
  staff_id VARCHAR(100),
  departments TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- LMS CONTENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_courses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_sections (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES lms_courses(id) ON DELETE CASCADE,
  parent_section_id INT REFERENCES lms_sections(id),
  title VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_lessons (
  id SERIAL PRIMARY KEY,
  section_id INT REFERENCES lms_sections(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  video_url TEXT,
  manual_markdown TEXT,
  duration_seconds INT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- LEARNER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_learner_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_learner_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  learner_type_id INT REFERENCES lms_learner_types(id),
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_lesson_assignments (
  id SERIAL PRIMARY KEY,
  learner_type_id INT REFERENCES lms_learner_types(id) ON DELETE CASCADE,
  lesson_id INT REFERENCES lms_lessons(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(learner_type_id, lesson_id)
);

-- ============================================================================
-- PROGRESS & ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_user_lesson_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth_users(id),
  lesson_id INT REFERENCES lms_lessons(id),
  percent_watched NUMERIC(5,2) DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  total_watch_seconds INT DEFAULT 0,
  watch_count INT DEFAULT 0,
  last_position_seconds INT DEFAULT 0,
  last_activity_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_progress_user ON lms_user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lms_progress_lesson ON lms_user_lesson_progress(lesson_id);

CREATE TABLE IF NOT EXISTS lms_learning_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth_users(id),
  lesson_id INT REFERENCES lms_lessons(id),
  session_started_at TIMESTAMP DEFAULT NOW(),
  session_ended_at TIMESTAMP,
  total_active_seconds INT DEFAULT 0,
  total_idle_seconds INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lms_event_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES lms_learning_sessions(id),
  user_id UUID REFERENCES auth_users(id),
  lesson_id INT REFERENCES lms_lessons(id),
  event_type VARCHAR(50) NOT NULL,
  event_payload JSONB DEFAULT '{}',
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lms_events_user ON lms_event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lms_events_lesson ON lms_event_logs(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lms_events_session ON lms_event_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_lms_events_type ON lms_event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_lms_events_client_ts ON lms_event_logs(client_ts);

-- ============================================================================
-- PHYSICAL TRAINING
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_physical_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  trainer_id UUID REFERENCES auth_users(id),
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(500),
  max_capacity INT,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_by UUID REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_physical_enrollments (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES lms_physical_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  attendance_status VARCHAR(30) DEFAULT 'enrolled',
  acknowledged_at TIMESTAMP,
  marked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- DEPARTMENTS & SPECIALTIES (reference data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_specialties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- CALENDAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS lms_calendar_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(500),
  event_type VARCHAR(50) DEFAULT 'training',
  google_calendar_event_id VARCHAR(255),
  google_calendar_link TEXT,
  created_by UUID REFERENCES auth_users(id),
  department VARCHAR(200),
  specialty VARCHAR(200),
  attendee_emails TEXT[],
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_calendar_attendees (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES lms_calendar_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  response_status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ============================================================================
-- AI COMPANION (existing feature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_companion_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  messages JSONB DEFAULT '[]',
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companion_sessions_user ON ai_companion_sessions(user_id);

-- ============================================================================
-- INDEXES for filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_auth_users_departments ON auth_users USING gin(departments);
CREATE INDEX IF NOT EXISTS idx_auth_users_specialties ON auth_users USING gin(specialties);
CREATE INDEX IF NOT EXISTS idx_auth_users_staff_id ON auth_users(staff_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON lms_calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_department ON lms_calendar_events(department);

-- ============================================================================
-- SEED DATA — Departments
-- ============================================================================

INSERT INTO lms_departments (name, description) VALUES
  ('Orthopedics', 'Orthopedic surgery and treatment'),
  ('Pediatrics', 'Children and adolescent medicine'),
  ('Cardiology', 'Heart and cardiovascular system'),
  ('Radiology', 'Medical imaging and diagnostics'),
  ('Emergency Medicine', 'Emergency department and trauma'),
  ('General Surgery', 'General surgical procedures'),
  ('Internal Medicine', 'Internal medicine and diagnostics'),
  ('Nursing', 'Nursing department'),
  ('Administration', 'Hospital administration')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DATA — Specialties
-- ============================================================================

INSERT INTO lms_specialties (name, description) VALUES
  ('X-Ray Specialist', 'Radiographic imaging specialist'),
  ('MRI Technician', 'Magnetic resonance imaging technician'),
  ('Orthopedic Surgeon', 'Specialist in orthopedic surgery'),
  ('Pediatric Nurse', 'Nursing specialist in pediatrics'),
  ('Cardiac Surgeon', 'Specialist in cardiac surgery'),
  ('ER Physician', 'Emergency room physician'),
  ('Anesthesiologist', 'Specialist in anesthesia'),
  ('General Practitioner', 'General medical practitioner'),
  ('Trauma Nurse', 'Emergency and trauma nursing specialist'),
  ('Surgical Nurse', 'Operating room nursing specialist')
ON CONFLICT (name) DO NOTHING;
