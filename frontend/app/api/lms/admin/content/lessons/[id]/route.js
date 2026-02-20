import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';
import { uploadToSupabase, deleteVideoFile } from '@/lib/supabase-storage';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function GET(request, { params }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const pool = getPool();
    const r = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [id]);
    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { user, error } = await guard(request);
  if (error) return error;
  const { id } = await params;

  try {
    const formData = await request.formData();
    const title = formData.get('title');
    const manual_markdown = formData.get('manual_markdown');
    const sort_order = formData.get('sort_order');
    const is_active = formData.get('is_active');
    const duration_seconds = formData.get('duration_seconds');
    const videoFile = formData.get('video');

    let videoClause = '';
    const p = [title?.trim() || null, manual_markdown || null, sort_order || null, is_active === null ? null : is_active, duration_seconds || null, user.id, id];

    if (videoFile && videoFile.size > 0) {
      const pool = getPool();
      const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [id]);
      await deleteVideoFile(old.rows[0]?.video_url);
      const newUrl = await uploadToSupabase(videoFile);
      videoClause = ', video_url = $8';
      p.push(newUrl);
    }

    const pool = getPool();
    const r = await pool.query(`
      UPDATE lms_lessons SET
        title            = COALESCE($1, title),
        manual_markdown  = COALESCE($2, manual_markdown),
        sort_order       = COALESCE($3, sort_order),
        is_active        = COALESCE($4, is_active),
        duration_seconds = COALESCE($5, duration_seconds),
        updated_by       = $6,
        updated_at       = NOW()
        ${videoClause}
      WHERE id = $7 RETURNING *
    `, p);
    if (!r.rows[0]) return Response.json({ error: 'Lesson not found' }, { status: 404 });
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
    const r = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [id]);
    await deleteVideoFile(r.rows[0]?.video_url);
    await pool.query('DELETE FROM lms_lessons WHERE id = $1', [id]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
