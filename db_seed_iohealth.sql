-- ============================================================
-- IOHealth Hospital — Test Organisation Seed Data
-- Run in Supabase SQL editor (test schema)
-- Password for all test users: Cortex@2024
-- ============================================================

-- Requires pgcrypto extension (enabled by default in Supabase)

-- ── 0. Test Company ───────────────────────────────────────────
INSERT INTO test.companies (company_code, company_name, description, domain, is_active)
VALUES ('test ORG', 'Test Org', 'Test organisation for IOHealth', 'testorg.com', true)
ON CONFLICT (company_code) DO NOTHING;

-- ── 1. Main Departments (under test ORG) ─────────────────────────
INSERT INTO test.lms_departments (name, description, is_active, company_id)
SELECT t.name, t.description, true, c.id
FROM (VALUES
  ('Emergency & Critical Care',       'Emergency and critical care services'),
  ('Internal Medicine',               'General and specialty internal medicine'),
  ('Neurology & Neurosciences',       'Neurological and neurosurgical services'),
  ('Orthopedics',                     'Orthopedic surgery and rehabilitation'),
  ('General & Specialized Surgery',   'Surgical departments'),
  ('Obstetrics & Gynecology',         'Women''s health services'),
  ('Pediatrics',                      'Child and neonatal care'),
  ('Dermatology',                     'Skin health services'),
  ('Ophthalmology',                   'Eye care services'),
  ('ENT (Otolaryngology)',             'Ear, nose, and throat'),
  ('Dental',                          'Dental and oral health'),
  ('Oncology',                        'Cancer treatment and care'),
  ('Mental Health',                   'Psychiatric and psychological services'),
  ('Diagnostics & Support Services',  'Radiology, lab, pharmacy, and rehab'),
  ('Specialized Centers',             'Chronic disease and wellness centers')
) AS t(name, description)
CROSS JOIN test.companies c
WHERE c.company_code = 'test ORG'
ON CONFLICT (name) DO UPDATE SET company_id = EXCLUDED.company_id, is_active = true;

-- ── 2. Sub-Departments ───────────────────────────────────────
INSERT INTO test.lms_departments (name, description, is_active, parent_id, company_id)
SELECT sub.name, sub.description, true, p.id, p.company_id
FROM (VALUES
  ('Emergency & Critical Care', 'Emergency Medicine',            'Emergency medicine sub-department'),
  ('Emergency & Critical Care', 'Intensive Care',                'ICU services'),
  ('Internal Medicine',         'General Internal Medicine',     'General internal medicine'),
  ('Internal Medicine',         'Cardiology',                    'Heart and vascular care'),
  ('Internal Medicine',         'Endocrinology',                 'Hormonal and metabolic disorders'),
  ('Internal Medicine',         'Gastroenterology',              'Digestive system'),
  ('Internal Medicine',         'Pulmonology',                   'Respiratory medicine'),
  ('Internal Medicine',         'Nephrology',                    'Kidney care'),
  ('Internal Medicine',         'Rheumatology',                  'Joints and autoimmune'),
  ('Internal Medicine',         'Infectious Diseases',           'Infection and immunity'),
  ('Internal Medicine',         'Geriatrics',                    'Elderly care'),
  ('Neurology & Neurosciences', 'Neurology',                     'Neurological disorders'),
  ('Neurology & Neurosciences', 'Neurosurgery',                  'Brain and spine surgery'),
  ('Orthopedics',               'General Orthopedics',           'Bone and joint care'),
  ('Orthopedics',               'Orthopedic Subspecialties',     'Orthopedic subspecialties'),
  ('General & Specialized Surgery', 'General Surgery',           'General surgical procedures'),
  ('General & Specialized Surgery', 'Specialized Surgery',       'Advanced surgical specialties'),
  ('Obstetrics & Gynecology',   'Obstetrics',                    'Pregnancy and childbirth'),
  ('Obstetrics & Gynecology',   'Gynecology',                    'Women''s reproductive health'),
  ('Obstetrics & Gynecology',   'Reproductive Medicine',         'Fertility and IVF'),
  ('Pediatrics',                'General Pediatrics',            'Child health'),
  ('Pediatrics',                'Pediatric Subspecialties',      'Specialized pediatric care'),
  ('Pediatrics',                'Neonatology',                   'Newborn care'),
  ('Dermatology',               'Medical Dermatology',           'Skin conditions'),
  ('Dermatology',               'Cosmetic Dermatology',          'Aesthetic dermatology'),
  ('Ophthalmology',             'General Ophthalmology',         'Eye examinations and care'),
  ('Ophthalmology',             'Ophthalmology Subspecialties',  'Advanced eye care'),
  ('ENT (Otolaryngology)',      'General ENT',                   'General ENT services'),
  ('ENT (Otolaryngology)',      'ENT Subspecialties',            'ENT subspecialties'),
  ('Dental',                    'General Dentistry',             'Routine dental care'),
  ('Dental',                    'Dental Subspecialties',         'Orthodontics, implants, etc.'),
  ('Oncology',                  'Medical Oncology',              'Chemotherapy and systemic treatment'),
  ('Oncology',                  'Radiation Oncology',            'Radiation therapy'),
  ('Oncology',                  'Surgical Oncology',             'Cancer surgery'),
  ('Oncology',                  'Hematology',                    'Blood disorders'),
  ('Mental Health',             'Psychiatry',                    'Psychiatric evaluation and treatment'),
  ('Mental Health',             'Psychology',                    'Psychological therapy'),
  ('Mental Health',             'Addiction Medicine',            'Substance use disorders'),
  ('Diagnostics & Support Services', 'Radiology',               'Imaging and diagnostics'),
  ('Diagnostics & Support Services', 'Laboratory',              'Lab testing services'),
  ('Diagnostics & Support Services', 'Pharmacy',                'Medication management'),
  ('Diagnostics & Support Services', 'Rehabilitation',          'Physical and occupational therapy'),
  ('Specialized Centers',       'Chronic Disease Centers',       'Diabetes, hypertension, etc.'),
  ('Specialized Centers',       'Wellness & Specialty Clinics',  'Preventive care and wellness')
) AS sub(parent_name, name, description)
JOIN test.lms_departments p ON p.name = sub.parent_name AND p.parent_id IS NULL
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, company_id = EXCLUDED.company_id, is_active = true;

