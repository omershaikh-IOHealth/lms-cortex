import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireRole(request, 'trainer', 'admin', 'training');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT ps.*,
        COUNT(pe.id)::int AS enrolled_count,
        COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'present')::int AS present_count,
        COUNT(pe.id) FILTER (WHERE pe.attendance_status = 'absent')::int  AS absent_count
      FROM lms_physical_sessions ps
      LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
      WHERE ps.trainer_id = $1
      GROUP BY ps.id
      ORDER BY ps.scheduled_date DESC, ps.start_time DESC
    `, [auth.user.id]);
    return Response.json(r.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
