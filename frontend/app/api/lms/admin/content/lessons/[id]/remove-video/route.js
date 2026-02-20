import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { deleteFromSupabase } from '@/lib/supabase';

export async function PATCH(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [id]);
    await deleteFromSupabase(old.rows[0]?.video_url);
    await pool.query(
      'UPDATE lms_lessons SET video_url = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2',
      [auth.user.id, id]
    );
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
