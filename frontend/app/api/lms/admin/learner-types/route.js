import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function GET(request) {
  const { user, error } = await guard(request);
  if (error) return error;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT lt.*, u.display_name as created_by_name,
        COUNT(lp.id)::int as learner_count
      FROM lms_learner_types lt
      LEFT JOIN auth_users u ON lt.created_by = u.id
      LEFT JOIN lms_learner_profiles lp ON lp.learner_type_id = lt.id
      GROUP BY lt.id, u.display_name
      ORDER BY lt.name
    `);
    return Response.json(result.rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = await guard(request);
  if (error) return error;
  const { name, description } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 });
  try {
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO lms_learner_types (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description, user.id]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') return Response.json({ error: 'Learner type name already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  }
}
