export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set(
    'Set-Cookie',
    'lms_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
  );
  return res;
}
