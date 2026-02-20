import { createClient } from '@supabase/supabase-js';

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabase;
}

const BUCKET = process.env.SUPABASE_VIDEO_BUCKET || 'lms-videos';

export async function uploadToSupabase(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const { error } = await getSupabase().storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteVideoFile(video_url) {
  if (!video_url) return;
  if (video_url.startsWith('/uploads/')) return;
  try {
    const filename = video_url.split('/').pop();
    await getSupabase().storage.from(BUCKET).remove([filename]);
  } catch {}
}
