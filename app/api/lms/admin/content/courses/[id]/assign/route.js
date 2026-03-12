import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

// GET /api/lms/admin/content/courses/[id]/assign
// List existing course-level assignments
export async function GET(request, { params }) {
  const { authError } = await requireRole(request, 'admin');
  if (authError) return authError;

  const pool = getPool();
  try {
    const r = await pool.query(
      `SELECT a.*,
        CASE a.assigned_to_type
          WHEN 'organization'  THEN (SELECT company_name FROM companies WHERE id = a.assigned_to_id)
          WHEN 'department'    THEN (SELECT name FROM lms_departments WHERE id = a.assigned_to_id)
          WHEN 'facility'      THEN (SELECT name FROM lms_facilities WHERE id = a.assigned_to_id)
          WHEN 'learner_type'  THEN (SELECT name FROM lms_learner_types WHERE id = a.assigned_to_id)
        END AS assigned_to_name
      FROM lms_course_assignments a
      WHERE a.course_id = $1
      ORDER BY a.created_at DESC`,
      [params.id]
    );
    return NextResponse.json(r.rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/lms/admin/content/courses/[id]/assign
// Assign a course to an org / facility / department / learner_type
export async function POST(request, { params }) {
  const { authError, user } = await requireRole(request, 'admin');
  if (authError) return authError;

  const { assigned_to_type, assigned_to_id, due_date } = await request.json();
  if (!assigned_to_type || !assigned_to_id) {
    return NextResponse.json({ error: 'assigned_to_type and assigned_to_id are required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert assignment record
    await client.query(
      `INSERT INTO lms_course_assignments (course_id, assigned_to_type, assigned_to_id, assigned_by, due_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [params.id, assigned_to_type, assigned_to_id, user.id, due_date || null]
    );

    // 2. Resolve target user IDs
    let userIds = [];
    if (assigned_to_type === 'organization') {
      const ur = await client.query(
        `SELECT id FROM auth_users WHERE company_id = $1 AND is_active = true`,
        [assigned_to_id]
      );
      userIds = ur.rows.map(r => r.id);
    } else if (assigned_to_type === 'department') {
      const ur = await client.query(
        `SELECT DISTINCT u.id FROM auth_users u
         JOIN lms_departments d ON d.id = $1
         WHERE (u.department_id = $1 OR u.sub_department_id = $1) AND u.is_active = true`,
        [assigned_to_id]
      );
      userIds = ur.rows.map(r => r.id);
    } else if (assigned_to_type === 'facility') {
      // Facilities belong to a company; assign all users in that company
      const fr = await client.query('SELECT company_id FROM lms_facilities WHERE id = $1', [assigned_to_id]);
      if (fr.rows[0]) {
        const ur = await client.query(
          `SELECT id FROM auth_users WHERE company_id = $1 AND is_active = true`,
          [fr.rows[0].company_id]
        );
        userIds = ur.rows.map(r => r.id);
      }
    } else if (assigned_to_type === 'learner_type') {
      const ur = await client.query(
        `SELECT DISTINCT u.id FROM auth_users u
         JOIN lms_learner_profiles lp ON lp.user_id = u.id
         WHERE lp.learner_type_id = $1 AND u.is_active = true`,
        [assigned_to_id]
      );
      userIds = ur.rows.map(r => r.id);
    }

    // 3. Get all lesson IDs for this course
    const lr = await client.query(
      `SELECT l.id FROM lms_lessons l
       JOIN lms_sections s ON s.id = l.section_id
       WHERE s.course_id = $1 AND l.is_active = true`,
      [params.id]
    );
    const lessonIds = lr.rows.map(r => r.id);

    // 4. Upsert progress records for each (user, lesson) pair
    let progressCount = 0;
    for (const userId of userIds) {
      for (const lessonId of lessonIds) {
        const res = await client.query(
          `INSERT INTO lms_user_lesson_progress (user_id, lesson_id, completed)
           VALUES ($1, $2, false)
           ON CONFLICT DO NOTHING`,
          [userId, lessonId]
        );
        progressCount += res.rowCount || 0;
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({
      ok: true,
      assigned_to_count: userIds.length,
      lesson_count: lessonIds.length,
      progress_rows_created: progressCount,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}
