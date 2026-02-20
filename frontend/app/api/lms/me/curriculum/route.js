import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['learner', 'admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const profileRes = await pool.query(
      'SELECT learner_type_id FROM lms_learner_profiles WHERE user_id = $1',
      [user.id]
    );
    if (!profileRes.rows[0]) return NextResponse.json({ courses: [] });
    const { learner_type_id } = profileRes.rows[0];

    const lessonsRes = await pool.query(`
      SELECT c.id AS course_id, c.title AS course_title,
             s.id AS section_id, s.title AS section_title,
             s.sort_order AS section_order, s.parent_section_id,
             l.id AS lesson_id, l.title AS lesson_title,
             l.sort_order AS lesson_order, l.duration_seconds,
             COALESCE(ulp.percent_watched, 0)    AS percent_watched,
             COALESCE(ulp.completed, false)        AS completed,
             ulp.last_position_seconds
      FROM lms_lesson_assignments la
      JOIN lms_lessons  l ON la.lesson_id  = l.id
      JOIN lms_sections s ON l.section_id  = s.id
      JOIN lms_courses  c ON s.course_id   = c.id
      LEFT JOIN lms_user_lesson_progress ulp ON ulp.lesson_id = l.id AND ulp.user_id = $1
      WHERE la.learner_type_id = $2 AND l.is_active = true AND c.is_active = true
      ORDER BY c.title, s.sort_order, l.sort_order
    `, [user.id, learner_type_id]);

    const courseMap = {};
    for (const row of lessonsRes.rows) {
      if (!courseMap[row.course_id])
        courseMap[row.course_id] = { id: row.course_id, title: row.course_title, sections: {} };
      const sections = courseMap[row.course_id].sections;
      if (!sections[row.section_id])
        sections[row.section_id] = {
          id: row.section_id, title: row.section_title,
          sort_order: row.section_order, parent_section_id: row.parent_section_id,
          lessons: []
        };
      sections[row.section_id].lessons.push({
        id: row.lesson_id, title: row.lesson_title,
        sort_order: row.lesson_order, duration_seconds: row.duration_seconds,
        percent_watched: row.percent_watched, completed: row.completed,
        last_position_seconds: row.last_position_seconds
      });
    }

    const courses = Object.values(courseMap).map(c => ({
      ...c, sections: Object.values(c.sections)
    }));
    return NextResponse.json({ courses });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
