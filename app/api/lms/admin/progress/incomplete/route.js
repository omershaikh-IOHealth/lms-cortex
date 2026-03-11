import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/progress/incomplete
// Returns learners who have incomplete lessons OR unattended past sessions
export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    // Incomplete lessons per learner
    const lessonsRes = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.display_name,
        lt.name                                                              AS learner_type,
        COUNT(DISTINCT la.lesson_id)                                         AS total_lessons,
        COUNT(DISTINCT CASE WHEN ulp.completed = true THEN la.lesson_id END) AS completed_lessons,
        ROUND(
          COUNT(DISTINCT CASE WHEN ulp.completed = true THEN la.lesson_id END)::numeric
          / NULLIF(COUNT(DISTINCT la.lesson_id), 0) * 100
        )::int                                                               AS lesson_pct,
        MAX(ulp.last_activity_at)                                            AS last_active
      FROM lms_learner_profiles lp
      JOIN auth_users u              ON u.id  = lp.user_id
      JOIN lms_learner_types lt      ON lt.id = lp.learner_type_id
      JOIN lms_lesson_assignments la ON la.learner_type_id = lp.learner_type_id
      JOIN lms_lessons les           ON les.id = la.lesson_id AND les.is_active = true
      JOIN lms_sections sec          ON sec.id = les.section_id
      JOIN lms_courses c             ON c.id = sec.course_id AND c.is_active = true
      LEFT JOIN lms_user_lesson_progress ulp
                                     ON ulp.lesson_id = la.lesson_id AND ulp.user_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.email, u.display_name, lt.name
    `);

    // Unattended past sessions per learner
    const sessionsRes = await pool.query(`
      SELECT
        pe.user_id                 AS id,
        COUNT(*)::int              AS unattended_sessions
      FROM lms_physical_enrollments pe
      JOIN lms_physical_sessions ps ON ps.id = pe.session_id
      WHERE pe.attendance_status NOT IN ('attended', 'cancelled')
        AND ps.status != 'cancelled'
        AND (ps.scheduled_date < CURRENT_DATE
             OR (ps.scheduled_date = CURRENT_DATE AND ps.end_time < CURRENT_TIME))
      GROUP BY pe.user_id
    `);

    const sessionMap = {};
    for (const row of sessionsRes.rows) {
      sessionMap[row.id] = row.unattended_sessions;
    }

    // Merge: only include users with at least one incomplete lesson or unattended session
    const result = lessonsRes.rows
      .map(r => ({
        ...r,
        total_lessons: parseInt(r.total_lessons),
        completed_lessons: parseInt(r.completed_lessons),
        incomplete_lessons: parseInt(r.total_lessons) - parseInt(r.completed_lessons),
        lesson_pct: r.lesson_pct ?? 0,
        unattended_sessions: sessionMap[r.id] || 0,
      }))
      .filter(r => r.incomplete_lessons > 0 || r.unattended_sessions > 0)
      .sort((a, b) => {
        // Sort by most incomplete first (lessons + sessions combined)
        const aScore = a.incomplete_lessons + a.unattended_sessions * 2;
        const bScore = b.incomplete_lessons + b.unattended_sessions * 2;
        return bScore - aScore;
      })
      .slice(0, 100);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
