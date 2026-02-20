import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

export async function PATCH(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorized();
  if (!['admin', 'training'].includes(user.role)) return forbidden();
  const { id } = await params;
  try {
    const pool = getPool();
    const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [id]);
    await deleteVideoFile(old.rows[0]?.video_url);
    await pool.query(
      'UPDATE lms_lessons SET video_url = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2',
      [user.id, id]
    );
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
