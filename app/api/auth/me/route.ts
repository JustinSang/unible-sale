export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authEnabled, verifySession, SESSION_COOKIE } from '@/lib/auth';

// 현재 로그인 상태. 로그인 기능이 꺼져 있으면 {enabled:false}.
export async function GET() {
  if (!authEnabled()) return NextResponse.json({ enabled: false });
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.json(s ? { enabled: true, loggedIn: true, id: s.u, name: s.n, role: s.r } : { enabled: true, loggedIn: false });
}
