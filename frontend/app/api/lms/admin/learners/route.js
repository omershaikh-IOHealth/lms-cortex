import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { getUser } from '@/lib/auth-server';

export async function GET(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
             lp.id as profile_id, lp.learner_type_id,
             lt.name as learner_type, lt.name as learner_type_name,
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
    return NextResponse.json(result.rows);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'training'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, password, display_name, learner_type_id } = await request.json();
  if (!email || !password || !learner_type_id)
    return NextResponse.json({ error: 'email, password, learner_type_id are required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 12);
    const userRes = await client.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name)
      VALUES ($1, $2, 'learner', $3) RETURNING id, email, display_name, role, is_active
    `, [email.toLowerCase().trim(), hash, display_name || null]);
    const newUser = userRes.rows[0];
    await client.query(
      `INSERT INTO lms_learner_profiles (user_id, learner_type_id) VALUES ($1, $2)`,
      [newUser.id, learner_type_id]
    );
    await client.query('COMMIT');
    return NextResponse.json(newUser, { status: 201 });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally { client.release(); }
}
