# Cortex LMS — Comprehensive Enhancement Plan
> Paste this entire file into your terminal for Claude Code to execute.
> Repo: `nadijb/omer-lms` (Next.js frontend + Express/Next API routes + Supabase)

---

## CONTEXT & PRINCIPLES
- All changes must maintain the existing `cortex` theme system (cortex-bg, cortex-surface, cortex-border, cortex-accent, cortex-muted, cortex-text, cortex-danger)
- No new external UI libraries. Use existing SVG icon pattern already in the codebase.
- All API routes live under `app/api/lms/` and use `requireRole` from `@/lib/server-auth`
- Database schema is under the `test` schema in Supabase/PostgreSQL
- Video uploads must use direct-to-Supabase signed URL flow (not proxied through Next.js)
- Every user-facing change must feel intelligent, intuitive, and seamless — no dead ends, no confusing states

---

## PHASE 1 — DATABASE MIGRATIONS
Run these SQL migrations against the `test` schema first.

```sql
-- 1a. Add trainer permission flag to auth_users
ALTER TABLE test.auth_users ADD COLUMN IF NOT EXISTS can_upload_content boolean DEFAULT false;

-- 1b. Pending/request user registration queue
ALTER TABLE test.auth_users ADD COLUMN IF NOT EXISTS registration_status varchar DEFAULT 'active';
-- Values: 'pending' (self-registered, awaiting admin), 'active' (approved), 'rejected'

-- 1c. Add Google Meet link to physical sessions
ALTER TABLE test.lms_physical_sessions ADD COLUMN IF NOT EXISTS google_meet_link text;
ALTER TABLE test.lms_physical_sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id varchar;
ALTER TABLE test.lms_physical_sessions ADD COLUMN IF NOT EXISTS google_calendar_link text;

-- 1d. Track Google Calendar RSVP per enrollment (accepted/declined/pending)
ALTER TABLE test.lms_physical_enrollments ADD COLUMN IF NOT EXISTS google_rsvp_status varchar DEFAULT 'pending';
-- Values: 'pending', 'accepted', 'declined', 'tentative'

-- 1e. Chat messages table for in-LMS Google Chat per session
CREATE TABLE IF NOT EXISTS test.lms_session_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id integer NOT NULL REFERENCES test.lms_physical_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES test.auth_users(id),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- Index for fast per-session queries
CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON test.lms_session_messages(session_id);

-- 1f. "New" content tag — track when a learner first views a lesson
ALTER TABLE test.lms_user_lesson_progress ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

-- 1g. Track lesson assignment timestamp so we know what is "new" for each learner type
ALTER TABLE test.lms_lesson_assignments ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- 1h. Ensure lms_notifications has a 'new_content' type and reference columns (already exist, just confirming)
-- type: 'new_content' | 'session_scheduled' | 'session_updated' | 'session_cancelled'
-- reference_type: 'lesson' | 'physical_session'
-- reference_id: integer

-- 1i. Add reset tracking to physical enrollments for acknowledgment
ALTER TABLE test.lms_physical_enrollments ADD COLUMN IF NOT EXISTS last_session_updated_at timestamptz;
-- When session is edited, set this to now() for all enrollees; acknowledged_at becomes invalid if acknowledged_at < last_session_updated_at
```

---

## PHASE 2 — TRAINER ROLE & USER MANAGEMENT

### 2.1 Admin: User Request Queue (`/lms/admin/users`)
**File:** `app/lms/admin/users/page.js` — CREATE NEW

Build a full user management page with two tabs:
- **Pending Requests** tab: lists users where `registration_status = 'pending'`. Each row shows email, name, created_at, and two actions: "Approve & Assign Role" (opens a modal with role dropdown: learner/trainer/admin/training + learner_type selector if role=learner) and "Reject".
- **All Users** tab: shows all active users with their role, a "Change Role" button, "Toggle Active" toggle, and for trainers a "Allow Content Upload" toggle (sets `can_upload_content`).
- **Add New User** button: opens modal with fields: email, display_name, password, role. On submit, creates user directly as `registration_status = 'active'`.

