import bcrypt from 'bcryptjs';
import { getPool } from '@/lib/db';
import { signToken } from '@/lib/api-auth';

export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return Response.json({ error: 'Username/email and password required' }, { status: 400 });
  }

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
    if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.display_name,
    });

    const res = Response.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.display_name },
    });

    res.headers.set(
      'Set-Cookie',
      `lms_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );

    return res;
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
