import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({
  host:     'aws-1-ap-northeast-1.pooler.supabase.com',
  port:     6543,
  database: 'postgres',
  user:     'postgres.alobxvlwznumwikxqewb',
  password: 'dS7R-v.Cu9-#Mf$',
  ssl: { rejectUnauthorized: false },
  options:  '--search_path=test'
});

const users = [
  { email: 'admin@cortex.com',     password: 'Admin@123',    role: 'admin',    display_name: 'Admin User' },
  { email: 'ahmad@lms.com',        password: 'Training@123', role: 'training', display_name: 'Ahmad (Training)' },
  { email: 'ann@support.com',      password: 'Support@123',  role: 'support',  display_name: 'Ann (Support)' },
  { email: 'doctor@lms.com',       password: 'Doctor@123',   role: 'learner',  display_name: 'Doctor Learner' },
  { email: 'nurse@lms.com',        password: 'Nurse@123',    role: 'learner',  display_name: 'Nurse Learner' },
  { email: 'trainer@cortex.com',   password: 'Trainer@123',  role: 'trainer',  display_name: 'Main Trainer' },
];

console.log('Seeding users...');
for (const u of users) {
  const hash = await bcrypt.hash(u.password, 10);
  try {
    await pool.query(
      `INSERT INTO auth_users (email, password_hash, role, display_name, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO UPDATE SET password_hash=$2, role=$3, display_name=$4, is_active=true`,
      [u.email, hash, u.role, u.display_name]
    );
    console.log(`✅ ${u.role.padEnd(10)} ${u.email}`);
  } catch (e) {
    console.log(`❌ ${u.email}: ${e.message}`);
  }
}

await pool.end();
console.log('\nDone! You can now login with the credentials above.');
