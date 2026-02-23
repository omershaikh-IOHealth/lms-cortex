import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError, user } = await requireRole(request, 'trainer', 'admin', 'training');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(`
      SELECT ps.*,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'enrolled') AS enrolled_count,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'present')  AS present_count,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.attendance_status = 'absent')   AS absent_count,
        COUNT(DISTINCT pe.id) FILTER (WHERE pe.acknowledged_at IS NOT NULL)    AS acknowledged_count,
        CASE
          WHEN ps.status = 'cancelled' THEN 'cancelled'
          WHEN ps.scheduled_date < CURRENT_DATE THEN 'completed'
          WHEN ps.scheduled_date = CURRENT_DATE
               AND ps.start_time <= CURRENT_TIME
               AND ps.end_time   >= CURRENT_TIME THEN 'ongoing'
          ELSE 'scheduled'
        END AS computed_status
      FROM lms_physical_sessions ps
      LEFT JOIN lms_physical_enrollments pe ON pe.session_id = ps.id
      WHERE ps.trainer_id = $1
      GROUP BY ps.id
      ORDER BY ps.scheduled_date DESC, ps.start_time DESC
    `, [user.id]);
    return NextResponse.json(r.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
