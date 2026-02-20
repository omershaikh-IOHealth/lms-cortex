import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  const { sessionId } = await params;
  try {
    const pool = getPool();
    await pool.query(`
      UPDATE lms_physical_enrollments
      SET acknowledged_at = NOW()
      WHERE session_id = $1 AND user_id = $2 AND acknowledged_at IS NULL
    `, [sessionId, auth.user.id]);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
