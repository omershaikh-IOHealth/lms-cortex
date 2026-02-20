import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireRole(request, 'trainer', 'admin', 'training');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const r = await pool.query(
      'SELECT id, email, display_name, staff_id, departments, specialties FROM auth_users WHERE id = $1',
      [auth.user.id]
    );
    return Response.json(r.rows[0]);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
