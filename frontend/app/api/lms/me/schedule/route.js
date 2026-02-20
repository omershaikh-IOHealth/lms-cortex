import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        pe.attendance_status, pe.acknowledged_at,
        ps.id AS session_id, ps.title, ps.description,
        ps.scheduled_date, ps.start_time, ps.end_time,
        ps.location, ps.status AS session_status,
        trainer.display_name AS trainer_name, trainer.email AS trainer_email
      FROM lms_physical_enrollments pe
      JOIN lms_physical_sessions ps ON pe.session_id = ps.id
      LEFT JOIN auth_users trainer ON ps.trainer_id = trainer.id
      WHERE pe.user_id = $1 AND ps.status != 'cancelled'
      ORDER BY ps.scheduled_date DESC, ps.start_time DESC
    `, [auth.user.id]);
    return Response.json(result.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
