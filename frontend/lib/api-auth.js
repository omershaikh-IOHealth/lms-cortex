import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'lms-dev-secret-change-in-prod';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export async function verifyAuth(request) {
  // Try cookie first, then Authorization header
  let token;

  // From Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // From cookie
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get('lms_token')?.value;
  }

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden(msg = 'Forbidden') {
  return Response.json({ error: msg }, { status: 403 });
}