-- ── 3. Test Trainers ─────────────────────────────────────────
INSERT INTO test.auth_users (email, password_hash, role, display_name, is_active, company_id, staff_id, department_id)
SELECT
  t.email,
  crypt('Cortex@2024', gen_salt('bf', 10)),
  'trainer',
  t.display_name,
  true,
  c.id,
  'IOH-' || t.initials || '-' || t.seq,
  d.id
FROM (VALUES
  ('dr.ahmed.trainer@testorg.com',  'Dr. Ahmed Al-Rashid',  'AAR', '0001', 'Emergency & Critical Care'),
  ('dr.sara.trainer@testorg.com',   'Dr. Sara Mahmoud',     'SM',  '0002', 'Internal Medicine')
) AS t(email, display_name, initials, seq, dept_name)
CROSS JOIN test.companies c
JOIN test.lms_departments d ON d.name = t.dept_name AND d.parent_id IS NULL
WHERE c.company_code = 'test ORG'
ON CONFLICT (email) DO UPDATE SET
  company_id    = EXCLUDED.company_id,
  department_id = EXCLUDED.department_id,
  display_name  = EXCLUDED.display_name,
  staff_id      = EXCLUDED.staff_id;

-- ── 4. Test Learners ─────────────────────────────────────────
INSERT INTO test.auth_users (email, password_hash, role, display_name, is_active, company_id, staff_id, department_id, sub_department_id)
SELECT
  t.email,
  crypt('Cortex@2024', gen_salt('bf', 10)),
  'learner',
  t.display_name,
  true,
  c.id,
  'IOH-' || t.initials || '-' || t.seq,
  main_d.id,
  sub_d.id
