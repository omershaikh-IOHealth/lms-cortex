import { getPool } from '@/lib/db';

// ── Token management ─────────────────────────────────────────────────────────

async function getValidAccessToken(userId) {
  const pool = getPool();
  const r = await pool.query(
    'SELECT * FROM google_calendar_tokens WHERE user_id = $1',
    [userId]
  );
  if (!r.rows[0]) return null;

  const { access_token, refresh_token, expiry } = r.rows[0];

  // Refresh if expiring within 5 minutes
  if (expiry && Date.now() >= expiry - 300_000) {
    if (!refresh_token) return null;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type:    'refresh_token',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Google token refresh failed:', data);
      return null;
    }
    const newExpiry = Date.now() + data.expires_in * 1000;
    await pool.query(
      `UPDATE google_calendar_tokens SET access_token=$1, expiry=$2, updated_at=NOW() WHERE user_id=$3`,
      [data.access_token, newExpiry, userId]
    );
    return data.access_token;
  }

  return access_token;
}

// ── Google Calendar ───────────────────────────────────────────────────────────

export async function createCalendarEvent(userId, session) {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  const body = {
    summary:     session.title,
    description: session.description || '',
    location:    session.location    || '',
    start: { dateTime: `${session.scheduled_date}T${session.start_time}:00`, timeZone: 'UTC' },
    end:   { dateTime: `${session.scheduled_date}T${session.end_time}:00`,   timeZone: 'UTC' },
    conferenceData: {
      createRequest: {
        requestId:             `lms-${session.id || Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error('Google Calendar create failed:', await res.json());
    return null;
  }

  const data = await res.json();
  const meetEntry = data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video');
  return {
    event_id:      data.id,
    calendar_link: data.htmlLink,
    meet_link:     meetEntry?.uri || null,
  };
}

export async function updateCalendarEvent(userId, eventId, session) {
  const token = await getValidAccessToken(userId);
  if (!token) return;

  const body = {
    summary:     session.title,
    description: session.description || '',
    location:    session.location    || '',
    start: { dateTime: `${session.scheduled_date}T${session.start_time}:00`, timeZone: 'UTC' },
    end:   { dateTime: `${session.scheduled_date}T${session.end_time}:00`,   timeZone: 'UTC' },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  if (!res.ok) console.error('Google Calendar update failed:', await res.json());
}

export async function deleteCalendarEvent(userId, eventId) {
  if (!eventId) return;
  const token = await getValidAccessToken(userId);
  if (!token) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
}

// ── Google Chat ───────────────────────────────────────────────────────────────

export async function createChatSpace(userId, sessionTitle) {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      displayName: `${sessionTitle} Chat`,
      spaceType:   'SPACE',
    }),
  });

  if (!res.ok) {
    console.error('Google Chat space create failed:', await res.json());
    return null;
  }

  const data = await res.json();
  const spaceId = data.name?.split('/')[1];
  return {
    space_id:   data.name,
    space_link: spaceId
      ? `https://mail.google.com/chat/#chat/space/${spaceId}`
      : null,
  };
}

export async function deleteChatSpace(userId, spaceId) {
  if (!spaceId) return;
  const token = await getValidAccessToken(userId);
  if (!token) return;

  await fetch(`https://chat.googleapis.com/v1/${spaceId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
