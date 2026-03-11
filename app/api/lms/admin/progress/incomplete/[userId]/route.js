import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/progress/incomplete/[userId]
// Returns the specific incomplete lessons and unattended sessions for a learner
export async function GET(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { userId } = params;
  const pool = getPool();
  try {
    // Incomplete lessons
    const lessonsRes = await pool.query(`
      SELECT
        c.id   AS course_id,
        c.title AS course_title,
        l.id   AS lesson_id,
        l.title AS lesson_title,
        l.duration_seconds,
        COALESCE(ulp.completed, false)         AS completed,
        COALESCE(ulp.percent_watched, 0)       AS percent_watched,
        ulp.last_activity_at
      FROM lms_learner_profiles lp
      JOIN lms_lesson_assignments la ON la.learner_type_id = lp.learner_type_id
      JOIN lms_lessons l             ON l.id = la.lesson_id AND l.is_active = true
      JOIN lms_sections sec          ON sec.id = l.section_id
      JOIN lms_courses c             ON c.id = sec.course_id AND c.is_active = true
      LEFT JOIN lms_user_lesson_progress ulp
                                     ON ulp.lesson_id = l.id AND ulp.user_id = $1
      WHERE lp.user_id = $1
        AND COALESCE(ulp.completed, false) = false
      ORDER BY c.title, sec.sort_order, l.sort_order
    `, [userId]);

    // Unattended past sessions
    const sessionsRes = await pool.query(`
      SELECT
        ps.id,
        ps.title,
        ps.scheduled_date,
        ps.start_time,
        ps.end_time,
        ps.location,
        ps.session_mode,
        pe.attendance_status
      FROM lms_physical_enrollments pe
      JOIN lms_physical_sessions ps ON ps.id = pe.session_id
      WHERE pe.user_id = $1
        AND pe.attendance_status NOT IN ('attended', 'cancelled')
        AND ps.status != 'cancelled'
        AND (ps.scheduled_date < CURRENT_DATE
             OR (ps.scheduled_date = CURRENT_DATE AND ps.end_time < CURRENT_TIME))
      ORDER BY ps.scheduled_date DESC
    `, [userId]);

    return NextResponse.json({
      incomplete_lessons: lessonsRes.rows,
      unattended_sessions: sessionsRes.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
