import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { scheduled_date, start_time, end_time } = await request.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE lms_physical_enrollments SET attendance_status = 'enrolled', marked_at = NULL, marked_by = NULL WHERE session_id = $1`, [id]
    );
    await client.query(`
      UPDATE lms_physical_sessions SET
        status         = 'scheduled',
        scheduled_date = COALESCE($1, scheduled_date),
        start_time     = COALESCE($2, start_time),
        end_time       = COALESCE($3, end_time),
        updated_at     = NOW()
      WHERE id = $4
    `, [scheduled_date || null, start_time || null, end_time || null, id]);
    await client.query('COMMIT');
    return Response.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: err.message }, { status: 500 });
  } finally { client.release(); }
}
