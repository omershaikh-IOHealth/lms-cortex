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

export async function PATCH(request, { params }) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const old = await pool.query('SELECT video_url FROM lms_lessons WHERE id = $1', [params.id]);
    deleteVideoFile(old.rows[0]?.video_url);
    await pool.query(
      'UPDATE lms_lessons SET video_url = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2',
      [user.id, params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
