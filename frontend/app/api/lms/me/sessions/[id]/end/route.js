import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { total_active_seconds, total_idle_seconds } = await request.json();
  try {
    const pool = getPool();
    await pool.query(`
      UPDATE lms_learning_sessions
      SET session_ended_at     = NOW(),
          total_active_seconds = COALESCE($1, total_active_seconds),
          total_idle_seconds   = COALESCE($2, total_idle_seconds)
      WHERE id = $3 AND user_id = $4
    `, [total_active_seconds, total_idle_seconds, id, auth.user.id]);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
