import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const learner_type_id = searchParams.get('learner_type_id');

  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT la.*, l.title as lesson_title, lt.name as learner_type_name,
             s.title as section_title, c.title as course_title
      FROM lms_lesson_assignments la
      JOIN lms_lessons l        ON la.lesson_id        = l.id
      JOIN lms_learner_types lt ON la.learner_type_id  = lt.id
      JOIN lms_sections s       ON l.section_id        = s.id
      JOIN lms_courses c        ON s.course_id         = c.id
      ${learner_type_id ? 'WHERE la.learner_type_id = $1' : ''}
      ORDER BY lt.name, c.title, s.sort_order, l.sort_order
    `, learner_type_id ? [learner_type_id] : []);
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { authError, user } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { learner_type_id, lesson_id } = await request.json();
  if (!learner_type_id || !lesson_id) {
    return NextResponse.json({ error: 'learner_type_id and lesson_id required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO lms_lesson_assignments (learner_type_id, lesson_id, assigned_by, notified_at)
      VALUES ($1,$2,$3, NOW()) ON CONFLICT (learner_type_id, lesson_id) DO NOTHING RETURNING *
    `, [learner_type_id, lesson_id, user.id]);

    if (result.rows.length > 0) {
      // Fetch lesson title
      const lessonRes = await client.query('SELECT title FROM lms_lessons WHERE id = $1', [lesson_id]);
      const lessonTitle = lessonRes.rows[0]?.title || 'New lesson';

      // Find all active learners of this learner type
      const learners = await client.query(`
        SELECT u.id FROM auth_users u
        JOIN lms_learner_profiles lp ON lp.user_id = u.id
        WHERE lp.learner_type_id = $1 AND u.is_active = true
      `, [learner_type_id]);

      // Create notifications for each learner
      for (const learner of learners.rows) {
        await client.query(`
          INSERT INTO lms_notifications (user_id, title, body, link, type, reference_type, reference_id)
          VALUES ($1, $2, $3, '/lms/learn', 'new_content', 'lesson', $4)
        `, [learner.id, `New lesson available: ${lessonTitle}`, `A new lesson "${lessonTitle}" has been added to your curriculum.`, lesson_id]);
      }
    }

    await client.query('COMMIT');
    return NextResponse.json(result.rows[0] || { message: 'Already assigned' }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { learner_type_id, lesson_id } = await request.json();
  const pool = getPool();
  try {
    await pool.query(
      'DELETE FROM lms_lesson_assignments WHERE learner_type_id=$1 AND lesson_id=$2',
      [learner_type_id, lesson_id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
