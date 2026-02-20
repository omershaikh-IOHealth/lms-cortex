import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireRole(request, 'learner', 'admin', 'training');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT * FROM lms_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [auth.user.id]);
    const unread = result.rows.filter(n => !n.is_read).length;
    return Response.json({ notifications: result.rows, unread });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
