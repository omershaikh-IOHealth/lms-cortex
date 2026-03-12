import crypto from 'crypto';

// ── Service Account Token Cache ───────────────────────────────────────────────
let _cachedToken = null;
let _tokenExpiry = 0;

function base64urlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getServiceAccountToken() {
  // Return cached token if still valid (with 5-min buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 300_000) {
    return _cachedToken;
  }

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('[Calendar] GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
    return null;
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch (e) {
    console.error('[Calendar] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header  = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64urlEncode(JSON.stringify({
    iss:   sa.client_email,
    sub:   process.env.GOOGLE_CALENDAR_IMPERSONATE || 'training@iohealth.com',
    scope: 'https://www.googleapis.com/auth/calendar',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));

  const signingInput = `${header}.${payload}`;
  let signature;
  try {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    sign.end();
    signature = sign.sign(sa.private_key, 'base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    console.error('[Calendar] JWT signing failed:', e.message);
    return null;
  }

  const jwt = `${signingInput}.${signature}`;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion:  jwt,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      console.error('[Calendar] Token exchange failed:', JSON.stringify(data));
      return null;
    }
    _cachedToken = data.access_token;
    _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return _cachedToken;
  } catch (e) {
    console.error('[Calendar] Token exchange request failed:', e.message);
    return null;
  }
}

// Normalize date/time values from PostgreSQL.
// node-postgres converts `date` columns to JS Date objects (in local timezone).
// Using String() or toISOString() on them gives wrong results.
// We must use local-time getters to extract the correct calendar date.
function normalizeDateTime(date, time) {
  let d;
  if (date instanceof Date) {
    const y   = date.getFullYear();
    const m   = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    d = `${y}-${m}-${day}`;
  } else {
    d = String(date).slice(0, 10);
  }
  const t = String(time).slice(0, 8); // "HH:MM:SS"
  return `${d}T${t}`;
}

const CALENDAR_ID = () => process.env.GOOGLE_CALENDAR_ID || 'training@iohealth.com';

// ── Google Calendar ───────────────────────────────────────────────────────────

export async function createCalendarEvent(session) {
  const token = await getServiceAccountToken();
  if (!token) return null;

  const startDT = normalizeDateTime(session.scheduled_date, session.start_time);
  const endDT   = normalizeDateTime(session.scheduled_date, session.end_time);
  console.log('[Calendar] raw date:', session.scheduled_date, 'start:', session.start_time, 'end:', session.end_time);
  console.log('[Calendar] normalized → start:', startDT, 'end:', endDT);

  const body = {
    summary:     session.title,
    description: session.description || '',
    location:    session.location    || '',
    start: { dateTime: startDT, timeZone: 'Asia/Dubai' },
    end:   { dateTime: endDT,   timeZone: 'Asia/Dubai' },
    conferenceData: {
      createRequest: {
        requestId:             `lms-${session.id}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  console.log('[Calendar] request body:', JSON.stringify(body));

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID())}/events?conferenceDataVersion=1`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );

  const resBody = await res.json();
  if (!res.ok) {
    console.error('[Calendar] create failed status:', res.status, 'body:', JSON.stringify(resBody));
    return null;
  }

  console.log('[Calendar] created event id:', resBody.id, 'meet:', resBody.conferenceData?.entryPoints);
  const meetEntry = resBody.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video');
  return {
    event_id:      resBody.id,
    calendar_link: resBody.htmlLink,
    meet_link:     meetEntry?.uri || null,
  };
}

export async function updateCalendarEvent(eventId, session) {
  const token = await getServiceAccountToken();
  if (!token) return;

  const body = {
    summary:     session.title,
    description: session.description || '',
    location:    session.location    || '',
    start: { dateTime: normalizeDateTime(session.scheduled_date, session.start_time), timeZone: 'Asia/Dubai' },
    end:   { dateTime: normalizeDateTime(session.scheduled_date, session.end_time),   timeZone: 'Asia/Dubai' },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID())}/events/${eventId}`,
    {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  if (!res.ok) console.error('Google Calendar update failed:', JSON.stringify(await res.json()));
}

export async function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  const token = await getServiceAccountToken();
  if (!token) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID())}/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
}
