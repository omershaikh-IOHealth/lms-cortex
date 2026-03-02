import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getPool } from '@/lib/db';

const CORE42_URL = process.env.CORE42_API_URL || 'https://api.core42.ai/v1/chat/completions';
const CORE42_MODEL = process.env.CORE42_MODEL || 'gpt-4.1';

// Out-of-scope keywords — only used for non-admin roles
const SCOPE_KEYWORDS = [
  'training', 'course', 'session', 'user', 'attendance', 'progress',
  'schedule', 'lesson', 'department', 'organisation', 'organization',
  'feedback', 'analytics', 'enroll', 'enrolment', 'enrollment', 'learner',
  'trainer', 'section', 'module', 'video', 'completion', 'company',
  'companies', 'staff', 'role', 'capacity', 'location',
  // natural language variants
  'doctor', 'nurse', 'physician', 'clinician', 'student', 'employee',
  'person', 'people', 'member', 'team', 'group', 'org', 'hospital',
  'how many', 'who', 'which', 'list', 'show', 'find', 'count',
  'my ', 'i ', 'what', 'when', 'where',
];

function isInScope(role, message) {
  // Admins have full data access — never block their queries
  if (role === 'admin') return true;
  const lower = message.toLowerCase();
  return SCOPE_KEYWORDS.some(kw => lower.includes(kw));
}

