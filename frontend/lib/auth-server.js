// frontend/lib/auth-server.js
// Server-side JWT utilities for Next.js API Route Handlers
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lms-dev-secret-change-in-prod';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Extract and verify JWT from an incoming Next.js Request.
// Returns the decoded payload or null if missing/invalid.
export function getUser(request) {
  const header = request.headers.get('authorization');
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try { return verifyToken(token); } catch { return null; }
}

// Returns a 401 NextResponse — import NextResponse at call site
export function unauthorized() {
  const { NextResponse } = require('next/server');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  const { NextResponse } = require('next/server');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
