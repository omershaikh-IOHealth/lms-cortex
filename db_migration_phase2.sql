-- ============================================================
-- Cortex LMS — Phase 2 Migrations
-- Run this file on your Supabase database (test schema)
-- ============================================================

-- 1. Facilities table
CREATE SEQUENCE IF NOT EXISTS test.lms_facilities_id_seq;

CREATE TABLE IF NOT EXISTS test.lms_facilities (
  id            integer NOT NULL DEFAULT nextval('test.lms_facilities_id_seq'::regclass),
  company_id    integer NOT NULL,
  name          character varying NOT NULL,
  location      character varying,
  facility_type character varying CHECK (facility_type IN ('clinic','hospital','pharmacy','daycare','other')),
  facility_code character varying,
  is_active     boolean DEFAULT true,
  created_at    timestamp without time zone DEFAULT now(),
  updated_at    timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_facilities_pkey PRIMARY KEY (id),
  CONSTRAINT lms_facilities_company_id_fkey FOREIGN KEY (company_id) REFERENCES test.companies(id)
);

-- 2. Course assignments table
CREATE SEQUENCE IF NOT EXISTS test.lms_course_assignments_id_seq;

CREATE TABLE IF NOT EXISTS test.lms_course_assignments (
  id               integer NOT NULL DEFAULT nextval('test.lms_course_assignments_id_seq'::regclass),
  course_id        integer NOT NULL,
  assigned_to_type character varying NOT NULL CHECK (assigned_to_type IN ('organization','facility','department','learner_type')),
  assigned_to_id   integer NOT NULL,
  assigned_by      uuid,
  due_date         date,
  created_at       timestamp without time zone DEFAULT now(),
  CONSTRAINT lms_course_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT lms_course_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES test.lms_courses(id),
  CONSTRAINT lms_course_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES test.auth_users(id)
);

-- 3. Quiz mandatory flag
ALTER TABLE test.lms_quizzes ADD COLUMN IF NOT EXISTS is_mandatory boolean DEFAULT false;
