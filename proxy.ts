import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authEnabled, verifySession, SESSION_COOKIE } from '@/lib/auth';

// 로그인 보호(AUTH_SECRET·AUTH_USERS가 둘 다 있을 때만 켜진다 — 없으면 아무것도 막지 않는다).
// - 로그인 안 한 요청: 화면은 /login 으로, API는 401.
// - 로그인한 요청에는 x-user(이름, URL 인코딩)·x-user-id·x-role 머리글을 «서버가 직접» 붙인다(밖에서 보낸 같은 이름 머리글은 항상 지운다 — 변경 이력의 «누가»가 위조되지 않게).
// - staff 역할은 삭제(DELETE)·미동 전환·설정 변경·데모 초기화·변경 이력 조회가 막힌다(admin만).
const PUBLIC = [/^\/login$/, /^\/api\/auth\/(login|logout)$/];
const ADMIN_ONLY = (path: string, method: string) =>
  method === 'DELETE' || path.startsWith('/api/midong-orders/convert') || path.startsWith('/api/reset-demo') || path.startsWith('/api/audit') || path.startsWith('/api/mdb-analyze') || (path.startsWith('/api/config') && method !== 'GET');

export async function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  ['x-user', 'x-user-id', 'x-role'].forEach(h => headers.delete(h));
  if (!authEnabled()) return NextResponse.next({ request: { headers } });

  const path = req.nextUrl.pathname;
  if (PUBLIC.some(re => re.test(path))) return NextResponse.next({ request: { headers } });

  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = '';
    return NextResponse.redirect(url);
  }
  if (s.r !== 'admin' && path.startsWith('/api/') && ADMIN_ONLY(path, req.method)) return NextResponse.json({ error: '관리자만 할 수 있는 작업입니다.' }, { status: 403 });
  headers.set('x-user', encodeURIComponent(s.n)); headers.set('x-user-id', s.u); headers.set('x-role', s.r);
  return NextResponse.next({ request: { headers } });
}

// 제외하는 것은 빌드 정적 파일·글꼴·파비콘뿐이다. «이미지 확장자로 끝나는 경로» 전체를 빼면 /api/x.png 같은 API 경로와 회사 도장·화면 캡처(public)가 로그인 없이 열린다(2026-10-16 검수에서 실측).
export const config = { matcher: ['/((?!_next/static|_next/image|fonts/|favicon\\.ico$).*)'] };
