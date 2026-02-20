import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function GET(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  try {
    const pool = getPool();
    const r = await pool.query(`
      SELECT id, email, display_name FROM auth_users
      WHERE role IN ('admin','training') AND is_active = true
      ORDER BY display_name
    `);
    return Response.json(r.rows);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
