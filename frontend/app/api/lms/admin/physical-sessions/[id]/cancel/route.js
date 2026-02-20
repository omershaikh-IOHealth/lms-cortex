import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function PATCH(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE lms_physical_sessions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]
    );
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
