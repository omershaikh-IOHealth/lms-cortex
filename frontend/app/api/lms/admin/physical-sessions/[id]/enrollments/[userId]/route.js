import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';

export async function DELETE(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id, userId } = await params;
  try {
    const pool = getPool();
    await pool.query(
      `DELETE FROM lms_physical_enrollments WHERE session_id = $1 AND user_id = $2`, [id, userId]
    );
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
