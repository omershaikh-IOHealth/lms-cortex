import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PUT(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { attendances } = await request.json();
  if (!Array.isArray(attendances) || !attendances.length)
    return Response.json({ error: 'attendances array required' }, { status: 400 });
  try {
    const pool = getPool();
    for (const a of attendances) {
      await pool.query(`
        UPDATE lms_physical_enrollments
        SET attendance_status = $1, marked_at = NOW(), marked_by = $2
        WHERE session_id = $3 AND user_id = $4
      `, [a.status, auth.user.id, id, a.user_id]);
    }
    await pool.query(`
      UPDATE lms_physical_sessions
      SET status = 'completed', updated_at = NOW()
      WHERE id = $1
        AND status NOT IN ('cancelled','completed')
        AND (scheduled_date < CURRENT_DATE
             OR (scheduled_date = CURRENT_DATE AND end_time < CURRENT_TIME))
        AND (SELECT COUNT(*) FROM lms_physical_enrollments WHERE session_id = $1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM lms_physical_enrollments
          WHERE session_id = $1 AND attendance_status = 'enrolled'
        )
    `, [id]);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
