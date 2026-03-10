import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/server-auth';

export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const pool = getPool();
  try {
    const identifier = email.toLowerCase().trim();
    const result = await pool.query(
      `SELECT * FROM auth_users
       WHERE is_active = true
         AND (lower(email) = $1 OR split_part(lower(email), '@', 1) = $1)`,
      [identifier]
    );
    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
    });

    const payload = { token, user: { id: user.id, email: user.email, role: user.role, display_name: user.display_name } };
    const response = NextResponse.json(payload);
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