FROM (VALUES
  ('ali.hassan@testorg.com',      'Ali Hassan',      'AH',  '0010', 'Emergency & Critical Care',      'Emergency Medicine'),
  ('fatima.noor@testorg.com',     'Fatima Noor',     'FN',  '0011', 'Emergency & Critical Care',      'Intensive Care'),
  ('omar.karimi@testorg.com',     'Omar Karimi',     'OK',  '0012', 'Internal Medicine',              'Cardiology'),
  ('layla.mansoor@testorg.com',   'Layla Mansoor',   'LM',  '0013', 'Internal Medicine',              'Gastroenterology'),
  ('hassan.zayed@testorg.com',    'Hassan Zayed',    'HZ',  '0014', 'Internal Medicine',              'Pulmonology'),
  ('aisha.saleh@testorg.com',     'Aisha Saleh',     'AS',  '0015', 'Neurology & Neurosciences',      'Neurology'),
  ('khalid.ibrahim@testorg.com',  'Khalid Ibrahim',  'KI',  '0016', 'Neurology & Neurosciences',      'Neurosurgery'),
  ('maryam.farid@testorg.com',    'Maryam Farid',    'MF',  '0017', 'Pediatrics',                     'General Pediatrics'),
  ('youssef.adel@testorg.com',    'Youssef Adel',    'YA',  '0018', 'Pediatrics',                     'Neonatology'),
  ('nadia.hussein@testorg.com',   'Nadia Hussein',   'NH',  '0019', 'Oncology',                       'Medical Oncology'),
  ('tariq.ali@testorg.com',       'Tariq Ali',       'TA',  '0020', 'Oncology',                       'Hematology'),
  ('sara.qasim@testorg.com',      'Sara Qasim',      'SQ',  '0021', 'Mental Health',                  'Psychiatry'),
  ('bilal.omar@testorg.com',      'Bilal Omar',      'BO',  '0022', 'Mental Health',                  'Psychology'),
  ('hana.jaber@testorg.com',      'Hana Jaber',      'HJ',  '0023', 'Diagnostics & Support Services', 'Radiology'),
  ('rami.khalil@testorg.com',     'Rami Khalil',     'RK',  '0024', 'Diagnostics & Support Services', 'Pharmacy'),
  ('dina.fawzi@testorg.com',      'Dina Fawzi',      'DF',  '0025', 'Orthopedics',                    'General Orthopedics'),
  ('samir.nassar@testorg.com',    'Samir Nassar',    'SN',  '0026', 'General & Specialized Surgery',  'General Surgery'),
  ('leila.taha@testorg.com',      'Leila Taha',      'LT',  '0027', 'Obstetrics & Gynecology',        'Obstetrics'),
  ('karim.fouad@testorg.com',     'Karim Fouad',     'KF',  '0028', 'Dermatology',                    'Medical Dermatology'),
  ('nour.badr@testorg.com',       'Nour Badr',       'NB',  '0029', 'Ophthalmology',                  'General Ophthalmology')
) AS t(email, display_name, initials, seq, main_dept, sub_dept)
CROSS JOIN test.companies c
JOIN test.lms_departments main_d ON main_d.name = t.main_dept AND main_d.parent_id IS NULL
JOIN test.lms_departments sub_d  ON sub_d.name  = t.sub_dept  AND sub_d.parent_id = main_d.id
WHERE c.company_code = 'test ORG'
ON CONFLICT (email) DO UPDATE SET
  company_id        = EXCLUDED.company_id,
  department_id     = EXCLUDED.department_id,
  sub_department_id = EXCLUDED.sub_department_id,
  display_name      = EXCLUDED.display_name,
  staff_id          = EXCLUDED.staff_id;

-- ── 5. Enroll test users in existing sessions ─────────────────
INSERT INTO test.lms_physical_enrollments (session_id, user_id, attendance_status, enrolled_by)
SELECT
  s.id AS session_id,
  u.id AS user_id,
  CASE
    WHEN s.scheduled_date < CURRENT_DATE THEN
      CASE (RANDOM() * 2)::int
        WHEN 0 THEN 'present'
        WHEN 1 THEN 'absent'
        ELSE 'present'
      END
    ELSE 'enrolled'
  END AS attendance_status,
  (SELECT id FROM test.auth_users WHERE role = 'admin' LIMIT 1) AS enrolled_by
FROM (
  SELECT id, scheduled_date
  FROM test.lms_physical_sessions
  WHERE status != 'cancelled'
  ORDER BY scheduled_date DESC
  LIMIT 6
) s
CROSS JOIN (
  SELECT u.id FROM test.auth_users u
  JOIN test.companies c ON u.company_id = c.id
  WHERE c.company_code = 'test ORG' AND u.role = 'learner'
) u
ON CONFLICT DO NOTHING;

-- ── 6. Feedback from some test users ─────────────────────────
INSERT INTO test.lms_feedback (user_id, reference_type, reference_id, rating, comment)
SELECT
  u.id,
  'session',
  s.id,
  (FLOOR(RANDOM() * 3) + 3)::smallint,
  CASE (FLOOR(RANDOM() * 4))::int
    WHEN 0 THEN 'Very informative session, great delivery.'
    WHEN 1 THEN 'Good content, would benefit from more hands-on practice.'
    WHEN 2 THEN 'Excellent trainer, clear explanations throughout.'
    ELSE NULL
  END
FROM (
  SELECT id FROM test.lms_physical_sessions
  WHERE scheduled_date < CURRENT_DATE AND status != 'cancelled'
  ORDER BY scheduled_date DESC LIMIT 4
) s
CROSS JOIN (
  SELECT u.id FROM test.auth_users u
  JOIN test.companies c ON u.company_id = c.id
  WHERE c.company_code = 'test ORG' AND u.role = 'learner'
  LIMIT 10
) u
ON CONFLICT (user_id, reference_type, reference_id) DO NOTHING;

-- ── Done ─────────────────────────────────────────────────────
-- Verify with:
--   SELECT company_name, COUNT(u.id) AS users
--   FROM test.companies co
--   LEFT JOIN test.auth_users u ON u.company_id = co.id
--   WHERE co.company_code = 'test ORG'
--   GROUP BY company_name;
--
-- Expected: IOHealth Test | 22
--
-- Login with any test user: email from above, password: Cortex@2024
