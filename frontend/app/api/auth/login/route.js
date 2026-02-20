import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { signToken } from '@/lib/auth-server';

export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password)
    return NextResponse.json({ error: 'Username/email and password required' }, { status: 400 });

  try {
    const pool = getPool();
    const identifier = email.toLowerCase().trim();
    const result = await pool.query(
      `SELECT * FROM auth_users
       WHERE is_active = true
         AND (lower(email) = $1 OR split_part(lower(email), '@', 1) = $1)`,
      [identifier]
    );
    const user = result.rows[0];
    if (!user)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = signToken({
      id: user.id, email: user.email, role: user.role, name: user.display_name,
    });

    const response = NextResponse.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.display_name },
    });
    response.cookies.set('lms_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
