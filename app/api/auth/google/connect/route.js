import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server-auth';

// Initiates a Google OAuth flow purely to store Calendar + Chat tokens
// for the currently logged-in user (works even if they signed in with email/password).
export async function GET(request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback/google`;

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/chat.spaces.create',
      'https://www.googleapis.com/auth/chat.memberships',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent',
    // Encode user id in state so callback knows this is a connect (not login) flow
    state: `connect:${user.id}`,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
