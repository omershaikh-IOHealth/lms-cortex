import { getPool } from '@/lib/db';
import { requireAuth, requireRole } from '@/lib/server-auth';
import { uploadToSupabase, deleteFromSupabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    const r = await pool.query('SELECT * FROM lms_lessons WHERE id = $1', [id]);
    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;

  const contentType = request.headers.get('content-type') || '';
  let title, manual_markdown, sort_order, is_active, duration_seconds, newVideoUrl = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    title = formData.get('title');
    manual_markdown = formData.get('manual_markdown');
    sort_order = formData.get('sort_order');
    is_active = formData.get('is_active');
    duration_seconds = formData.get('duration_seconds');
    const videoFile = formData.get('video');
    if (videoFile && videoFile.size > 0) {
      const pool = getPool();
      const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [id]);
      await deleteFromSupabase(old.rows[0]?.video_url);
      newVideoUrl = await uploadToSupabase(videoFile);
    }
  } else {
    const body = await request.json();
    title = body.title;
    manual_markdown = body.manual_markdown;
    sort_order = body.sort_order;
    is_active = body.is_active;
    duration_seconds = body.duration_seconds;
  }

  const p = [title?.trim() || null, manual_markdown, sort_order, is_active, duration_seconds, auth.user.id, id];
  let videoClause = '';
  if (newVideoUrl) {
    videoClause = `, video_url = $8`;
    p.push(newVideoUrl);
  }

  try {
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
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;
  const { id } = await params;
  try {
    const pool = getPool();
    const r = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [id]);
    await deleteFromSupabase(r.rows[0]?.video_url);
    await pool.query('DELETE FROM lms_lessons WHERE id = $1', [id]);
    return Response.json({ ok: true });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
