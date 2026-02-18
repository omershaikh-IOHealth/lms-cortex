// backend/lms/seed.js
// Run: node backend/lms/seed.js
// Creates initial auth_users with proper bcrypt hashes

import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    options: '--search_path=test'
  });

const COST = 12;

const users = [
  { email: 'admin@cortex.com',   password: 'Admin@123',    role: 'admin',    name: 'System Admin',         staff_id: 'ADM-001', departments: ['Administration'],        specialties: [] },
  { email: 'ahmad@lms.com',      password: 'Training@123', role: 'training', name: 'Ahmad (Training)',      staff_id: 'TRN-001', departments: ['Administration'],        specialties: [] },
  { email: 'trainer@lms.com',    password: 'Trainer@123',  role: 'trainer',  name: 'Dr. Sarah (Trainer)',   staff_id: 'TRN-002', departments: ['Orthopedics'],           specialties: ['Orthopedic Surgeon'] },
  { email: 'ann@support.com',    password: 'Support@123',  role: 'support',  name: 'Ann (Support)',         staff_id: 'SUP-001', departments: ['Administration'],        specialties: [] },
  { email: 'doctor@lms.com',     password: 'Doctor@123',   role: 'learner',  name: 'Dr. Sample Learner',   staff_id: 'DOC-001', departments: ['Orthopedics'],           specialties: ['Orthopedic Surgeon'] },
  { email: 'nurse@lms.com',      password: 'Nurse@123',    role: 'learner',  name: 'Nurse Sample Learner', staff_id: 'NUR-001', departments: ['Pediatrics', 'Nursing'], specialties: ['Pediatric Nurse'] },
];

const learnerTypes = [
  { name: 'Doctor',        description: 'Medical doctors using the platform' },
  { name: 'Nurse',         description: 'Nursing staff' },
  { name: 'Insurance Team',description: 'Insurance case handlers' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🌱 Seeding auth_users...');
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, COST);
      await client.query(`
        INSERT INTO auth_users (email, password_hash, role, display_name, staff_id, departments, specialties)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = $2, display_name = $4, staff_id = $5,
          departments = $6, specialties = $7
      `, [u.email, hash, u.role, u.name, u.staff_id, u.departments, u.specialties]);
      console.log(`  ✅ ${u.role}: ${u.email} / ${u.password} [${u.staff_id}]`);
    }

    console.log('\n🌱 Seeding lms_learner_types...');
    const adminRow = await client.query('SELECT id FROM auth_users WHERE email = $1', ['admin@cortex.com']);
    const adminId = adminRow.rows[0]?.id;

    for (const lt of learnerTypes) {
      const res = await client.query(`
        INSERT INTO lms_learner_types (name, description, created_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET description = $2
        RETURNING id
      `, [lt.name, lt.description, adminId]);
      console.log(`  ✅ Learner type: ${lt.name} (id: ${res.rows[0].id})`);
    }

    // Assign doctor learner to Doctor type
    const doctorUser = await client.query('SELECT id FROM auth_users WHERE email = $1', ['doctor@lms.com']);
    const doctorType = await client.query('SELECT id FROM lms_learner_types WHERE name = $1', ['Doctor']);
    if (doctorUser.rows[0] && doctorType.rows[0]) {
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
      `, [doctorUser.rows[0].id, doctorType.rows[0].id, 'Dr. Sample Learner']);
      console.log('  ✅ Linked doctor@lms.com → Doctor type');
    }

    const nurseUser = await client.query('SELECT id FROM auth_users WHERE email = $1', ['nurse@lms.com']);
    const nurseType = await client.query('SELECT id FROM lms_learner_types WHERE name = $1', ['Nurse']);
    if (nurseUser.rows[0] && nurseType.rows[0]) {
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
      `, [nurseUser.rows[0].id, nurseType.rows[0].id, 'Nurse Sample Learner']);
      console.log('  ✅ Linked nurse@lms.com → Nurse type');
    }

    // Assign trainer to Doctor type profile as well
    const trainerUser = await client.query('SELECT id FROM auth_users WHERE email = $1', ['trainer@lms.com']);
    if (trainerUser.rows[0] && doctorType.rows[0]) {
      await client.query(`
        INSERT INTO lms_learner_profiles (user_id, learner_type_id, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET learner_type_id = $2
      `, [trainerUser.rows[0].id, doctorType.rows[0].id, 'Dr. Sarah (Trainer)']);
      console.log('  ✅ Linked trainer@lms.com → Doctor type');
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
