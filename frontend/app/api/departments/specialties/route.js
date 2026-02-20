import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { name, description } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_specialties (name, description) VALUES ($1,$2) RETURNING *',
      [name.trim(), description || null]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return Response.json({ error: 'Specialty already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
