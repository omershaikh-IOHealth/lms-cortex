import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function POST(request) {
  const { error } = await guard(request);
  if (error) return error;
  const { course_id, parent_section_id, title, sort_order } = await request.json();
  if (!course_id || !title?.trim()) return Response.json({ error: 'course_id and title required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_sections (course_id, parent_section_id, title, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [course_id, parent_section_id || null, title.trim(), sort_order || 0]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
