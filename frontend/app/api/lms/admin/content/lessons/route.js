import { getPool } from '@/lib/db';
import { requireRole } from '@/lib/server-auth';
import { uploadToSupabase } from '@/lib/supabase';

export async function POST(request) {
  const auth = requireRole(request, 'admin', 'training');
  if (auth.error) return auth.response;

  const contentType = request.headers.get('content-type') || '';
  let section_id, title, manual_markdown, sort_order, duration_seconds, video_url = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    section_id = formData.get('section_id');
    title = formData.get('title');
    manual_markdown = formData.get('manual_markdown');
    sort_order = formData.get('sort_order');
    duration_seconds = formData.get('duration_seconds');
    const videoFile = formData.get('video');
    if (videoFile && videoFile.size > 0) {
      video_url = await uploadToSupabase(videoFile);
    }
  } else {
    const body = await request.json();
    section_id = body.section_id;
    title = body.title;
    manual_markdown = body.manual_markdown;
    sort_order = body.sort_order;
    duration_seconds = body.duration_seconds;
  }

  if (!section_id || !title?.trim()) return Response.json({ error: 'section_id and title required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(`
      INSERT INTO lms_lessons (section_id, title, video_url, manual_markdown, sort_order, duration_seconds, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *
    `, [section_id, title.trim(), video_url, manual_markdown || null, sort_order || 0, duration_seconds || null, auth.user.id]);
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
}
