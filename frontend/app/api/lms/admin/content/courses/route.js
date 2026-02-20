import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';
import { deleteVideoFile } from '@/lib/supabase-storage';

async function authGuard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  return { user };
}

async function adminGuard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function GET(request) {
  const { user, error } = await authGuard(request);
  if (error) return error;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.*,
        COUNT(DISTINCT l.id)::int AS lesson_count
      FROM lms_courses c
      LEFT JOIN lms_sections s ON s.course_id = c.id
      LEFT JOIN lms_lessons l  ON l.section_id = s.id
      GROUP BY c.id ORDER BY c.title
    `);
    return Response.json(result.rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = await adminGuard(request);
  if (error) return error;
  const { title, description } = await request.json();
  if (!title?.trim()) return Response.json({ error: 'Title required' }, { status: 400 });
  try {
    const pool = getPool();
    const r = await pool.query(
      'INSERT INTO lms_courses (title, description, created_by) VALUES ($1,$2,$3) RETURNING *',
      [title.trim(), description || null, user.id]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
