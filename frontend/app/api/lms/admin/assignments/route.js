import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function GET(request) {
  const { error } = await guard(request);
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const learner_type_id = searchParams.get('learner_type_id');
  try {
    const pool = getPool();
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
    return Response.json(result.rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = await guard(request);
  if (error) return error;
  const { learner_type_id, lesson_id } = await request.json();
  if (!learner_type_id || !lesson_id) {
    return Response.json({ error: 'learner_type_id and lesson_id required' }, { status: 400 });
  }
  try {
    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO lms_lesson_assignments (learner_type_id, lesson_id, assigned_by)
      VALUES ($1,$2,$3) ON CONFLICT (learner_type_id, lesson_id) DO NOTHING RETURNING *
    `, [learner_type_id, lesson_id, user.id]);
    return Response.json(result.rows[0] || { message: 'Already assigned' }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { error } = await guard(request);
  if (error) return error;
  const { learner_type_id, lesson_id } = await request.json();
  try {
    const pool = getPool();
    await pool.query(
      'DELETE FROM lms_lesson_assignments WHERE learner_type_id=$1 AND lesson_id=$2',
      [learner_type_id, lesson_id]
    );
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
