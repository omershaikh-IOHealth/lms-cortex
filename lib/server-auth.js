import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

if (!process.env.JWT_SECRET) {
  // Fail hard in production; warn in dev so the app still starts.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production.');
  } else {
    console.error('[server-auth] WARNING: JWT_SECRET is not set. Using insecure fallback. Set JWT_SECRET in your .env file.');
  }
}
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-insecure-fallback-do-not-use'
);
const COOKIE_NAME = 'lms_token';
const MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthUser(request) {
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookieToken || headerToken;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
}

// Returns { user } or sends a 401 response
export async function requireAuth(request) {
  const user = await getAuthUser(request);
  if (!user) {
    return { authError: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { authError: null, user };
}

// Returns { user } or sends a 401/403 response
export async function requireRole(request, ...roles) {
  const { authError, user } = await requireAuth(request);
  if (authError) return { authError, user: null };
  if (!roles.includes(user.role)) {
    return {
      authError: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
    };
  }
  return { authError: null, user };
}