**API routes needed:**
- `GET /api/lms/admin/users` — fetch all users with role + registration_status
- `POST /api/lms/admin/users` — create new user (admin-created = active immediately)
- `PUT /api/lms/admin/users/[id]/approve` — set registration_status='active', assign role, create lms_learner_profiles if role=learner
- `PUT /api/lms/admin/users/[id]/reject` — set registration_status='rejected', is_active=false
- `PUT /api/lms/admin/users/[id]/role` — change role, toggle can_upload_content, toggle is_active

**Add to ADMIN_NAV in `app/lms/layout.js`:**
```js
{ href: "/lms/admin/users", label: "Users", icon: "users" },
```
(Replace or supplement the existing "Learners" nav item — keep Learners for progress view, Users for management)

### 2.2 Self-Registration Flow (`app/register/page.js`)
**File:** `app/register/page.js` — CREATE NEW (or update existing login/signup)

- Simple form: email, display_name, password, confirm password
- On submit: calls `POST /api/auth/register` which creates user with `registration_status = 'pending'`, `role = 'learner'` (placeholder), `is_active = false`
- Shows a friendly "Your request has been submitted. An admin will review and activate your account." message
- Admin gets a notification (lms_notifications to all admins) when new pending user registers

**API:** `POST /api/auth/register` — create pending user, notify admins

### 2.3 Trainer Dashboard (`/lms/trainer`)
**File:** `app/lms/trainer/page.js` — UPDATE EXISTING (currently minimal)

