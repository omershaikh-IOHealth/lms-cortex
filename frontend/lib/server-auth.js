import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'lms-dev-secret-change-in-prod';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function extractUser(request) {
  // Check cookie first, then Authorization header
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  let token = cookies['lms_token'];
  if (!token) {
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(request) {
  const user = extractUser(request);
  if (!user) {
    return { error: true, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { error: false, user };
}

export function requireRole(request, ...roles) {
  const auth = requireAuth(request);
  if (auth.error) return auth;
  if (!roles.includes(auth.user.role)) {
    return { error: true, response: Response.json({ error: `Forbidden. Required role: ${roles.join(' or ')}` }, { status: 403 }) };
  }
  return auth;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