// Call Core42 API with messages array
async function callCore42(messages) {
  if (!process.env.CORE42_API_KEY) {
    throw new Error('CORE42_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  let res;
  try {
    res = await fetch(CORE42_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CORE42_API_KEY}`,
      },
      body: JSON.stringify({
        model: CORE42_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    if (fetchErr.name === 'AbortError') throw new Error('Core42 request timed out after 30s');
    throw new Error(`Core42 network error: ${fetchErr.message}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const err = await res.text().catch(() => '(no body)');
    throw new Error(`Core42 error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Build role-specific schema description for the SQL generation prompt
function buildSchemaDescription(role, userId) {
  if (role === 'admin') {
    return `
You have access to ALL tables in the Cortex LMS PostgreSQL database (schema: test — no prefix needed):
- auth_users (id uuid, email, role, display_name, company_id, staff_id, departments[], specialties[], is_active)
- companies (id, company_code, company_name, description, domain, is_active)
- lms_physical_sessions (id, title, description, trainer_id uuid, scheduled_date, start_time, end_time, location, max_capacity, status, created_by uuid)
- lms_physical_enrollments (id, session_id, user_id uuid, attendance_status, acknowledged_at, marked_at, enrolled_by uuid, learner_type_id, marked_by uuid)
- lms_courses (id, title, description, is_active, created_by uuid)
- lms_sections (id, course_id, parent_section_id, title, sort_order)
- lms_lessons (id, section_id, title, video_url, manual_markdown, duration_seconds, sort_order, is_active, created_by uuid, updated_by uuid)
- lms_user_lesson_progress (id, user_id uuid, lesson_id, percent_watched, completed, completed_at, total_watch_seconds, watch_count, last_position_seconds, last_activity_at)
- lms_departments (id, name, description, is_active)
- lms_learner_types (id, name, description, is_active, created_by uuid)
- lms_learner_profiles (id, user_id uuid, learner_type_id, display_name)
- lms_lesson_assignments (id, learner_type_id, lesson_id, assigned_by uuid)
- lms_notifications (id, user_id uuid, title, body, is_read, type, reference_type, reference_id)
- lms_feedback (session_id, user_id uuid, rating, comment, created_at) — if this table exists
- lms_calendar_events (id, title, description, event_date, start_time, end_time, location, event_type, created_by uuid, department, specialty, status)
- lms_learning_sessions (id uuid, user_id uuid, lesson_id, session_started_at, session_ended_at, total_active_seconds, total_idle_seconds)
    `.trim();
  }

  if (role === 'trainer') {
    return `
You are a TRAINER. Your user ID is '${userId}'.
You can only query data related to YOUR sessions:
- lms_physical_sessions WHERE trainer_id = '${userId}'
- lms_physical_enrollments for sessions you train (JOIN lms_physical_sessions ON session_id = lms_physical_sessions.id WHERE lms_physical_sessions.trainer_id = '${userId}')
- auth_users but ONLY for users enrolled in your sessions (JOIN lms_physical_enrollments JOIN lms_physical_sessions WHERE trainer_id = '${userId}')
- lms_feedback (session_id, user_id uuid, rating, comment, created_at) for your sessions only
DO NOT access: lms_courses, lms_lessons, lms_user_lesson_progress, or other trainer's data.
    `.trim();
  }

  // learner
  return `
You are a LEARNER. Your user ID is '${userId}'.
You can only query YOUR OWN data:
- lms_user_lesson_progress WHERE user_id = '${userId}'
- lms_physical_enrollments WHERE user_id = '${userId}'
- lms_physical_sessions that you are enrolled in (JOIN lms_physical_enrollments WHERE user_id = '${userId}')
- lms_lessons.manual_markdown only for lessons assigned to your learner type (via lms_lesson_assignments JOIN lms_learner_profiles WHERE lms_learner_profiles.user_id = '${userId}')
DO NOT access: other users' data, auth_users, companies, or admin tables.
  `.trim();
}

// Step 1 system prompt: SQL generation
function buildSQLSystemPrompt(role, userId, userProfile) {
  const schema = buildSchemaDescription(role, userId);
  return `You are a SQL expert for the Cortex LMS PostgreSQL database.
Given a user question, generate a single read-only PostgreSQL SELECT query that answers it.
Return ONLY the raw SQL query — no explanation, no markdown fences, no commentary.

CRITICAL RULES:
1. Only generate SELECT statements — never INSERT, UPDATE, DELETE, DROP, CREATE, TRUNCATE, or any DDL/DML.
2. If the question cannot be answered with SQL, return exactly: NOT_SQL
3. Always use table names without schema prefix (the search_path is already set to test).
4. Add appropriate WHERE clauses — do NOT return all rows without filtering unless explicitly asked for a list.
5. Use LIMIT 50 maximum.
6. Use proper JOINs to get meaningful data.
7. For date/time fields, format them readably (e.g., TO_CHAR).

USER CONTEXT:
- Name: ${userProfile.display_name || 'Unknown'}
- Role: ${role}
- User ID: ${userId}
- Company ID: ${userProfile.company_id || 'N/A'}

ALLOWED SCHEMA FOR THIS USER:
${schema}`;
}

// Step 2 system prompt: natural language answer
function buildAnswerSystemPrompt() {
  return `You are a helpful AI assistant for Cortex LMS — a Learning Management System.
Your job is to answer the user's question based on database query results provided to you.

RULES:
- Be concise, clear, and helpful.
- If the data is empty or null, say "I couldn't find any matching information."
- Format numbers and dates readably.
- If there are many results, summarise them (e.g., "There are 15 sessions, here are the top 5...").
- Do not expose raw UUIDs unless specifically asked.
- Do not make up data that wasn't in the query results.
- Stay focused on LMS topics: training, courses, sessions, attendance, progress, learners, feedback.
- If the question is out of scope, politely decline.`;
}

// Ensure SQL has a LIMIT clause
function ensureLimit(sql, limit = 50) {
  const upper = sql.toUpperCase();
  if (upper.includes('LIMIT')) return sql;
  return `${sql.trimEnd()} LIMIT ${limit}`;
}

// Check if text looks like a SELECT query
function looksLikeSelect(text) {
  return /^\s*SELECT\s/i.test(text.trim());
}

// Execute SQL safely
async function executeSql(pool, sql) {
  const safeSQL = ensureLimit(sql);
  const result = await pool.query(safeSQL);
  return result.rows;
}

export async function POST(request) {
  const pool = getPool();
  let existingMessages = [];

  try {
    // 1. Auth
    const { authError, user } = await requireAuth(request);
    if (authError) return authError;

    const userId = user.id || user.sub;
    const role = user.role;

    // 2. Parse request body
    const body = await request.json();
    const { message, currentPage } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check if CORE42_API_KEY is configured
    if (!process.env.CORE42_API_KEY) {
      return NextResponse.json({
        reply: 'The AI assistant is not configured yet. Please contact your administrator.',
        messages: [],
      });
    }

    // 3. Load conversation history from DB
    const sessionRes = await pool.query(
      'SELECT messages FROM ai_companion_sessions WHERE user_id = $1',
      [String(userId)]
    );
    existingMessages = sessionRes.rows[0]?.messages || [];

    // 4. Get user's full profile
    const profileRes = await pool.query(
      `SELECT u.display_name, u.company_id, u.departments, u.specialties, u.role,
              c.company_name
       FROM auth_users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1::uuid`,
      [userId]
    );
    const userProfile = profileRes.rows[0] || {};

    // 5. Out-of-scope check (admins are always in scope)
    if (!isInScope(role, message)) {
      const outOfScopeReply =
        "I can only help with questions related to your training and courses. Please ask me about your sessions, courses, attendance, or progress.";

      const newMessages = [
        ...existingMessages,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: outOfScopeReply, timestamp: new Date().toISOString() },
      ];

      await pool.query(
        `INSERT INTO ai_companion_sessions (user_id, messages, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE SET messages = $2::jsonb, updated_at = NOW()`,
        [String(userId), JSON.stringify(newMessages)]
      );

      return NextResponse.json({ reply: outOfScopeReply, messages: newMessages });
    }

    // 6. Build conversation context (last 10 messages)
    const recentHistory = existingMessages.slice(-10);

    // -- STEP 1: Generate SQL --
    const sqlSystemPrompt = buildSQLSystemPrompt(role, userId, userProfile);
    const contextHint = currentPage ? ` (User is currently on page: ${currentPage})` : '';

    const sqlMessages = [
      { role: 'system', content: sqlSystemPrompt },
      ...recentHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: `${message}${contextHint}` },
    ];

    let generatedSQL = '';
    let sqlResults = [];
    let sqlError = null;

    try {
      generatedSQL = await callCore42(sqlMessages);
    } catch (e) {
      sqlError = e.message;
    }

    // 7. Safety check: must look like SELECT
    if (!sqlError && generatedSQL && looksLikeSelect(generatedSQL) && generatedSQL.trim() !== 'NOT_SQL') {
      // 8. Execute SQL
      try {
        sqlResults = await executeSql(pool, generatedSQL);
      } catch (execErr) {
        sqlError = execErr.message;

        // 9. Retry: ask Core42 for a corrected query
        try {
          const retryMessages = [
            { role: 'system', content: sqlSystemPrompt },
            ...recentHistory.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: `${message}${contextHint}` },
            { role: 'assistant', content: generatedSQL },
            {
              role: 'user',
              content: `That query failed with error: ${execErr.message}. Please generate a corrected SQL query.`,
            },
          ];
          const retrySQL = await callCore42(retryMessages);

          if (looksLikeSelect(retrySQL)) {
            try {
              sqlResults = await executeSql(pool, retrySQL);
              sqlError = null;
              generatedSQL = retrySQL;
            } catch {
              // Both attempts failed — proceed with empty results
            }
          }
        } catch {
          // Retry itself failed — proceed with empty results
        }
      }
    } else if (!sqlError && generatedSQL === 'NOT_SQL') {
      // Model says no SQL needed (e.g., general question) — proceed with empty results
      sqlResults = [];
    }

    // 10. STEP 2: Generate natural language answer
    const answerSystemPrompt = buildAnswerSystemPrompt();
    const userMsgWithData = `${message}\n\nDatabase results:\n${JSON.stringify(sqlResults, null, 2)}`;

    const answerMessages = [
      { role: 'system', content: answerSystemPrompt },
      ...recentHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMsgWithData },
    ];

    let reply = '';
    try {
      reply = await callCore42(answerMessages);
    } catch (e) {
      console.error('[AI Chat] Answer generation failed:', e.message);
      reply = `I ran into an issue generating a response: ${e.message}`;
    }

    if (!reply) {
      reply = "I ran into an issue processing your request. Please try again.";
    }

    // 12. Save to DB — upsert conversation history
    const newMessages = [
      ...existingMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
    ];

    await pool.query(
      `INSERT INTO ai_companion_sessions (user_id, messages, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET messages = $2::jsonb, updated_at = NOW()`,
      [String(userId), JSON.stringify(newMessages)]
    );

    // 13. Return
    return NextResponse.json({ reply, messages: newMessages });
  } catch (err) {
    console.error('[AI Chat] Unhandled error:', err);
    return NextResponse.json({
      reply: `I ran into an issue processing your request: ${err.message}`,
      messages: existingMessages,
    });
  }
}
