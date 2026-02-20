import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const [userRes, progressRes, sessionsRes] = await Promise.all([
      pool.query(`
        SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
               lt.name AS learner_type, lt.id AS learner_type_id, lp.id AS profile_id
        FROM auth_users u
        LEFT JOIN lms_learner_profiles lp ON lp.user_id        = u.id
        LEFT JOIN lms_learner_types    lt ON lp.learner_type_id = lt.id
        WHERE u.id = $1
      `, [params.userId]),
      pool.query(`
        SELECT ulp.*, l.title AS lesson_title,
               s.title AS section_title, c.title AS course_title
        FROM lms_user_lesson_progress ulp
        JOIN lms_lessons  l ON ulp.lesson_id  = l.id
        JOIN lms_sections s ON l.section_id   = s.id
        JOIN lms_courses  c ON s.course_id    = c.id
        WHERE ulp.user_id = $1 ORDER BY ulp.last_activity_at DESC
      `, [params.userId]),
      pool.query(`
        SELECT ls.id, ls.lesson_id, ls.session_started_at, ls.session_ended_at,
               ls.total_active_seconds, ls.total_idle_seconds, l.title AS lesson_title
        FROM lms_learning_sessions ls
        JOIN lms_lessons l ON ls.lesson_id = l.id
        WHERE ls.user_id = $1 ORDER BY ls.session_started_at DESC LIMIT 30
      `, [params.userId]),
    ]);

    if (!userRes.rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const topLessons = [...progressRes.rows]
      .sort((a, b) => (b.watch_count || 0) - (a.watch_count || 0) || (b.total_watch_seconds || 0) - (a.total_watch_seconds || 0))
      .slice(0, 3);

    const assignedRes = await pool.query(`
      SELECT COUNT(DISTINCT la.lesson_id)::int AS total_assigned
      FROM lms_lesson_assignments la
      JOIN lms_learner_profiles lp ON lp.learner_type_id = la.learner_type_id
      WHERE lp.user_id = $1
    `, [params.userId]);

    const physicalRes = await pool.query(`
      SELECT
        pe.attendance_status, pe.acknowledged_at, pe.marked_at, pe.created_at AS enrolled_at,
        ps.id AS session_id, ps.title, ps.scheduled_date, ps.start_time, ps.end_time,
        ps.location, ps.status AS session_status, trainer.display_name AS trainer_name
      FROM lms_physical_enrollments pe
      JOIN lms_physical_sessions ps ON pe.session_id = ps.id
      LEFT JOIN auth_users trainer  ON ps.trainer_id  = trainer.id
      WHERE pe.user_id = $1 ORDER BY ps.scheduled_date DESC
    `, [params.userId]);

    return NextResponse.json({
      user:              userRes.rows[0],
      progress:          progressRes.rows,
      topLessons,
      sessions:          sessionsRes.rows,
      totalAssigned:     assignedRes.rows[0]?.total_assigned || 0,
      physicalTrainings: physicalRes.rows,
    });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
