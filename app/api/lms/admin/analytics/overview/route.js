import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const deptId    = searchParams.get('department_id');
  const dateFrom  = searchParams.get('date_from');
  const dateTo    = searchParams.get('date_to');

  const pool = getPool();
  try {
    // ── User / progress filters (applied to auth_users alias u) ──────────────
    const userFilters = [];
    const userVals    = [];
    if (companyId) { userVals.push(companyId); userFilters.push(`u.company_id = $${userVals.length}`); }
    if (deptId)    { userVals.push(deptId);    userFilters.push(`(u.department_id = $${userVals.length} OR u.sub_department_id = $${userVals.length})`); }
    const userWhere = userFilters.length ? 'WHERE ' + userFilters.join(' AND ') : '';

    // ── Session filters (applied to lms_physical_sessions alias ps) ──────────
    const sessFilters = [];
    const sessVals    = [];
    if (dateFrom)  { sessVals.push(dateFrom);  sessFilters.push(`ps.scheduled_date >= $${sessVals.length}`); }
    if (dateTo)    { sessVals.push(dateTo);    sessFilters.push(`ps.scheduled_date <= $${sessVals.length}`); }
    if (companyId) {
      sessVals.push(companyId);
      sessFilters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments _pe
        JOIN auth_users _u ON _pe.user_id = _u.id
        WHERE _pe.session_id = ps.id AND _u.company_id = $${sessVals.length}
      )`);
    }
    if (deptId) {
      sessVals.push(deptId);
      sessFilters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments _pe
        JOIN auth_users _u ON _pe.user_id = _u.id
        WHERE _pe.session_id = ps.id
          AND (_u.department_id = $${sessVals.length} OR _u.sub_department_id = $${sessVals.length})
      )`);
    }
    const sessWhere = sessFilters.length ? 'WHERE ' + sessFilters.join(' AND ') : '';

    // ── sessionsByMonth filter (date only for the trend line) ────────────────
    const monthFilters = [`ps.scheduled_date >= CURRENT_DATE - INTERVAL '12 months'`];
    const monthVals    = [];
    if (dateFrom)  { monthVals.push(dateFrom);  monthFilters.push(`ps.scheduled_date >= $${monthVals.length}`); }
    if (dateTo)    { monthVals.push(dateTo);    monthFilters.push(`ps.scheduled_date <= $${monthVals.length}`); }
    if (companyId) {
      monthVals.push(companyId);
      monthFilters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments _pe
        JOIN auth_users _u ON _pe.user_id = _u.id
        WHERE _pe.session_id = ps.id AND _u.company_id = $${monthVals.length}
      )`);
    }
    if (deptId) {
      monthVals.push(deptId);
      monthFilters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments _pe
        JOIN auth_users _u ON _pe.user_id = _u.id
        WHERE _pe.session_id = ps.id
          AND (_u.department_id = $${monthVals.length} OR _u.sub_department_id = $${monthVals.length})
      )`);
    }
    const monthWhere = 'WHERE ' + monthFilters.join(' AND ');

    // ── Trainer leaderboard filter ────────────────────────────────────────────
    const trainerFilters = [];
    const trainerVals    = [];
    if (companyId) {
      trainerVals.push(companyId);
      trainerFilters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments _pe
        JOIN auth_users _u ON _pe.user_id = _u.id
        WHERE _pe.session_id = ps.id AND _u.company_id = $${trainerVals.length}
      )`);
    }
    if (deptId) {
      trainerVals.push(deptId);
      trainerFilters.push(`EXISTS (
        SELECT 1 FROM lms_physical_enrollments _pe
        JOIN auth_users _u ON _pe.user_id = _u.id
        WHERE _pe.session_id = ps.id
          AND (_u.department_id = $${trainerVals.length} OR _u.sub_department_id = $${trainerVals.length})
      )`);
    }
    const trainerWhere = trainerFilters.length ? 'WHERE ' + trainerFilters.join(' AND ') : '';

    const [users, sessions, lessons, progress, sessionsByMonth, trainerLeaderboard, completionByLearnerType] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                              AS total_users,
          COUNT(*) FILTER (WHERE role = 'learner')                             AS learners,
          COUNT(*) FILTER (WHERE role = 'trainer')                             AS trainers,
          COUNT(*) FILTER (WHERE is_active = true)                             AS active_users
        FROM auth_users u ${userWhere}
      `, userVals),

      pool.query(`
        SELECT
          COUNT(*)                                                              AS total_sessions,
          COUNT(*) FILTER (WHERE ps.status = 'completed' OR ps.scheduled_date < CURRENT_DATE) AS completed_sessions,
          COUNT(*) FILTER (WHERE ps.scheduled_date >= CURRENT_DATE AND ps.status != 'cancelled') AS upcoming_sessions,
          COUNT(*) FILTER (WHERE ps.session_mode = 'online')                   AS online_sessions,
          COUNT(*) FILTER (WHERE ps.session_mode = 'in_person' OR ps.session_mode IS NULL) AS inperson_sessions,
          COALESCE(AVG(
            CASE WHEN pe_total.cnt > 0 THEN
              pe_present.cnt::float / pe_total.cnt * 100
            END
          ), 0)::int                                                            AS avg_attendance_pct
        FROM lms_physical_sessions ps
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt FROM lms_physical_enrollments WHERE session_id = ps.id
        ) pe_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt FROM lms_physical_enrollments
          WHERE session_id = ps.id AND attendance_status = 'present'
        ) pe_present ON true
        ${sessWhere}
      `, sessVals),

      pool.query(`
        SELECT
          COUNT(DISTINCT l.id) AS total_lessons,
          COUNT(DISTINCT c.id) AS total_courses
        FROM lms_lessons l
        LEFT JOIN lms_sections s ON l.section_id = s.id
        LEFT JOIN lms_courses  c ON s.course_id  = c.id
        WHERE l.is_active = true
      `),

      pool.query(`
        SELECT
          COUNT(*)                                        AS progress_records,
          COUNT(*) FILTER (WHERE completed = true)        AS completions,
          COALESCE(SUM(total_watch_seconds), 0)           AS total_watch_seconds
        FROM lms_user_lesson_progress ulp
        JOIN auth_users u ON ulp.user_id = u.id
        ${userWhere}
      `, userVals),

      pool.query(`
        SELECT
          TO_CHAR(ps.scheduled_date, 'YYYY-MM') AS month,
          COUNT(*)::int                          AS count
        FROM lms_physical_sessions ps
        ${monthWhere}
        GROUP BY month
        ORDER BY month
      `, monthVals),

      pool.query(`
        SELECT
          COALESCE(u.display_name, u.email)               AS trainer_name,
          COUNT(DISTINCT ps.id)::int                       AS session_count,
          COALESCE(
            ROUND(
              AVG(
                CASE WHEN pe_total.cnt > 0
                  THEN pe_present.cnt::float / pe_total.cnt * 100
                END
              )
            ), 0
          )::int                                           AS avg_attendance_pct
        FROM lms_physical_sessions ps
        JOIN auth_users u ON ps.trainer_id = u.id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt FROM lms_physical_enrollments WHERE session_id = ps.id
        ) pe_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt FROM lms_physical_enrollments
          WHERE session_id = ps.id AND attendance_status = 'present'
        ) pe_present ON true
        ${trainerWhere}
        GROUP BY u.id, u.display_name, u.email
        ORDER BY session_count DESC
        LIMIT 5
      `, trainerVals),

      pool.query(`
        SELECT
          lt.id                                                                      AS learner_type_id,
          lt.name                                                                    AS learner_type_name,
          COUNT(DISTINCT CONCAT(lp.user_id::text, '-', la.lesson_id::text))::int    AS total_assigned,
          COUNT(DISTINCT ulp.id) FILTER (WHERE ulp.completed = true)::int           AS completed,
          CASE
            WHEN COUNT(DISTINCT CONCAT(lp.user_id::text, '-', la.lesson_id::text)) > 0
            THEN ROUND(
              COUNT(DISTINCT ulp.id) FILTER (WHERE ulp.completed = true)::numeric
              / COUNT(DISTINCT CONCAT(lp.user_id::text, '-', la.lesson_id::text))::numeric * 100
            )
            ELSE 0
          END                                                                        AS completion_pct
        FROM lms_learner_types lt
        LEFT JOIN lms_lesson_assignments la   ON la.learner_type_id = lt.id
        LEFT JOIN lms_learner_profiles lp     ON lp.learner_type_id = lt.id
        LEFT JOIN auth_users u                ON u.id = lp.user_id
        LEFT JOIN lms_user_lesson_progress ulp
          ON ulp.user_id = lp.user_id AND ulp.lesson_id = la.lesson_id
        WHERE lt.is_active = true
        GROUP BY lt.id, lt.name
        ORDER BY lt.name
      `),
    ]);

    return NextResponse.json({
      users:                   users.rows[0],
      sessions:                sessions.rows[0],
      content:                 lessons.rows[0],
      progress:                progress.rows[0],
      sessionsByMonth:         sessionsByMonth.rows,
      trainerLeaderboard:      trainerLeaderboard.rows,
      completionByLearnerType: completionByLearnerType.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
