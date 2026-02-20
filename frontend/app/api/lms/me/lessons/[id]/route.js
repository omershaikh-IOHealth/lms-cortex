import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request, { params }) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    const profileRes = await pool.query(
      'SELECT learner_type_id FROM lms_learner_profiles WHERE user_id = $1',
      [auth.user.id]
    );
    const learnerTypeId = profileRes.rows[0]?.learner_type_id;

    const accessCheck = await pool.query(`
      SELECT l.* FROM lms_lessons l
      JOIN lms_lesson_assignments la ON la.lesson_id = l.id
      WHERE l.id = $1 AND la.learner_type_id = $2 AND l.is_active = true
    `, [id, learnerTypeId]);

    if (!accessCheck.rows[0] && auth.user.role !== 'admin')
      return Response.json({ error: 'Access denied to this lesson' }, { status: 403 });

    const lesson = accessCheck.rows[0];
    const progressRes = await pool.query(
      'SELECT * FROM lms_user_lesson_progress WHERE user_id=$1 AND lesson_id=$2',
      [auth.user.id, id]
    );
    return Response.json({ lesson, progress: progressRes.rows[0] || null });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
