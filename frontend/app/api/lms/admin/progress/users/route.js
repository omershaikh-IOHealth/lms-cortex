import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorized();
  if (!['admin', 'training'].includes(user.role)) return forbidden();
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.display_name, u.is_active, u.created_at,
        lt.name AS learner_type,
        COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int  AS completed_lessons,
        COUNT(DISTINCT ulp.lesson_id)::int                                       AS started_lessons,
        COALESCE(SUM(ulp.total_watch_seconds), 0)::int                           AS total_watch_seconds,
        MAX(ulp.last_activity_at)                                                AS last_active,
        ROUND(AVG(ulp.percent_watched) FILTER (WHERE ulp.percent_watched > 0), 1) AS avg_percent_watched,
        (SELECT COUNT(*)::int FROM lms_physical_enrollments pe
         WHERE pe.user_id = u.id AND pe.attendance_status = 'present')           AS physical_attended
      FROM auth_users u
      LEFT JOIN lms_learner_profiles  lp  ON lp.user_id        = u.id
      LEFT JOIN lms_learner_types     lt  ON lp.learner_type_id = lt.id
      LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id    = u.id
      WHERE u.role = 'learner'
      GROUP BY u.id, lt.name
      ORDER BY last_active DESC NULLS LAST
    `);
    return Response.json(result.rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
