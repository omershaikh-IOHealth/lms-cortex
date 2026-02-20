import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { deleteFromSupabase } from '@/lib/supabase';

export async function PUT(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  const { title, description, is_active } = await request.json();
  try {
    const pool = getPool();
    const r = await pool.query(`
      UPDATE lms_courses SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        is_active   = COALESCE($3, is_active),
        updated_at  = NOW()
      WHERE id = $4 RETURNING *
    `, [title?.trim(), description, is_active, id]);
    return Response.json(r.rows[0]);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    const videos = await pool.query(`
      SELECT l.video_url FROM lms_lessons l
      JOIN lms_sections s ON l.section_id = s.id
      WHERE s.course_id = $1 AND l.video_url IS NOT NULL
    `, [id]);
    for (const r of videos.rows) { await deleteFromSupabase(r.video_url); }
    await pool.query('DELETE FROM lms_courses WHERE id = $1', [id]);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
