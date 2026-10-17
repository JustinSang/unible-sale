export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { authEnabled, verifySession, SESSION_COOKIE } from '@/lib/auth';
import { loadUsers } from '@/lib/authUsers';
import { buildUsers, writeAuthEnv, scheduleRestart, canWriteEnv, type InUser } from '@/lib/loginSetup';
import { audit } from '@/lib/audit';

// 화면에서 로그인 설정(사용자·비밀번호). 누가 할 수 있나:
//  · 로그인이 켜져 있으면: 관리자(admin)만.
//  · 꺼져 있으면(최초 설정): 이 컴퓨터(localhost)에서 연 화면만 — 같은 와이파이·Tailscale의 다른 사람이 먼저 관리자를 만드는 것을 막는다.
// 한계(정직): «이 컴퓨터»는 요청의 Host·x-forwarded-for 머리글로 판정한다. 같은 네트워크의 누군가가 두 머리글을 일부러 localhost 로 속여 보내면 막지 못한다(실측 2026-10-17: 접속자가 보낸 x-forwarded-for 는 그대로 남는다). 그래서 최초 설정은 켜기 직전에 하고, 켠 뒤에는 관리자만 된다.
// 비밀번호는 응답·기록 어디에도 싣지 않는다.
async function who(req: Request) {
  if (authEnabled()) {
    const cookie = (req.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
    const s = await verifySession(cookie);
    return { enabled: true, canManage: s?.r === 'admin', reason: s ? (s.r === 'admin' ? '' : '관리자 계정만 사용자 설정을 바꿀 수 있습니다.') : '로그인이 필요합니다.', me: s?.u || '' };
  }
  const host = (req.headers.get('host') || '').toLowerCase().replace(/:\d+$/, '');
  // Next 서버가 x-forwarded-for 에 접속자의 실제 주소를 채워 준다(없을 때만 — 접속자가 직접 적어 보내면 그 값이 남는다).
  const xff = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const loop = (a: string) => a === '' || a === '::1' || a === '127.0.0.1' || a === '::ffff:127.0.0.1';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host) && loop(xff);
  return { enabled: false, canManage: local, reason: local ? '' : '로그인을 처음 설정하는 일은 이 컴퓨터(주소창이 localhost)에서만 할 수 있습니다.', me: '' };
}

export async function GET(req: Request) {
  const w = await who(req);
  return NextResponse.json({
    enabled: w.enabled, canManage: w.canManage && canWriteEnv(), reason: w.canManage && !canWriteEnv() ? '이 설치는 설정 파일을 쓸 수 없습니다(읽기 전용 환경).' : w.reason, me: w.me,
    users: w.canManage ? loadUsers().map(u => ({ id: u.id, name: u.name, role: u.role })) : []
  });
}

export async function POST(req: Request) {
  try {
    const w = await who(req);
    if (!w.canManage) return NextResponse.json({ error: w.reason || '권한이 없습니다.' }, { status: 403 });
    if (!canWriteEnv()) return NextResponse.json({ error: '이 설치는 설정 파일을 쓸 수 없습니다.' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    if (body.action === 'disable') {
      if (!authEnabled()) return NextResponse.json({ error: '로그인이 이미 꺼져 있습니다.' }, { status: 400 });
      writeAuthEnv(null);
      await audit('update', 'auth', 'login', '로그인 끔(사용자 설정 화면)', {}, w.me);
      return NextResponse.json({ ok: true, restart: scheduleRestart(), enabled: false });
    }
    if (body.action !== 'save') return NextResponse.json({ error: 'action은 save 또는 disable 입니다.' }, { status: 400 });
    const users = buildUsers(body.users as InUser[]);
    writeAuthEnv(users);
    await audit('update', 'auth', 'login', `${w.enabled ? '사용자 설정 변경' : '로그인 켬'}: 사용자 ${users.length}명(${users.map(u => `${u.id}:${u.role}`).join(', ')})`, {}, w.me);
    return NextResponse.json({ ok: true, restart: scheduleRestart(), enabled: true, users: users.map(u => ({ id: u.id, name: u.name, role: u.role })) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '로그인 설정 실패' }, { status: 400 });
  }
}
