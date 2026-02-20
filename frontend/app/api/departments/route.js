import { getPool } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const [depts, specs] = await Promise.all([
      pool.query('SELECT * FROM lms_departments WHERE is_active=true ORDER BY name'),
      pool.query('SELECT * FROM lms_specialties WHERE is_active=true ORDER BY name'),
    ]);
    return Response.json({ departments: depts.rows, specialties: specs.rows });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { name, description } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_departments (name, description) VALUES ($1,$2) RETURNING *',
      [name.trim(), description || null]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return Response.json({ error: 'Department already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
