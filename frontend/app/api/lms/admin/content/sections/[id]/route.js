import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

const BUCKET = process.env.SUPABASE_VIDEO_BUCKET || 'lms-videos';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

async function deleteVideoFile(video_url) {
  if (!video_url || video_url.startsWith('/uploads/')) return;
  try {
    const filename = video_url.split('/').pop();
    await getSupabase().storage.from(BUCKET).remove([filename]);
  } catch {}
}

export async function PUT(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, sort_order } = await request.json();
  try {
    const pool = getPool();
    const r = await pool.query(
      'UPDATE lms_sections SET title=COALESCE($1,title), sort_order=COALESCE($2,sort_order), updated_at=NOW() WHERE id=$3 RETURNING *',
      [title?.trim(), sort_order, params.id]
    );
    return NextResponse.json(r.rows[0]);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const videos = await pool.query(
      'SELECT video_url FROM lms_lessons WHERE section_id = $1 AND video_url IS NOT NULL',
      [params.id]
    );
    videos.rows.forEach(r => deleteVideoFile(r.video_url));
    const childVideos = await pool.query(`
      SELECT l.video_url FROM lms_lessons l
      JOIN lms_sections s ON l.section_id = s.id
      WHERE s.parent_section_id = $1 AND l.video_url IS NOT NULL
    `, [params.id]);
    childVideos.rows.forEach(r => deleteVideoFile(r.video_url));
    await pool.query('DELETE FROM lms_sections WHERE id = $1', [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
