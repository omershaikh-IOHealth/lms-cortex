import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { verifyAuth, unauthorized, forbidden } from '@/lib/api-auth';

async function guard(request) {
  const user = await verifyAuth(request);
  if (!user) return { error: unauthorized() };
  if (!['admin', 'training'].includes(user.role)) return { error: forbidden() };
  return { user };
}

export async function GET(request) {
  const { error } = await guard(request);
  if (error) return error;
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
             lp.id as profile_id, lp.learner_type_id,
             lt.name as learner_type_name,
             COUNT(DISTINCT ulp.lesson_id) FILTER (WHERE ulp.completed = true)::int as completed_lessons,
             COUNT(DISTINCT ulp.lesson_id)::int as started_lessons
      FROM auth_users u
      LEFT JOIN lms_learner_profiles lp ON lp.user_id = u.id
      LEFT JOIN lms_learner_types lt ON lp.learner_type_id = lt.id
      LEFT JOIN lms_user_lesson_progress ulp ON ulp.user_id = u.id
      WHERE u.role = 'learner'
      GROUP BY u.id, lp.id, lp.learner_type_id, lt.name
      ORDER BY u.display_name
    `);
    return Response.json(result.rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, error } = await guard(request);
  if (error) return error;
  const { email, password, display_name, learner_type_id } = await request.json();
  if (!email || !password || !learner_type_id) {
    return Response.json({ error: 'email, password, learner_type_id are required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 12);
    const userRes = await client.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name)
      VALUES ($1, $2, 'learner', $3) RETURNING id, email, display_name, role, is_active
    `, [email.toLowerCase().trim(), hash, display_name]);
    const newUser = userRes.rows[0];
    await client.query(`
      INSERT INTO lms_learner_profiles (user_id, learner_type_id, display_name)
      VALUES ($1, $2, $3)
    `, [newUser.id, learner_type_id, display_name]);
    await client.query('COMMIT');
    return Response.json(newUser, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return Response.json({ error: 'Email already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