Build a full trainer dashboard with:
- **My Sessions** panel (left sidebar, same pattern as admin physical-training): lists sessions where `trainer_id = me`, sorted by date. Past sessions shown as blurred/muted cards.
- **Session Detail** panel (right): when a session is selected, shows:
  - Session info (date, time, location, description)
  - Google Meet link (if exists) — prominent button "Join Meeting"
  - Google Calendar link
  - Enrolled learners list with attendance marking (Present/Absent buttons) — same as admin view
  - Learner progress for that session's enrolled users (watch progress on assigned lessons)
  - If `can_upload_content = true`: a "+ Upload Content" button that opens the lesson upload panel (same as admin content page but scoped to their sessions' learner types)
- **Add to TRAINER_NAV:**
```js
{ href: "/lms/trainer", label: "My Sessions", icon: "calendar" },
{ href: "/lms/trainer/messages", label: "Messages", icon: "message-circle" },
```

**API routes needed:**
- `GET /api/lms/trainer/sessions` — sessions where trainer_id = current user
- `GET /api/lms/trainer/sessions/[id]/enrollments` — enrollments + attendance for trainer's session
- `PUT /api/lms/trainer/sessions/[id]/attendance` — mark attendance (same logic as admin route)
- `GET /api/lms/trainer/sessions/[id]/progress` — learner lesson progress for enrolled users

---

## PHASE 3 — CONTENT MANAGEMENT UX OVERHAUL

### 3.1 Lesson Content Types — Dynamic Display
**File:** `app/lms/learn/[courseId]/[lessonId]/page.js` (learner lesson view) — UPDATE

Currently the lesson viewer likely always renders both a video player area and a manual area. Change to:
- If `lesson.video_url` exists → render video player
- If `lesson.manual_markdown` exists → render markdown below video (or alone if no video)
- If neither → show "No content available yet" placeholder
- Never show an empty video player or empty markdown area

**File:** `app/lms/admin/content/page.js` — UPDATE lesson form panel

In the lesson edit/create panel on the right side:
- Remove the raw "Video" and "Manual (Markdown)" field labels
- Instead show two toggle cards at the top of the form:
  ```
  [ 🎬 Add Video  ] [ 📄 Add User Manual ]
  ```
  Each card is a toggle. When toggled ON, the upload/input area expands below it.
- Video card when expanded: shows existing video thumbnail/name if present, drag-drop upload zone, "* Max 500MB, 2–5 minutes recommended" disclaimer, file size validation
- Manual card when expanded: shows markdown textarea with a mini live preview toggle
- This makes it visually obvious what content is attached to the lesson

### 3.2 Video Upload — Direct to Supabase (Fix 7MB issue)
**File:** `app/lms/admin/content/page.js` — UPDATE `saveLesson` and video upload handler
**File:** `app/api/lms/admin/content/upload-url/route.js` — ALREADY EXISTS, use it

The existing proxy-through-server upload causes timeouts. Switch to direct upload:

```
1. Client picks video file
2. Client-side validation BEFORE upload:
   - Check file.size > 500MB → show error "File too large. Max 500MB."  
   - Check via video element: load metadata, check duration > 600s (10 min) → warn "Video is longer than recommended (5 min). Consider trimming."
   - No hard duration block — just a warning. Size limit IS enforced.
3. Client calls POST /api/lms/admin/content/upload-url with { filename, contentType }
4. Gets back { uploadUrl, publicUrl }
5. Client does PUT fetch(uploadUrl, { method:'PUT', body: file }) directly to Supabase
6. Shows upload progress bar (use XMLHttpRequest with progress event, not fetch)
7. On success, stores publicUrl in form state
8. Form save sends publicUrl as video_url (no file in FormData)
```

Show a progress bar during upload with percentage. Show "Uploading… 47%" text. On error show clear message.

**File:** `app/api/lms/admin/content/lessons/route.js` — UPDATE POST handler to accept `video_url` as plain text (not file) when client does direct upload. Already handles this via the JSON body path.

### 3.3 Section/Content Tree — Simplified UX
**File:** `app/lms/admin/content/page.js` — UPDATE

The current three-panel layout (courses list → tree → edit panel) is functional but the "new section" flow requires knowing about parent_section_id. Simplify:

- In the content tree (middle panel), add inline "+ Add Section" and "+ Add Sub-section" buttons that appear on hover next to each section heading. Clicking opens a small inline input (not a full side panel) for just the title — confirm with Enter.
- "+ Add Lesson" button similarly appears inline next to each section on hover.
- The full edit panel on the right is for detailed editing after creation.
- For new lesson creation, auto-populate `section_id` based on which section the "+" was clicked on.
- This eliminates the confusion of selecting section from a dropdown in the panel.

---

## PHASE 4 — ADMIN VIDEO PREVIEW

### 4.1 Lesson Preview in Content Page
**File:** `app/lms/admin/content/page.js` — UPDATE

In the content tree (middle panel), when a lesson row is clicked (not the edit pencil, but the row itself), show a preview panel instead of the edit panel. The preview panel:
- Shows the lesson exactly as a learner sees it: video player (if video_url exists), markdown rendered below (if manual_markdown exists)
- Has an "Edit" button at the top right that switches to the edit panel
- Has a "Hide from learners" toggle (is_active) and "Delete" button
- This is the #15 requirement: admin sees learner view + admin controls

Implement a `panel.type = 'preview_lesson'` state in addition to existing panel types.

---

## PHASE 5 — NOTIFICATIONS (IN-APP BELL)

### 5.1 New Content Notifications
**File:** `app/api/lms/admin/content/lessons/route.js` — UPDATE POST handler

After creating a lesson, if it gets assigned to learner types (or on assignment), trigger notifications:
- When a lesson is added to an assignment (`POST /api/lms/admin/assignments`), find all users with that learner_type_id, create lms_notifications rows for each:
  ```sql
  INSERT INTO lms_notifications (user_id, title, body, link, type, reference_type, reference_id)
  VALUES ($userId, 'New lesson available', $lessonTitle, '/lms/learn', 'new_content', 'lesson', $lessonId)
  ```
- Set `notified_at = now()` on the lms_lesson_assignments row

**File:** `app/api/lms/admin/assignments/route.js` (toggle endpoint) — UPDATE to trigger notifications on assign

### 5.2 "NEW" Tag on Learner Lesson List
**File:** `app/lms/learn/page.js` (curriculum/lesson list) — UPDATE

- A lesson is "new" if: `lms_lesson_assignments.notified_at` is within last 14 days AND `lms_user_lesson_progress.first_viewed_at` IS NULL for this user
- Show a small "NEW" badge (cortex-accent background, white text, text-[10px]) next to lesson title
- When learner first opens the lesson, set `first_viewed_at = now()` on their progress row → the badge disappears on next load

**File:** `app/api/lms/lessons/[id]/progress` (watch progress update route) — UPDATE to set `first_viewed_at` on first call if null

### 5.3 Session Notification on Schedule/Edit
When admin creates or edits a physical session:
- Create lms_notifications for all enrolled users:
  - Create: title "New training session scheduled", body includes date/time/location
  - Edit/reschedule: title "Training session updated — please re-acknowledge", link to /lms/learn/schedule
- This is already partially done; ensure it fires on edit too

---

## PHASE 6 — GOOGLE INTEGRATIONS

### 6.1 Google Calendar + Meet for Physical Sessions
**File:** `app/api/lms/admin/physical-sessions/route.js` — UPDATE POST (create session)
**File:** `app/api/lms/admin/physical-sessions/[id]/route.js` — UPDATE PUT (edit session)
**File:** `lib/google-calendar.js` — CREATE or UPDATE

When creating a physical session:
1. Call Google Calendar API to create an event with:
   - summary: session title
   - description: session description
   - start: scheduled_date + start_time (convert to ISO datetime with timezone)
   - end: scheduled_date + end_time
   - location: session location
   - conferenceData: { createRequest: { requestId: uuid } } → this generates Google Meet link
   - attendees: array of enrolled users' emails (fetch from auth_users)
2. Store returned `google_calendar_event_id`, `google_calendar_link`, and `google_meet_link` (from conferenceData.entryPoints) on the session row

When editing a session (reschedule):
1. Update the Google Calendar event via PATCH with new date/time
2. Re-notify attendees through Google Calendar (Google handles email notifications)
3. Reset acknowledgments: `UPDATE lms_physical_enrollments SET acknowledged_at = NULL, last_session_updated_at = NOW() WHERE session_id = $1`
4. Create lms_notifications for all enrollees

When enrolling new users to an existing session:
1. PATCH the Google Calendar event to add new attendees
2. Create lms_notifications for newly enrolled users

**Google Calendar OAuth** (already partially set up via `google_calendar_tokens` table):
- `lib/google-calendar.js`: export functions `createCalendarEvent(sessionData, attendeeEmails, adminUserId)`, `updateCalendarEvent(eventId, sessionData, adminUserId)`, `addAttendeesToEvent(eventId, emails, adminUserId)`
- Use the `google_calendar_tokens` table to get/refresh the admin's OAuth token
- Add a "Connect Google Calendar" button in admin settings if token doesn't exist

### 6.2 Google Meet Link Display
**File:** `app/lms/admin/physical-training/page.js` — UPDATE session detail panel

Show Google Meet link prominently:
```
[ 📹 Join Google Meet ]  [ 📅 View in Calendar ]
```
Both as styled link-buttons. Only show if links exist.

**File:** `app/lms/learn/schedule/page.js` — UPDATE session cards

On upcoming sessions, show:
```
[ 📹 Join Meeting ]  [ 📅 Add to Calendar ]
```
On past sessions, these buttons don't appear.

### 6.3 Google Calendar RSVP Sync
**File:** `app/api/lms/admin/physical-sessions/[id]/rsvp-sync/route.js` — CREATE

- `GET /api/lms/admin/physical-sessions/[id]/rsvp-sync` — fetch RSVP statuses from Google Calendar API for this event's attendees, update `google_rsvp_status` in lms_physical_enrollments
- Show RSVP status next to each enrollee in admin view: "✓ Accepted" (green) / "✗ Declined" (red) / "? Tentative" / "⏳ Pending"
- Auto-sync on page load in the physical training admin page

---

## PHASE 7 — IN-LMS MESSAGING (Per Session Chat)

### 7.1 Message API
**File:** `app/api/lms/sessions/[id]/messages/route.js` — CREATE

```
GET  /api/lms/sessions/[id]/messages  — fetch last 100 messages for session (auth: enrolled user, trainer of session, admin)
POST /api/lms/sessions/[id]/messages  — send message (auth: same)
```

GET returns: `[{ id, user_id, display_name, message, created_at }]`
POST body: `{ message: string }`

Authorization check: user must be enrolled in this session OR be the session's trainer OR be admin/training role.

### 7.2 Chat UI — Trainer View
**File:** `app/lms/trainer/messages/page.js` — CREATE NEW

- Left panel: list of trainer's sessions (past and upcoming) — clicking shows chat
- Right panel: chat interface for selected session
  - Message list (scrollable, newest at bottom)
  - Input box at bottom with Send button
  - Auto-poll every 10 seconds for new messages (simple polling, no websockets needed for LAN)
  - Show sender name + timestamp on each message
  - Trainer's own messages right-aligned, others left-aligned

**File:** `app/lms/learn/schedule/page.js` — UPDATE

On each session card (upcoming only), add a "💬 Session Chat" button that expands a chat panel inline below the session card:
- Same chat interface as trainer view but embedded
- Shows last 20 messages, with "Load more" 
- Input + Send at bottom

### 7.3 Admin Chat Access
**File:** `app/lms/admin/physical-training/page.js` — UPDATE

In the session detail panel, add a "💬 Chat" tab alongside the attendance view. Shows the session's chat thread. Admin can post messages.

---

## PHASE 8 — PAST SESSIONS — BLURRED LOCKED STATE

### 8.1 Past Session Visual Treatment
**File:** `app/lms/learn/schedule/page.js` — UPDATE

A session is "past" if `scheduled_date < today's date`.

For past sessions in the learner's schedule:
- Card has `opacity-60 pointer-events-none` overlay
- Apply a blur filter on the card body: `filter: blur(1px)` via inline style or a CSS class
- Date badge, title, time are still legible but muted
- Show attendance badge prominently: green "✓ Attended" or red "✗ Missed" or grey "—"
- No expand-on-click, no acknowledge button, no chat button
- In the filter tabs, "Upcoming" tab (default) only shows future sessions; "Past" tab shows blurred past sessions

**File:** `app/lms/admin/physical-training/page.js` — UPDATE

Past sessions in the admin sidebar list:
- Show with muted/grey styling and a "Past" pill badge
- Still fully clickable and editable for admin (no blur for admin)
- Show "PAST" label in the session card

---

## PHASE 9 — ACKNOWLEDGMENT IMPROVEMENTS

### 9.1 Acknowledgment Logic Fix
**File:** `app/lms/learn/schedule/page.js` — UPDATE

A session requires re-acknowledgment if:
```js
const needsAck = !s.acknowledged_at || 
  (s.last_session_updated_at && new Date(s.acknowledged_at) < new Date(s.last_session_updated_at));
```

Show states:
- Needs acknowledgment → blue "Acknowledge" button with pulse animation
- Acknowledged (and not updated since) → green "✓ Acknowledged" with a subtle "Undo" link in small text below
- Past sessions → no acknowledge button (irrelevant)

**"Undo" / Unacknowledge:**
- Small grey "Undo acknowledgment" text link below the green check
- On click: calls `DELETE /api/lms/schedule/[sessionId]/acknowledge` which sets `acknowledged_at = NULL`
- Only available for future sessions (scheduled_date >= today)

**File:** `app/api/lms/schedule/[id]/acknowledge/route.js` — UPDATE to handle DELETE method

### 9.2 Admin Acknowledgment View
**File:** `app/lms/admin/physical-training/page.js` — UPDATE enrollment table

In the attendance table, add an "Ack" column:
- Show "✓ Ack'd" (green, with date tooltip) or "⏳ Pending" (amber) or "🔄 Needs re-ack" (blue, when session was updated after their acknowledgment)
- Make it visually scannable at a glance — colored pills, not just text

---

## PHASE 10 — NOTIFICATION BELL IMPROVEMENTS

### 10.1 Show notification bell for trainers too
**File:** `app/lms/layout.js` — UPDATE

Currently bell is only for `user.role === 'learner'`. Change to show for learner AND trainer:
```js
{(user.role === 'learner' || user.role === 'trainer') && <NotificationBell />}
```

### 10.2 Notification content for "new_content" type
**File:** `components/NotificationBell.js` — UPDATE

When rendering a notification of type `new_content`:
- Show a blue dot indicator
- Title: "New lesson: [lesson title]"
- On click: navigate to the lesson, mark notification as read
- "NEW" badge on the lesson list disappears after first view (handled by first_viewed_at)

---

## PHASE 11 — SPECIFIC FILE CHANGE SUMMARY

Here is the complete list of files to create or modify:

### CREATE NEW
```
app/lms/admin/users/page.js
app/lms/trainer/messages/page.js
app/api/lms/admin/users/route.js
app/api/lms/admin/users/[id]/approve/route.js
app/api/lms/admin/users/[id]/reject/route.js
app/api/lms/admin/users/[id]/role/route.js
app/api/lms/sessions/[id]/messages/route.js
app/api/lms/admin/physical-sessions/[id]/rsvp-sync/route.js
app/register/page.js
app/api/auth/register/route.js
lib/google-calendar.js  (or update if exists)
```

### UPDATE EXISTING
```
app/lms/layout.js                              — add Users nav, show bell for trainer, trainer nav items
app/lms/admin/physical-training/page.js        — Meet link, RSVP status, past session styling, chat tab, ack view
app/lms/admin/content/page.js                  — toggle-card content type UI, direct upload flow, inline add section
app/lms/learn/schedule/page.js                 — past blur, meet link, undo-ack, chat inline, re-ack logic
app/lms/learn/page.js                          — NEW badge on lessons
app/lms/trainer/page.js                        — full trainer dashboard rebuild
app/api/lms/admin/content/lessons/route.js     — notify on create (if already assigned)
app/api/lms/admin/assignments/route.js         — notify on lesson assignment toggle
app/api/lms/admin/physical-sessions/route.js   — Google Calendar + Meet on create, notify enrollees
app/api/lms/admin/physical-sessions/[id]/route.js — update Calendar event, reset ack on edit
app/api/lms/admin/physical-sessions/[id]/enroll/route.js — notify new enrollees, add to Calendar
app/api/lms/schedule/[id]/acknowledge/route.js — add DELETE method for un-acknowledge
app/components/NotificationBell.js             — new_content notification type handling
```

---

## PHASE 12 — IMPLEMENTATION ORDER (for Claude Code)

Execute in this order to avoid broken dependencies:

1. **DB migrations** (Phase 1 SQL) — run first, everything depends on schema
2. **lib/google-calendar.js** — needed by session routes
3. **User management API routes** (Phase 2.1 APIs)
4. **Auth register API + register page** (Phase 2.2)
5. **Trainer API routes** (Phase 2.3 APIs)
6. **Admin users page** `/lms/admin/users/page.js`
7. **Trainer dashboard page** `/lms/trainer/page.js`
8. **Content page overhaul** (Phase 3 — toggle cards, direct upload, inline add)
9. **Admin video preview** (Phase 4)
10. **Notifications** (Phase 5 — API updates + NEW badge)
11. **Google Calendar + Meet integration** on session routes (Phase 6)
12. **Messages API + Chat UI** (Phase 7)
13. **Past sessions blur** (Phase 8)
14. **Acknowledgment improvements** (Phase 9)
15. **Layout + bell updates** (Phase 10)

---

## PHASE 13 — KEY DESIGN DECISIONS TO MAINTAIN

1. **No dead states**: if something is loading, show a spinner. If empty, show a helpful empty state with a call-to-action.
2. **Role-aware rendering**: every component should check the user role and show only what's relevant. Trainers never see admin analytics. Learners never see upload controls.
3. **Past = blurred but visible**: past physical sessions always show attendance result. Never fully hidden.
4. **NEW badges expire on first view**: tracked via `first_viewed_at`, not time-based.
5. **Video upload UX**: always show progress bar. Always validate file size client-side before attempting upload. Show disclaimer text below upload zone.
6. **Acknowledgment UX**: green = acknowledged, pulsing blue = needs action, "Undo" is available but subtle (small text, not a button).
7. **Chat**: polling every 10s is acceptable for LAN. No websockets needed. Keep it simple.
8. **Google Meet button**: only show if `google_meet_link` is populated. Never show a broken/empty Meet button.
9. **Section creation**: inline add (hover → click → type → Enter) is the primary flow. Full panel edit is for advanced options.
10. **All admin views have a "as learner" preview mode**: lesson preview panel shows exactly what learner sees.
