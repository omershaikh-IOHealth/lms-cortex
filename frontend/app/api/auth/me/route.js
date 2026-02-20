import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized } from '@/lib/api-auth';

export async function GET(request) {
  const user = await verifyAuth(request);
  if (!user) return unauthorized();

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, role, display_name, is_active FROM auth_users WHERE id = $1',
      [user.id]
    );
    if (!result.rows[0]) return Response.json({ error: 'User not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
