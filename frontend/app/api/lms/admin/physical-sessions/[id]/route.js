import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { title, description, location, trainer_id, scheduled_date, start_time, end_time, max_capacity, status } = await request.json();
  try {
    const pool = getPool();
    const result = await pool.query(`
      UPDATE lms_physical_sessions SET
        title          = COALESCE($1, title),
        description    = COALESCE($2, description),
        location       = COALESCE($3, location),
        trainer_id     = COALESCE($4, trainer_id),
        scheduled_date = COALESCE($5, scheduled_date),
        start_time     = COALESCE($6, start_time),
        end_time       = COALESCE($7, end_time),
        max_capacity   = COALESCE($8, max_capacity),
        status         = COALESCE($9, status),
        updated_at     = NOW()
      WHERE id = $10 RETURNING *
    `, [title?.trim(), description, location, trainer_id,
        scheduled_date, start_time, end_time, max_capacity, status, id]);
    if (!result.rows[0]) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    await pool.query('DELETE FROM lms_physical_sessions WHERE id = $1', [id]);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
