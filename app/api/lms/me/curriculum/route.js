import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError, user } = await requireRole(request, 'learner', 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const profileRes = await pool.query(
      'SELECT learner_type_id FROM lms_learner_profiles WHERE user_id = $1',
      [user.id]
    );
    if (!profileRes.rows[0]) return NextResponse.json({ courses: [] });
    const { learner_type_id } = profileRes.rows[0];

    const lessonsRes = await pool.query(`
      SELECT c.id AS course_id, c.title AS course_title,
             c.difficulty AS course_difficulty, c.category AS course_category,
             s.id AS section_id, s.title AS section_title,
             s.sort_order AS section_order, s.parent_section_id,
             l.id AS lesson_id, l.title AS lesson_title,
             l.sort_order AS lesson_order, l.duration_seconds,
             COALESCE(ulp.percent_watched, 0)          AS percent_watched,
             COALESCE(ulp.completed, false)             AS completed,
             ulp.last_position_seconds,
             ulp.first_viewed_at,
             la.notified_at
      FROM lms_lesson_assignments la
      JOIN lms_lessons  l ON la.lesson_id  = l.id
      JOIN lms_sections s ON l.section_id  = s.id
      JOIN lms_courses  c ON s.course_id   = c.id
      LEFT JOIN lms_user_lesson_progress ulp
        ON ulp.lesson_id = l.id AND ulp.user_id = $1
      WHERE la.learner_type_id = $2 AND l.is_active = true AND c.is_active = true
      ORDER BY c.title, s.sort_order, l.sort_order
    `, [user.id, learner_type_id]);

    const courseMap = {};
    const now = new Date();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    for (const row of lessonsRes.rows) {
      if (!courseMap[row.course_id])
        courseMap[row.course_id] = {
          id: row.course_id, title: row.course_title,
          difficulty: row.course_difficulty, category: row.course_category,
          sections: {}
        };
      const sections = courseMap[row.course_id].sections;
      if (!sections[row.section_id])
        sections[row.section_id] = {
          id: row.section_id, title: row.section_title,
          sort_order: row.section_order, parent_section_id: row.parent_section_id,
          lessons: []
        };

      // A lesson is "new" if notified within last 14 days and user has never viewed it
      const isNew = row.notified_at
        && new Date(row.notified_at) > fourteenDaysAgo
        && !row.first_viewed_at;

      sections[row.section_id].lessons.push({
        id: row.lesson_id, title: row.lesson_title,
        sort_order: row.lesson_order, duration_seconds: row.duration_seconds,
        percent_watched: row.percent_watched, completed: row.completed,
        last_position_seconds: row.last_position_seconds,
        is_new: isNew
      });
    }

    const courseIds = Object.keys(courseMap).map(Number);

    // Fetch quiz info for all courses
    const quizInfo = courseIds.length
      ? await pool.query(`
          SELECT q.course_id, q.id AS quiz_id, q.title AS quiz_title, q.pass_threshold,
                 COALESCE(bool_or(qa.passed), false) AS user_passed,
                 COUNT(qa.id)::int AS attempt_count
          FROM lms_quizzes q
          LEFT JOIN lms_quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_id = $1
          WHERE q.course_id = ANY($2) AND q.is_active = true
          GROUP BY q.course_id, q.id, q.title, q.pass_threshold
        `, [user.id, courseIds])
      : { rows: [] };

    const quizMap = {};
    for (const row of quizInfo.rows) {
      quizMap[row.course_id] = {
        quiz_id: row.quiz_id,
        quiz_title: row.quiz_title,
        pass_threshold: row.pass_threshold,
        quiz_passed: row.user_passed,
        quiz_attempt_count: row.attempt_count,
      };
    }

    const courses = Object.values(courseMap).map(c => ({
      ...c,
      sections: Object.values(c.sections),
      ...(quizMap[c.id] || {}),
    }));
    return NextResponse.json({ courses });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
