export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set('Set-Cookie', 'lms_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res;
}
