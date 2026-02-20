import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function POST(request) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  const { lesson_id } = await request.json();
  if (!lesson_id) return Response.json({ error: 'lesson_id required' }, { status: 400 });
  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO lms_learning_sessions (user_id, lesson_id) VALUES ($1,$2) RETURNING id`,
      [auth.user.id, lesson_id]
    );
    return Response.json({ session_id: result.rows[0].id }, { status: 201 });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
