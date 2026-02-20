import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  const { ids } = await request.json().catch(() => ({}));
  try {
    const pool = getPool();
    if (ids?.length) {
      await pool.query(
        `UPDATE lms_notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::int[])`,
        [auth.user.id, ids]
      );
    } else {
      await pool.query(
        `UPDATE lms_notifications SET is_read = true WHERE user_id = $1`,
        [auth.user.id]
      );
    }
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
