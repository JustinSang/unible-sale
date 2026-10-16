export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { authEnabled, signSession, SESSION_COOKIE, SESSION_DAYS } from '@/lib/auth';
import { loadUsers, verifyPassword, DUMMY_HASH } from '@/lib/authUsers';
import { audit } from '@/lib/audit';

// 무차별 대입 방지: 같은 «아이디»로 5번 틀리면 60초 동안 막는다(접속지 머리글 X-Forwarded-For는 위조할 수 있어 키에 쓰지 않는다 — 대신 누가 일부러 틀려 1분씩 막을 수는 있다).
// 지름길: 메모리 기록이라 서버를 다시 켜거나 서버리스 인스턴스가 바뀌면 초기화된다(완전한 방어는 아님).
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ error: '로그인이 설정되어 있지 않습니다(AUTH_SECRET·AUTH_USERS).' }, { status: 400 });
  const { id, password } = await req.json().catch(() => ({} as Record<string, string>));
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const key = String(id || '').toLowerCase().slice(0, 64);
  if (fails.size > 2000) for (const [k, v] of fails) if (v.until <= Date.now()) fails.delete(k); // 메모리가 계속 늘지 않게 오래된 기록 정리
  const f = fails.get(key);
  if (f && f.until > Date.now()) return NextResponse.json({ error: '로그인 시도가 너무 많습니다. 1분 뒤에 다시 해 주세요.' }, { status: 429 });
  const user = loadUsers().find(u => u.id.toLowerCase() === String(id || '').toLowerCase());
  // 없는 아이디도 같은 계산을 해서 응답 시간으로 계정 존재 여부가 드러나지 않게 한다
  const ok = typeof password === 'string' && verifyPassword(password, user ? user.hash : DUMMY_HASH) && !!user;
  if (!ok || !user) {
    const n = (f && f.until > 0 && f.until <= Date.now() ? 0 : f?.n || 0) + 1; // 잠금이 끝난 뒤에만 횟수를 0으로 되돌린다
    fails.set(key, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    await audit('login_fail', 'auth', String(id || ''), `로그인 실패: ${String(id || '').slice(0, 40)}`, { ip });
    return NextResponse.json({ error: '아이디 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  }
  fails.delete(key);
  const token = await signSession({ u: user.id, n: user.name, r: user.role, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 });
  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https', path: '/', maxAge: SESSION_DAYS * 86400 });
  await audit('login', 'auth', user.id, `로그인: ${user.name}`, { ip }, user.id);
  return res;
}
