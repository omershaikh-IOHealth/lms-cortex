-- ============================================================================
-- Migration 001: Departments, Specialties, Staff ID, Trainer role, Calendar
-- Safe to run on BOTH fresh databases (after 000) and existing databases
-- ============================================================================

-- 1. Add new columns to auth_users (safe — IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='test' AND table_name='auth_users' AND column_name='staff_id') THEN
    ALTER TABLE auth_users ADD COLUMN staff_id VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='test' AND table_name='auth_users' AND column_name='departments') THEN
    ALTER TABLE auth_users ADD COLUMN departments TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='test' AND table_name='auth_users' AND column_name='specialties') THEN
    ALTER TABLE auth_users ADD COLUMN specialties TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 2. Update role constraint to include 'trainer' (drop + re-add is idempotent)
ALTER TABLE auth_users DROP CONSTRAINT IF EXISTS auth_users_role_check;
ALTER TABLE auth_users ADD CONSTRAINT auth_users_role_check
  CHECK (role IN ('admin', 'support', 'training', 'learner', 'trainer'));

-- 3. Create reference tables (IF NOT EXISTS — safe on fresh + existing)
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

-- 4. Calendar tables
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

-- 5. Seed departments
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

-- 6. Seed specialties
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

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_auth_users_departments ON auth_users USING gin(departments);
CREATE INDEX IF NOT EXISTS idx_auth_users_specialties ON auth_users USING gin(specialties);
CREATE INDEX IF NOT EXISTS idx_auth_users_staff_id ON auth_users(staff_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON lms_calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_department ON lms_calendar_events(department);
