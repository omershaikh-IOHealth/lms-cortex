import { getPool } from '@/lib/db';
import { requireRole, hashPassword } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireRole(request, 'admin');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT id, email, display_name, role, staff_id, departments, specialties, is_active, created_at
      FROM auth_users
      WHERE role != 'learner'
      ORDER BY display_name
    `);
    return Response.json(r.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = requireRole(request, 'admin');
  if (auth.error) return auth.response;
  const { email, password, display_name, role, staff_id, departments = [], specialties = [] } = await request.json();
  if (!email || !password || !role) return Response.json({ error: 'email, password, role required' }, { status: 400 });
  const validRoles = ['admin', 'training', 'trainer', 'support'];
  if (!validRoles.includes(role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
  try {
    const pool = getPool();
    const hash = await hashPassword(password);
    const r = await pool.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name, staff_id, departments, specialties)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, display_name, role, staff_id, is_active
    `, [email.toLowerCase().trim(), hash, role, display_name || null, staff_id || null, departments, specialties]);
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return Response.json({ error: 'Email already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
