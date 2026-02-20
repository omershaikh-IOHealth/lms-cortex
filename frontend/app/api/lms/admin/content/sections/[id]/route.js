import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function PUT(request, { params }) {
  const { error } = await guard(request);
  if (error) return error;
  const { id } = await params;
  const { title, sort_order } = await request.json();
  try {
    const pool = getPool();
    const r = await pool.query(
      'UPDATE lms_sections SET title=COALESCE($1,title), sort_order=COALESCE($2,sort_order), updated_at=NOW() WHERE id=$3 RETURNING *',
      [title?.trim(), sort_order, id]
    );
    return Response.json(r.rows[0]);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error } = await guard(request);
  if (error) return error;
  const { id } = await params;
  try {
    const pool = getPool();
    const videos = await pool.query(
      'SELECT video_url FROM lms_lessons WHERE section_id = $1 AND video_url IS NOT NULL',
      [id]
    );
    for (const r of videos.rows) await deleteVideoFile(r.video_url);
    const childVideos = await pool.query(`
      SELECT l.video_url FROM lms_lessons l
      JOIN lms_sections s ON l.section_id = s.id
      WHERE s.parent_section_id = $1 AND l.video_url IS NOT NULL
    `, [id]);
    for (const r of childVideos.rows) await deleteVideoFile(r.video_url);
    await pool.query('DELETE FROM lms_sections WHERE id = $1', [id]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
