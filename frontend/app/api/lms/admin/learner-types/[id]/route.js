import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { name, description, is_active } = await request.json();
  try {
    const pool = getPool();
    const result = await pool.query(`
      UPDATE lms_learner_types
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          is_active = COALESCE($3, is_active),
          updated_at = NOW()
      WHERE id = $4 RETURNING *
    `, [name?.trim(), description, is_active, id]);
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return Response.json({ error: 'Name already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
