import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';

export async function POST(request) {
  const { email, display_name, password } = await request.json();
  if (!email || !password || !display_name) {
    return NextResponse.json({ error: 'email, display_name, and password are required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 12);
    const result = await client.query(`
      INSERT INTO auth_users (email, password_hash, role, display_name, registration_status, is_active)
      VALUES ($1, $2, 'learner', $3, 'pending', false)
      RETURNING id, email, display_name
    `, [email.toLowerCase().trim(), hash, display_name.trim()]);

    const newUser = result.rows[0];

    // Notify all admins
    const admins = await client.query(`SELECT id FROM auth_users WHERE role = 'admin' AND is_active = true`);
    for (const admin of admins.rows) {
      await client.query(`
        INSERT INTO lms_notifications (user_id, title, body, type)
        VALUES ($1, 'New user registration request', $2, 'new_user_request')
      `, [admin.id, `${display_name} (${email}) has requested access to the LMS.`]);
    }

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, user: newUser }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
